'use strict';

const { CompositeDisposable } = require('atom');
require('../elements/ksg/so-logo');

module.exports = class KSGShortcut {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'ksg-shortcut';
    this.element.innerHTML = '<so-logo class="badge"></so-logo>';
    this.element.classList.add('inline-block');
  }

  init(Kite) {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.tooltips.add(this.element, {
        title: () => 'Kite: Search Stack Overflow',
      })
    );
    this.subscriptions.add(atom.workspace.onDidChangeActiveTextEditor(() => this.toggleVisibility()));

    this.clickListener = () => Kite.toggleKSG();
    this.element.addEventListener('click', this.clickListener);

    this.toggleVisibility();
  }

  toggleVisibility() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor || editor.getGrammar().name !== 'Python') {
      this.element.classList.add('hidden');
    } else {
      this.element.classList.remove('hidden');
    }
  }

  dispose() {
    this.subscriptions && this.subscriptions.dispose();
    delete this.subscriptions;
    this.element.removeEventListener('click', this.clickListener);
  }

  getElement() {
    return this.element;
  }
};
