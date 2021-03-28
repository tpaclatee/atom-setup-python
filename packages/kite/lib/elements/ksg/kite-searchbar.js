'use strict';

const { TextEditor, CompositeDisposable, Emitter } = require('atom');
const debounce = require('lodash/debounce');

const { DisposableEvent } = require('../../utils');
const {
  SEARCH_DEBOUNCE,
  SEARCH_QUERY_EVENT,
  SEARCH_QUERY_SELECTION_EVENT,
  DEFAULT_QUERY_SELECTION_EVENT,
  SEARCH_NAV_DOWN,
  SEARCH_NAV_UP,
} = require('../../ksg/constants');

class KSGSearch extends HTMLElement {
  constructor(parentElement) {
    super();

    this.parent = parentElement;

    this.searchInput = new TextEditor({ placeholderText: 'How do I...', mini: true });
    this.searchInputView = this.searchInput.getElement();

    this.appendLogo();

    this.cursorPos = [0, 0];
    this.instantiate();
  }

  appendLogo() {
    const logoSpan = document.createElement('span');
    logoSpan.className = 'ksg-kite-logo';
    this.searchInputView.appendChild(logoSpan);
  }

  instantiate() {
    if (!this.emitter) {
      this.emitter = new Emitter();
    }
    if (!this.subscriptions) {
      this.subscriptions = new CompositeDisposable();
    }

    if (!this.wrapper) {
      this.wrapper = document.createElement('div');
      this.wrapper.setAttribute('class', 'kite-ksg-search-wrapper');
    }

    this.loading = false;

    this.shouldCancelChangeQuery = false;

    const debouncedSearchHandler = debounce(
      e => {
        if (!this.shouldCancelChangeQuery) {
          this.emitter && this.emitter.emit(SEARCH_QUERY_EVENT, { query: this.searchInput.getText() });
        } else {
          this.shouldCancelChangeQuery = false;
        }
      },
      SEARCH_DEBOUNCE,
      { leading: true }
    );

    this.subscriptions.add(this.searchInput.onDidChange(debouncedSearchHandler));
    this.subscriptions.add(
      this.searchInput.onWillInsertText(() => {
        // Record when new query is started (first char inserted)
        if (this.searchInput.getText().length === 0) {
          const metrics = require('../../metrics.js');
          metrics.record('ksg_query', 'started');
        }
      })
    );

    this.subscriptions.add(
      new DisposableEvent(this, 'keydown', e => {
        switch (e.code) {
          case 'ArrowDown':
            this.searchResults && this.searchResults.moveSelection(SEARCH_NAV_DOWN);
            break;

          case 'ArrowUp':
            this.searchResults && this.searchResults.moveSelection(SEARCH_NAV_UP);
            break;

          case 'Enter':
            if (this.searchResults && this.searchResults.hasSelected()) {
              // make selected query logic
              const defaultSelected = this.searchResults.isDefaultSelected();
              this.shouldCancelChangeQuery = true;
              this.searchInput.setText(this.searchResults.selectedQuery);
              this.clearSearchResults();
              if (defaultSelected) {
                this.emitter.emit(DEFAULT_QUERY_SELECTION_EVENT, { query: this.searchInput.getText() });
              } else {
                this.emitter.emit(SEARCH_QUERY_SELECTION_EVENT, { query: this.searchInput.getText() });
              }
            } else {
              // send current input
              if (this.searchInput.getText() && this.searchResults) {
                const onlyDefault = this.searchResults.onlyResultIsDefault();
                this.clearSearchResults();
                if (onlyDefault) {
                  this.emitter.emit(DEFAULT_QUERY_SELECTION_EVENT, { query: this.searchInput.getText() });
                } else {
                  this.emitter.emit(SEARCH_QUERY_SELECTION_EVENT, { query: this.searchInput.getText() });
                }
              }
            }
        }
      })
    );

    this.wrapper.appendChild(this.searchInputView);
    this.appendChild(this.wrapper);

    this.instantiated = true;
  }

  blurSearchBar() {
    this.blur();
    this.searchInputView && this.searchInputView.blur();
  }

  connectedCallback() {
    !this.instantiated && this.instantiate();
    this.setFocus();
  }

  disconnectedCallback() {
    this.dispose();
  }

  dispose() {
    this.clearSearchResults();
    this.instantiated = false;
    this.searchInput && this.searchInput.setText('');
    this.searchResults && this.searchResults.dispose();
    this.searchResults = null;
    this.wrapper && this.wrapper.parentNode && this.wrapper.parentNode.removeChild(this.wrapper);
    // this.loadingSpinnerEl &&
    //   this.loadingSpinnerEl.parentNode &&
    //   this.searchInputView.removeChild(this.loadingSpinnerEl);
    this.wrapper && this.searchInputView && this.wrapper.removeChild(this.searchInputView);
    this.wrapper = null;
    this.subscriptions && this.subscriptions.dispose();
    this.emitter && this.emitter.dispose();
    delete this.subscriptions;
    delete this.emitter;
  }

