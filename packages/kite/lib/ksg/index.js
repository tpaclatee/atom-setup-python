'use strict';

const { CompositeDisposable } = require('atom');
const KSGElement = require('../elements/ksg/kite-ksg');
const { KSGSearchResult, KSGDefaultSearchResult } = require('../elements/ksg/kite-searchbar');
const SearchModel = require('./search');
const CodeblocksModel = require('./codeblocks');
const {
  SEARCH_QUERY_SELECTION_EVENT,
  CODEBLOCKS_SELECTION_EVENT,
  SEARCH_QUERY_EVENT,
  DEFAULT_QUERY_SELECTION_EVENT,
  DEFAULT_CODEBLOCKS_SELECTION_EVENT,
} = require('./constants');

const { DisposableEvent } = require('../utils');
const metrics = require('./../metrics.js');

module.exports = class KSG {
  constructor() {
    this.codeblocks = new CodeblocksModel();
    this.search = new SearchModel();

    this._visible = false;
    this._needsRefresh = true;
    this.currentEditor = null;
    // use below for reinsertion
    this.cachedCursorPos = null;
    this.marker = null;
    this.decoration = null;
  }

  init(Kite) {
    // will need to pay attention to a notion of 'editors'
    this.element = new KSGElement();
    this._needsRefresh = false;
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.commands.add(this.element, {
        'core:close': () => this.hide(),
        'core:cancel': () => this.hide(),
        // what other commands (e.g. `core:confirm`) need to be added here?
        'kite:search-stack-overflow': () => {
          this.visible ? this.hide() : this.show(atom.workspace.getActiveTextEditor());
        },
      })
    );

    this.subscriptions.add(
      this.element.onCodeBlocksEvent(payload => {
        switch (payload.type) {
          case SEARCH_QUERY_SELECTION_EVENT:
            metrics.record('ksg_query', 'searched');
            this.codeblocks.executeQuery(payload);
            break;

          case CODEBLOCKS_SELECTION_EVENT:
            this.insertCodeblocks(payload);
            break;

          case DEFAULT_CODEBLOCKS_SELECTION_EVENT:
            this.executeExternalSearch(payload);
            break;
        }
      })
    );

    this.subscriptions.add(
      this.element.onSearchEvent(payload => {
        switch (payload.type) {
          case SEARCH_QUERY_EVENT:
            this.search.executeQuery(payload);
            break;
          case DEFAULT_QUERY_SELECTION_EVENT:
            this.executeExternalSearch(payload);
            break;
        }
      })
    );

    this.subscriptions.add(
      this.codeblocks.onDidUpdate(payload => {
        this.element.updateCodeBlocks(payload);
      })
    );

    this.subscriptions.add(
      this.codeblocks.onDidLoading(() => {
        this.element.toggleCodeBlocksLoading();
      })
    );

    this.subscriptions.add(
      this.search.onDidUpdate(payload => {
        this.element.updateSearch(payload);
      })
    );

    this.subscriptions.add(
      this.search.onDidLoading(() => {
        this.element.toggleSearchLoading();
      })
    );
  }

  executeExternalSearch({ query }) {
    atom.applicationDelegate.openExternal(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    metrics.record('ksg_google', 'opened');
    this.hide();
  }

  insertCodeblocks({ blocks, link }) {
    const title = this.currentEditor ? this.currentEditor.getTitle() : '';
    const decoratedBlocks = CodeblocksModel.decorateCodeblocks(blocks, link, title);
    // will by default insert at last cursor position
    this.currentEditor && this.currentEditor.insertText(decoratedBlocks, { select: true });
    metrics.record('ksg_snippet', 'selected');
    // we close the KSG widget on the completion of this action
    this.hide();
  }

  dispose() {
    this.hide();
    this.subscriptions && this.subscriptions.dispose();
    this.element && this.element.dispose();
    this.search && this.search.dispose();
    this.codeblocks && this.codeblocks.dispose();
    delete this.element;
    delete this.subscriptions;
    delete this.search;
    delete this.codeblocks;
  }

  get needsRefresh() {
    return this._needsRefresh;
  }

  static shouldStopPropagation(event) {
    if (event instanceof KeyboardEvent) {
      if (event.code === 'Enter' || event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'Tab') {
        return true;
      }
    }
    return false;
  }

  shouldHideForTarget(target) {
    if (this.element.contains(target)) {
      return false;
    }
    while (target) {
      if (target instanceof KSGDefaultSearchResult || target instanceof KSGSearchResult) {
        return false;
      }
      if (
        target &&
        target.classList &&
        (target.classList.contains('ksg-code-block-toggle') || target.classList.contains('ksg-shortcut'))
      ) {
        return false;
      }
      target = target.parentNode;
    }
    return true;
  }

  show(editor) {
    this._visible = true;
    // if we attempt to show, and there's another ksg panel in another editor
    // we hide that other panel (we keep ksg as a singleton for now)
    if (this.currentEditor && this.currentEditor.id !== editor.id) {
      this.hide();
    }
    // do nothing if already showing in current editor
    if (this.currentEditor && this.currentEditor.id === editor.id) {
      return;
    }
    this.currentEditor = editor;

    if (this.needsRefresh) {
      this.init();
    }

    // prevent UI events from propagating too far
    // prevent keystrokes and wheel events from going to the text editor
    this.subscriptions.add(
      new DisposableEvent(this.element, 'keydown wheel', e => {
        if (KSG.shouldStopPropagation(e)) {
          e.stopPropagation();
        }
      })
    );

    // hide on clicks outside the element
    this.subscriptions.add(
      new DisposableEvent(document, 'click', e => {
        // our search result clicking logic disappears those elements from the DOM before this handler's run
        if (this.shouldHideForTarget(e.target)) {
          this.hide();
        }
      })
    );

    // prevent mouse-scroll events from default behavior if outside KSG
    this.subscriptions.add(
      new DisposableEvent(this.currentEditor.element, 'wheel', e => {
        e.preventDefault();
      })
    );

    const cursor = this.currentEditor.getCursorScreenPosition();

    this.marker = this.currentEditor.markScreenPosition({ row: cursor.row, column: 0 });
    this.decoration = this.currentEditor.decorateMarker(this.marker, {
      type: 'overlay',
      item: this.element,
    });
  }

  hide() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.marker && this.marker.destroy();
    this.marker = null;
    this.decoration = null;
    // we need to explicitly refocus the editor
    this.currentEditor && this.currentEditor.element.focus();
    this.currentEditor = null;

    this.subscriptions && this.subscriptions.dispose();
    this._visible = false;
    this._needsRefresh = true;
  }

  get visible() {
    return this._visible;
  }

  getElement() {
    return this.element;
  }
};
