'use strict';

require('./kite-links');
const {Point, CompositeDisposable} = require('atom');
const {symbolName, symbolType} = require('../kite-data-utils');
const {internalGotoURL} = require('../urls');
const {debugData, wrapAfterParenthesisAndDots} = require('./html-utils');
const {DisposableEvent, idToDottedPath} = require('../utils');

let OverlayManager;

class KiteHover extends HTMLElement {
  static initClass() {
    customElements.define('kite-hover', this);
    return this;
  }

  disconnectedCallback() {
    this.subscriptions && this.subscriptions.dispose();
  }

  connectedCallback() {
    this.classList.add('native-key-bindings');
    this.setAttribute('tabindex', '-1');
  }

  setData(data, editor, position) {
    position = Point.fromObject(position);

    if (data && data.symbol && data.symbol.length) {
      const [symbol] = data.symbol;
    // const type = symbolType(symbol);
      const actions = [];

      if (data.report.definition &&
        data.report.definition.filename &&
        data.report.definition.filename.trim() !== '') {
        actions.push(`<a
        href="${internalGotoURL(data.report.definition)}">Def<span class="kite-link-icon">&#8619;</span></a>`);
      }

      actions.push(`<a href="kite-atom-internal://open-search-docs/${idToDottedPath(symbol.id)}">Docs<span class="kite-link-icon">&#8663;</span></a>`);

      this.innerHTML = `
    <div class="definition">
      <kite-logo small title="Powered by Kite" class="badge"></kite-logo>
      <span class="name"><code>${wrapAfterParenthesisAndDots(symbolName(symbol))}</code></span>
      <span class="type">&#10098; ${symbolType(symbol)} &#10099;</span>
      <kite-links metric="Hover">
        ${actions.join(' ')}
      </kite-links>
    </div>
    ${debugData(data)}`;

      this.subscriptions = new CompositeDisposable();
      const links = this.querySelector('kite-links');
      const debug = this.querySelector('.debug');

      if (debug) {
        this.subscriptions.add(new DisposableEvent(debug, 'mousewheel', (e) => {
          e.stopPropagation();
        }));
      }

      if (links) {
        this.subscriptions.add(links.onDidClickMoreLink(() => {
          if (!OverlayManager) {
            OverlayManager = require('../overlay-manager');
          }
          OverlayManager.dismiss();
        }));
      }

    } else {
      this.innerHTML = '';
    }
  }
}

module.exports = KiteHover.initClass();