  onSearchQueryEvent(callback) {
    return this.emitter.on(SEARCH_QUERY_EVENT, callback);
  }

  onSearchQuerySelection(callback) {
    return this.emitter.on(SEARCH_QUERY_SELECTION_EVENT, callback);
  }

  onDefaultQuerySelection(callback) {
    return this.emitter.on(DEFAULT_QUERY_SELECTION_EVENT, callback);
  }

  clearSearchResults() {
    this.searchResults && this.searchResults.clear();
  }

  toggleLoading() {
    // if (!this.loading) {
    //   if (!this.loadingSpinnerEl) {
    //     this.loadingSpinnerEl = document.createElement('div');
    //     this.loadingSpinnerEl.classList.add('loading-spinner-wrapper');
    //     const spinner = document.createElement('div');
    //     spinner.classList.add('loading-spinner');
    //     this.loadingSpinnerEl.appendChild(spinner);
    //   }
    //   this.searchInputView.appendChild(this.loadingSpinnerEl);
    // } else {
    //   this.loadingSpinnerEl.parentNode && this.searchInputView.removeChild(this.loadingSpinnerEl);
    // }
    // this.loading = !this.loading;
  }

  updateView({ payload, data }) {
    this.toggleLoading();

    if (!this.searchResults) {
      this.searchResults = new KSGSearchResults();
      this.wrapper.appendChild(this.searchResults);

      this.subscriptions.add(
        this.searchResults.onResultPropagation(({ resultText, type }) => {
          this.shouldCancelChangeQuery = true;
          this.searchResults.clear();

          switch (type) {
            case SEARCH_QUERY_SELECTION_EVENT:
              this.searchInput.setText(resultText);
              this.emitter.emit(SEARCH_QUERY_SELECTION_EVENT, { query: this.searchInput.getText() });
              break;
            default:
              this.emitter.emit(DEFAULT_QUERY_SELECTION_EVENT, { query: resultText });
              break;
          }
        })
      );
    }
    // If code blocks are loading, ignore update requests to search results list.
    if (this.parent && this.parent.codeBlocksElem && this.parent.codeBlocksElem.loading) {
      return;
    }

    this.clearSearchResults();

    if (payload === 'error') {
      this.parent.toggleErrorMessage(true);
      return;
    }

    this.parent.toggleErrorMessage(false);

    if (data && data.completions && data.completions.length > 0) {
      this.searchResults.appendResults(data.completions, data.query);
    }

    if (data && data.query && !data.completions) {
      this.searchResults.appendResults([data.query], data.query);
    }

    const query = this.searchInput.getText();
    if (query) {
      this.focus();
      this.searchResults.appendDefault(this.searchInput.getText());
    }
  }

  setFocus() {
    this.searchInputView.focus();
    this.searchInput.moveToBottom();
  }
}

class KSGSearchResults extends HTMLElement {
  constructor() {
    super();

    this.selectedIdx = null;
    this.results = [];
    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable();
  }

  dispose() {
    this.clear();
    this.emitter && this.emitter.dispose();
    this.subscriptions && this.subscriptions.dispose();
  }

  onlyResultIsDefault() {
    if (this.results.length === 1) {
      return this.results[0] instanceof KSGDefaultSearchResult;
    }
    return false;
  }

  appendResults(results, query) {
    // to batch the DOM changes
    const fragment = document.createDocumentFragment();
    results.forEach(result => {
      const el = new KSGSearchResult(result, query, this);
      el.initialize();
      el.id = this.results.length;
      fragment.appendChild(el);
      this.results.push(el);
      this.subscriptions.add(
        el.onResultClick(resultText => {
          this.emitter.emit('did-search-result-propagate', { resultText, type: SEARCH_QUERY_SELECTION_EVENT });
        })
      );
    });
    this.appendChild(fragment);
    this.classList.add('bordered');
  }

  appendDefault(query) {
    const searchResult = new KSGDefaultSearchResult(query, this);
    searchResult.initialize();
    searchResult.id = this.results.length;
    this.subscriptions.add(
      searchResult.onResultClick(resultText => {
        this.emitter.emit('did-search-result-propagate', { resultText, type: DEFAULT_QUERY_SELECTION_EVENT });
      })
    );
    this.results.push(searchResult);
    this.appendChild(searchResult);
    this.classList.add('bordered');
  }

  onResultPropagation(callback) {
    return this.emitter.on('did-search-result-propagate', callback);
  }

