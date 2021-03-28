'use strict';

const { CompositeDisposable, Emitter } = require('atom');

const { KSGCodeBlocks } = require('./kite-codeblocks');
const { KSGSearch } = require('./kite-searchbar');

const { DisposableEvent } = require('../../utils');

const {
  CODEBLOCKS_EVENT,
  CODEBLOCKS_SELECTION_EVENT,
  DEFAULT_CODEBLOCKS_SELECTION_EVENT,
  SEARCH_EVENT,
  SEARCH_QUERY_EVENT,
  SEARCH_QUERY_SELECTION_EVENT,
  DEFAULT_QUERY_SELECTION_EVENT,
  KSG_NAV_UP_EVENT,
  KSG_NAV_DOWN_EVENT,
  KSG_SELECTION_EVENT,
} = require('../../ksg/constants');

/**
 * will need to have nest custom elements...
 * how to do that?
 */
class KSG extends HTMLElement {
  constructor() {
    super();
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();

    this.addWrapper();
  }

  addWrapper() {
    this.wrapper = document.createElement('div');
    this.wrapper.setAttribute('class', 'kite-ksg-inner');

    this.appendChild(this.wrapper);
  }

  connectedCallback() {
    if (!this.emitter) {
      this.emitter = new Emitter();
    }
    if (!this.subscriptions) {
      this.subscriptions = new CompositeDisposable();
    }
    if (!this.wrapper) {
      this.addWrapper();
    }

    this._disposed = false;

    this.setAttribute('tabindex', -1);
    this.codeBlocksElem = new KSGCodeBlocks(this);
    this.searchElem = new KSGSearch(this);

    this.subscriptions.add(
      this.codeBlocksElem.onCodeblocksSelected(payload => {
        payload.type = CODEBLOCKS_SELECTION_EVENT;
        this.emitter.emit(CODEBLOCKS_EVENT, payload);
      })
    );

    this.subscriptions.add(
      this.codeBlocksElem.onDefaultCodeblockSelection(payload => {
        payload.type = DEFAULT_CODEBLOCKS_SELECTION_EVENT;
        this.emitter.emit(CODEBLOCKS_EVENT, payload);
      })
    );

    this.subscriptions.add(
      this.searchElem.onSearchQueryEvent(payload => {
        payload.type = SEARCH_QUERY_EVENT;
        this.emitter.emit(SEARCH_EVENT, payload);
        // close codeblocks elem
        this.codeBlocksElem.clearGroups();
      })
    );

    this.subscriptions.add(
      this.searchElem.onSearchQuerySelection(payload => {
        this.searchElem.blurSearchBar();
        payload.type = SEARCH_QUERY_SELECTION_EVENT;
        this.emitter.emit(CODEBLOCKS_EVENT, payload);
      })
    );

    this.subscriptions.add(
      this.searchElem.onDefaultQuerySelection(payload => {
        this.searchElem.blurSearchBar();
        payload.type = DEFAULT_QUERY_SELECTION_EVENT;
        this.emitter.emit(SEARCH_EVENT, payload);
      })
    );

    this.subscriptions.add(
      new DisposableEvent(this, 'keydown', e => {
        switch (e.code) {
          case 'ArrowDown':
            this.emitter.emit(KSG_NAV_DOWN_EVENT);
            break;
          case 'ArrowUp':
            this.emitter.emit(KSG_NAV_UP_EVENT);
            break;
          case 'Enter':
            this.emitter.emit(KSG_SELECTION_EVENT);
            break;
        }
      })
    );

    this.wrapper.appendChild(this.searchElem);
    this.wrapper.appendChild(this.codeBlocksElem);
  }

  disconnectedCallback() {
    this.dispose();
  }

  onCodeBlocksEvent(callback) {
    return this.emitter.on(CODEBLOCKS_EVENT, callback);
  }

  onSearchEvent(callback) {
    return this.emitter.on(SEARCH_EVENT, callback);
  }

  onNavUpEvent(callback) {
    return this.emitter.on(KSG_NAV_UP_EVENT, callback);
  }

  onNavDownEvent(callback) {
    return this.emitter.on(KSG_NAV_DOWN_EVENT, callback);
  }

  onSelectionEvent(callback) {
    return this.emitter.on(KSG_SELECTION_EVENT, callback);
  }

  updateSearch(payload) {
    this.searchElem && this.searchElem.updateView(payload);
  }

  updateCodeBlocks(payload) {
    this.codeBlocksElem && this.codeBlocksElem.updateView(payload);
  }

  toggleCodeBlocksLoading() {
    this.codeBlocksElem && this.codeBlocksElem.toggleLoading();
  }

  toggleSearchLoading() {
    this.searchElem && this.searchElem.toggleLoading();
  }

  toggleErrorMessage(shouldDisplay) {
    if (!this.errorMsg) {
      this.errorMsg = document.createElement('div');
      this.errorMsg.className = 'ksg-search-error';
      this.errorMsg.innerHTML =
        'An error occurred! Please make sure that Kite is running and that you have an Internet connection.';
    }
    if (shouldDisplay) {
      this.wrapper &&
        !(this.wrapper.lastElementChild.className === 'ksg-search-error') &&
        this.wrapper.appendChild(this.errorMsg);
    } else {
      this.errorMsg.parentNode && this.wrapper && this.wrapper.removeChild(this.errorMsg);
    }
  }

  dispose() {
    this.codeBlocksElem && this.wrapper.removeChild(this.codeBlocksElem);
    this.searchElem && this.wrapper.removeChild(this.searchElem);

    this.errorMsg && this.errorMsg.parentNode && this.wrapper && this.wrapper.removeChild(this.errorMsg);

    this.wrapper && this.wrapper.parentNode && this.wrapper.parentNode.removeChild(this.wrapper);
    this.wrapper = null;

    this.subscriptions && this.subscriptions.dispose();
    this.emitter && this.emitter.dispose();
    delete this.emitter;
    delete this.subscriptions;

    this.codeBlocksElem = null;
    this.searchElem = null;
  }
}

customElements.define('kite-ksg', KSG);
module.exports = KSG;