  moveSelection(direction) {
    if (this.results && this.results.length) {
      switch (direction) {
        case SEARCH_NAV_DOWN:
          if (this.selectedIdx === null) {
            this.selectedIdx = 0;
            this.results[this.selectedIdx].toggleHighlight();
          } else if (this.selectedIdx < this.results.length - 1) {
            this.results[this.selectedIdx].toggleHighlight();
            this.selectedIdx++;
            this.results[this.selectedIdx].toggleHighlight();
          }
          break;

        case SEARCH_NAV_UP:
          if (this.selectedIdx !== null) {
            this.results[this.selectedIdx].toggleHighlight();
            if (this.selectedIdx === 0) {
              this.selectedIdx = null;
            } else {
              this.selectedIdx--;
              this.results[this.selectedIdx].toggleHighlight();
            }
          }
          break;
      }
    }
  }

  get selectedQuery() {
    if (this.selectedIdx !== null) {
      const result = this.results[this.selectedIdx];
      if (result instanceof KSGDefaultSearchResult) {
        return result.query;
      }
      return result.resultText;
    }
    return null;
  }

  isDefaultSelected() {
    if (this.selectedIdx !== null) {
      return this.results[this.selectedIdx] instanceof KSGDefaultSearchResult;
    }
    return false;
  }

  hasSelected() {
    return this.selectedIdx !== null;
  }

  clearHighlight() {
    if (this.selectedIdx !== null) {
      this.results[this.selectedIdx].toggleHighlight();
      this.selectedIdx = null;
    }
  }

  clear() {
    while (this.lastChild) {
      this.lastChild.dispose && this.lastChild.dispose();
      this.removeChild(this.lastChild);
    }

    this.selectedIdx = null;
    this.results = [];
    this.classList.remove('bordered');
  }
}

class KSGSearchResult extends HTMLElement {
  constructor(resultText, query, parent) {
    super();

    this.parent = parent;
    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable();
    this.resultText = resultText;
    this.query = query;
    this.isHighlighted = false;
  }

  initialize() {
    this.subscriptions.add(new DisposableEvent(this, 'click', this.clickHandler));
    const div = this.resultContent;
    div.onmouseover = () => {
      this.parent.clearHighlight();
      this.parent.selectedIdx = this.id;
      this.toggleHighlight();
    };
    this.appendChild(div);
  }

  get resultContent() {
    const div = document.createElement('div');
    const remainder = document.createElement('span');
    remainder.classList.add('ksg-search-result-remainder');
    // Only concatenate query with resultText if resultText starts with query.
    // Otherwise, we may execute a query that doesn't match with the selection text.
    if (this.resultText.startsWith(this.query)) {
      div.appendChild(document.createTextNode(this.query));
      remainder.textContent = this.resultText.substring(this.query.length);
    } else {
      remainder.textContent = this.resultText;
    }
    div.appendChild(remainder);
    return div;
  }

  clickHandler(e) {
    this.emitter.emit('search-result-clicked', this.resultText);
  }

  dispose() {
    this.emitter && this.emitter.dispose();
    this.subscriptions && this.subscriptions.dispose();
  }

  onResultClick(callback) {
    return this.emitter.on('search-result-clicked', callback);
  }

  toggleHighlight() {
    if (this.isHighlighted) {
      this.classList.remove('highlight-result');
    } else {
      this.classList.add('highlight-result');
    }
    this.isHighlighted = !this.isHighlighted;
  }
}

class KSGDefaultSearchResult extends KSGSearchResult {
  constructor(query, parent) {
    super(null, query, parent);
  }

  get resultContent() {
    const div = document.createElement('div');

    const searchForSpan = document.createElement('span');
    searchForSpan.classList.add('plain-text');
    searchForSpan.textContent = 'Search for ';
    div.appendChild(searchForSpan);

    const queryEl = document.createTextNode(this.query);
    div.appendChild(queryEl);

    const onGoogleSpan = document.createElement('span');
    onGoogleSpan.classList.add('plain-text');
    onGoogleSpan.textContent = ' on Google ⇗';
    div.appendChild(onGoogleSpan);
    return div;
  }

  clickHandler(e) {
    this.emitter.emit('default-result-clicked', this.query);
  }

  onResultClick(callback) {
    return this.emitter.on('default-result-clicked', callback);
  }
}

customElements.define('kite-ksg-search-results', KSGSearchResults);
customElements.define('kite-ksg-search-result', KSGSearchResult);
customElements.define('kite-ksg-default-search-result', KSGDefaultSearchResult);
customElements.define('kite-ksg-search', KSGSearch);
module.exports = {
  KSGSearch,
  KSGDefaultSearchResult,
  KSGSearchResult,
  KSGSearchResults,
};
