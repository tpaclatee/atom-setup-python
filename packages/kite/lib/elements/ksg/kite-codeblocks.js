'use strict';

const { CompositeDisposable, Emitter } = require('atom');

const { DisposableEvent } = require('../../utils');

const {
  CODEBLOCKS_ADD,
  CODEBLOCK_CLICKED,
  CODEBLOCKS_SELECTED,
  CODEBLOCKS_DEFAULT_SELECTED,
  CODEBLOCK_LINE_LIMIT,
  CODEBLOCKS_NAV_DOWN,
  CODEBLOCKS_NAV_UP,
} = require('../../ksg/constants');

class KSGCodeBlocks extends HTMLElement {
  constructor(parentElement) {
    super();

    this.parent = parentElement;

    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable();
    this.groups = [];

    this.tabIndex = -1;
    this.instantiated = false;
    this.highlightedGroupIdx = null;
    this.loading = false;

    this.addWrapper();
  }

  connectedCallback() {
    !this.instantiated && this.instantiate();
  }

  addWrapper() {
    this.wrapper = document.createElement('div');
    this.wrapper.setAttribute('class', 'kite-ksg-code-blocks-wrapper');
    this.appendChild(this.wrapper);
  }

  disconnectedCallback() {
    this.dispose();
  }

  dispose() {
    this.clearGroups();
    this.instantiated = false;
    this.emitter && this.emitter.dispose();
    this.subscriptions && this.subscriptions.dispose();
    this.wrapper && this.wrapper.parentNode && this.wrapper.parentNode.removeChild(this.wrapper);
    this.wrapper = null;
    delete this.emitter;
    delete this.subscriptions;
  }

  instantiate() {
    if (!this.subscriptions) {
      this.subscriptions = new CompositeDisposable();
    }
    if (!this.emitter) {
      this.emitter = new Emitter();
    }
    if (!this.wrapper) {
      this.addWrapper();
    }

    this.instantiated = true;
  }

  makeSelection() {
    if (this.groups && this.groups.length && this.highlightedGroupIdx !== null) {
      this.groups[this.highlightedGroupIdx].selectHighlighted();
      this.highlightedGroupIdx = null;
    }
  }

  moveSelection(direction) {
    if (this.groups && this.groups.length) {
      switch (direction) {
        case CODEBLOCKS_NAV_DOWN:
          if (this.highlightedGroupIdx === null) {
            this.highlightedGroupIdx = 0;
            // we assume that a group has at least some codeblock to highlight
            this.groups[this.highlightedGroupIdx].highlightFirst();
          } else if (this.highlightedGroupIdx < this.groups.length) {
            if (!this.groups[this.highlightedGroupIdx].highlightNext()) {
              if (this.highlightedGroupIdx < this.groups.length - 1) {
                // unhighlight current group
                this.groups[this.highlightedGroupIdx].unhighlight();
                this.highlightedGroupIdx++;
                // we assume that a group has at least some codeblock to highlight
                this.groups[this.highlightedGroupIdx].highlightFirst();
              }
            }
          }
          break;

        case CODEBLOCKS_NAV_UP:
          if (this.highlightedGroupIdx !== null) {
            if (!this.groups[this.highlightedGroupIdx].highlightPrev()) {
              this.groups[this.highlightedGroupIdx].unhighlight();
              if (this.highlightedGroupIdx === 0) {
                this.highlightedGroupIdx = null;
              } else {
                this.highlightedGroupIdx--;
                this.groups[this.highlightedGroupIdx].highlightLast();
              }
            }
          }
          break;
      }
    }
  }

  clearGroups() {
    // we assume that subscriptions is only holding codeblock related stuff
    if (this.groups && this.groups.length > 0) {
      this.subscriptions && this.subscriptions.dispose();
      delete this.subscriptions;

      this.instantiate();

      this.groups.forEach(group => {
        this.wrapper && this.wrapper.removeChild(group);
        group.dispose && group.dispose();
      });
      this.groups = [];
    }
  }

  onCodeblocksSelected(callback) {
    return this.emitter && this.emitter.on(CODEBLOCKS_SELECTED, callback);
  }

  onDefaultCodeblockSelection(callback) {
    return this.emitter && this.emitter.on(CODEBLOCKS_DEFAULT_SELECTED, callback);
  }

  toggleLoading() {
    if (!this.loading) {
      const loadingEl = new KSGLoadingBlock();
      this.groups.push(loadingEl);
      this.wrapper.appendChild(loadingEl);
      this.focus();
    } else {
      this.groups = this.groups.filter(group => !(group instanceof KSGLoadingBlock));
    }
    this.loading = !this.loading;
  }

  updateView({ payload, data }) {
    this.clearGroups();

    if (payload === 'error') {
      this.parent.toggleErrorMessage(true);
      this.parent.searchElem && this.parent.searchElem.setFocus();
      return;
    }
    this.parent.toggleErrorMessage(false);
    this.loading = false;
    // add default group logic here...
    let idx = 0;
    if (data && data.answers && data.answers.length > 0) {
      // fragment strategy for appending
      const groupFragment = document.createDocumentFragment();
      data.answers.forEach(answer => {
        const groupEl = new KSGCodeBlockGroup(data.query, idx, this, answer);
        // we assume that subscriptions is only holding codeblock related Disposables
        this.subscriptions.add(
          groupEl.onAddAll(payload => {
            this.emitter.emit(CODEBLOCKS_SELECTED, payload);
          })
        );

        groupFragment.appendChild(groupEl);
        this.groups.push(groupEl);
        idx++;
      });
      this.wrapper.appendChild(groupFragment);
    }
    if (data && data.query) {
      const defaultGroupEl = new KSGCodeBlockGroup(data.origQuery, idx, this, {}, true);
      this.subscriptions.add(
        defaultGroupEl.onAddAll(payload => {
          this.emitter.emit(CODEBLOCKS_DEFAULT_SELECTED, payload);
        })
      );

      this.groups.push(defaultGroupEl);
      this.wrapper.appendChild(defaultGroupEl);
      // Subscribe callbacks to parent up, down, selection events after view is updated.
      this.subscriptions.add(
        this.parent.onNavDownEvent(() => this.moveSelection(CODEBLOCKS_NAV_DOWN)),
        this.parent.onNavUpEvent(() => this.moveSelection(CODEBLOCKS_NAV_UP)),
        this.parent.onSelectionEvent(() => this.makeSelection())
      );
      this.moveSelection(CODEBLOCKS_NAV_DOWN);
      this.parent.searchElem && this.parent.searchElem.setFocus();
    }
  }
}

class KSGLoadingBlock extends HTMLElement {
  constructor() {
    super();

    const loadingWrapper = document.createElement('div');
    loadingWrapper.classList.add('loading-spinner-wrapper');

    const loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('loading-spinner');
    loadingWrapper.appendChild(loadingSpinner);

    this.appendChild(loadingWrapper);
  }
}

class KSGCodeBlockGroup extends HTMLElement {
  constructor(query, position, parent, answer = {}, isDefaultGroup = false) {
    super();

    this.position = position;
    this.parent = parent;

    this.setAttribute('class', this.position % 2 === 0 ? 'even' : 'odd');

    this.isDefaultGroup = isDefaultGroup;

    this.highlightedIdx = null;

    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
    this.query = query;
    this.blocks = [];

    if (this.isDefaultGroup) {
      const defaultBlock = new KSGDefaultCodeBlock(query, this);
      defaultBlock.id = this.blocks.length;
      this.subscriptions.add(
        defaultBlock.onClicked(({ query }) => {
          this.emitter.emit(CODEBLOCKS_ADD, {
            query,
          });
        })
      );
      this.blocks.push(defaultBlock);
      this.appendChild(defaultBlock);
    } else {
      const { question_title, votes, is_accepted, code_blocks, answer_id } = answer;

      if (code_blocks && code_blocks.length > 0) {
        const fragment = document.createDocumentFragment();
        code_blocks.forEach((block, idx) => {
          const blockEl =
            idx == 0
              ? new KSGCodeBlock(block, this, question_title, answer_id, votes, is_accepted)
              : new KSGCodeBlock(block, this);
          blockEl.id = this.blocks.length;

          this.subscriptions.add(
            blockEl.onClicked(({ block }) => {
              this.emitter.emit(CODEBLOCKS_ADD, {
                blocks: [block],
                link: blockEl.link,
              });
            })
          );

          fragment.appendChild(blockEl);
          this.blocks.push(blockEl);
        });
        this.appendChild(fragment);
      }
    }
  }

  selectHighlighted() {
    if (this.highlightedIdx !== null && this.blocks && this.blocks.length) {
      this.blocks[this.highlightedIdx].makeSelection();
      this.highlightedIdx = null;
    }
  }

  unhighlight() {
    if (this.highlightedIdx !== null && this.blocks && this.blocks.length) {
      this.blocks[this.highlightedIdx].unhighlight();
      this.highlightedIdx = null;
    }
  }

  // the highlighting methods assume only one block can be highlighted at a time
  highlightFirst() {
    if (this.highlightedIdx !== null) {
      this.unhighlight();
    }
    if (this.blocks && this.blocks.length) {
      this.highlightedIdx = 0;
      this.blocks[this.highlightedIdx].highlight();
      this.blocks[this.highlightedIdx].scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  highlightLast() {
    if (this.highlightedIdx !== null) {
      this.unhighlight();
    }
    if (this.blocks && this.blocks.length) {
      this.highlightedIdx = this.blocks.length - 1;
      this.blocks[this.highlightedIdx].highlight();
      this.blocks[this.highlightedIdx].scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  highlightNext() {
    if (this.highlightedIdx === null) {
      this.highlightFirst();
      return true;
    } else if (this.blocks && this.blocks.length && this.highlightedIdx < this.blocks.length - 1) {
      this.blocks[this.highlightedIdx].unhighlight();
      this.highlightedIdx++;
      this.blocks[this.highlightedIdx].highlight();
      this.blocks[this.highlightedIdx].scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    }
    return false;
  }

  highlightPrev() {
    if (this.highlightedIdx === null) {
      this.highlightLast();
      return true;
    } else if (this.blocks && this.blocks.length && this.highlightedIdx > 0) {
      this.blocks[this.highlightedIdx].unhighlight();
      this.highlightedIdx--;
      this.blocks[this.highlightedIdx].highlight();
      this.blocks[this.highlightedIdx].scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    }
    return false;
  }

  onAddAll(callback) {
    return this.emitter && this.emitter.on(CODEBLOCKS_ADD, callback);
  }

  disconnectedCallback() {
    this.dispose();
  }

  dispose() {
    this.blocks = [];
    this.subscriptions && this.subscriptions.dispose();
    this.emitter && this.emitter.dispose();
  }
}

class KSGCodeBlock extends HTMLElement {
  static truncateCode(codeblock) {
    let lineCount = 0;
    let idx = 0;
    for (const c of codeblock) {
      if (c === '\n') {
        lineCount++;
      }
      if (lineCount === CODEBLOCK_LINE_LIMIT) {
        break;
      }
      idx++;
    }
    return codeblock.substring(0, idx);
  }

  static createToggleEl(arrowText = '↧') {
    const toggleSizeEl = document.createElement('div');
    // factor out below into static method
    toggleSizeEl.classList.add('ksg-code-block-toggle');

    const ellipsis = document.createElement('span');
    ellipsis.classList.add('ellipsis');
    ellipsis.appendChild(document.createTextNode('…'));
    toggleSizeEl.appendChild(ellipsis);

    const arrow = document.createElement('span');
    arrow.classList.add('arrow');
    arrow.appendChild(document.createTextNode(arrowText));
    toggleSizeEl.appendChild(arrow);

    return toggleSizeEl;
  }

  constructor(codeblock, group, title = null, answerId = null, votes = null, accepted = null) {
    super();

    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();

    this._code = codeblock;
    this.group = group;

    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('ksg-code-block-wrapper');

    if (title !== null) {
      const topEl = document.createElement('div');
      const metaInfoEl = document.createElement('div');
      const titleEl = document.createElement('span');
      const voteEl = document.createElement('span');

      topEl.setAttribute('class', 'ksg-codeblock-group-top');
      metaInfoEl.setAttribute('class', 'ksg-codeblock-group-meta');
      titleEl.setAttribute('class', 'ksg-codeblock-group-title');
      voteEl.setAttribute('class', 'ksg-codeblock-group-vote');

      if (accepted) {
        metaInfoEl.classList.add('accepted');
      }

      const titleLink = document.createElement('a');
      const titleLinkIcon = document.createElement('span');
      titleLinkIcon.setAttribute('class', 'ksg-codeblocks-title-link-icon');
      titleLinkIcon.textContent = ' ⇗';
      this.link = `https://stackoverflow.com/a/${answerId}`;
      titleLink.href = this.link;
      titleLink.appendChild(document.createTextNode(title));
      titleLink.onclick = () => {
        const metrics = require('../../metrics');
        metrics.record('ksg_so', 'opened');
      };
      titleEl.appendChild(titleLink);
      titleEl.appendChild(titleLinkIcon);

      typeof votes === 'number' && voteEl.appendChild(document.createTextNode(`${votes} votes ${accepted ? '✓' : ''}`));

      metaInfoEl.appendChild(titleEl);
      metaInfoEl.appendChild(voteEl);
      topEl.appendChild(metaInfoEl);
      this.wrapper.appendChild(topEl);
    }

    this.codeblockEl = document.createElement('div');
    this.codeblockEl.classList.add('ksg-code-block-code');
    this._displayCode = KSGCodeBlock.truncateCode(codeblock);
    this.truncatedCode = this._displayCode;
    this.codeblockEl.appendChild(document.createTextNode(this.displayCode));

    this.subscriptions.add(
      new DisposableEvent(this.codeblockEl, 'click', e => {
        this.emitter.emit(CODEBLOCK_CLICKED, { block: this.code });
      })
    );

    this.wrapper.appendChild(this.codeblockEl);

    if (this.isTruncated) {
      this.toggleSizeEl = KSGCodeBlock.createToggleEl();
      this.instantiateToggleEl();
      this.wrapper.appendChild(this.toggleSizeEl);
    }

    this.onmouseover = () => {
      const groupParent = this.group.parent;
      const highlightedGroupIdx = groupParent.highlightedGroupIdx;
      if (highlightedGroupIdx !== null) {
        // Unhighlight currently higlighted code block
        groupParent.groups[highlightedGroupIdx].unhighlight();
      }
      // Updated codeBlockGroup's highlightedIdx
      this.group.highlightedIdx = this.id;
      // Update codeBlockGroup parent highlightedGroupIdx with codeBlockGroup position
      groupParent.highlightedGroupIdx = this.group.position;
      this.highlight();
    };

    this.appendChild(this.wrapper);
  }

  instantiateToggleEl() {
    if (this.toggleDisposableEvent) {
      this.toggleDisposableEvent.dispose();
      this.toggleDisposableEvent = null;
    }
    this.toggleDisposableEvent = new DisposableEvent(this.toggleSizeEl, 'click', e => {
      let arrowText;
      if (this.isTruncated) {
        arrowText = '↥';
        this._displayCode = this._code;
      } else {
        arrowText = '↧';
        this._displayCode = this.truncatedCode;
      }
      this.codeblockEl.textContent = this.displayCode;
      this.toggleSizeEl.parentNode && this.toggleSizeEl.parentNode.removeChild(this.toggleSizeEl);
      this.toggleSizeEl = KSGCodeBlock.createToggleEl(arrowText);
      this.instantiateToggleEl();
      this.wrapper.appendChild(this.toggleSizeEl);
    });
  }

  get isTruncated() {
    return this._code.length > this._displayCode.length;
  }

  get displayCode() {
    return this._displayCode;
  }

  get code() {
    return this._code;
  }

  makeSelection() {
    this.emitter.emit(CODEBLOCK_CLICKED, { block: this.code });
  }

  highlight() {
    this.classList.add('highlighted');
  }

  unhighlight() {
    this.classList.remove('highlighted');
  }

  onClicked(callback) {
    return this.emitter && this.emitter.on(CODEBLOCK_CLICKED, callback);
  }

  dispose() {
    this.subscriptions && this.subscriptions.dispose();
    this.emitter && this.emitter.dispose();

    this.codeblockEl && this.codeblockEl.parentNode && this.codeblockEl.parentNode.removeChild(this.codeblockEl);
    this.toggleSizeEl && this.toggleSizeEl.parentNode && this.toggleSizeEl.parentNode.removeChild(this.toggleSizeEl);
    this.wrapper && this.wrapper.parentNode && this.wrapper.parentNode.removeChild(this.wrapper);
    this.wrapper = null;
    this.codeblockEl = null;
    this.toggleSizeEl = null;
  }

  disconnectedCallback() {
    this.dispose();
  }
}

class KSGDefaultCodeBlock extends HTMLElement {
  constructor(query, group) {
    super();

    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable();
    this.query = query;
    this.group = group;

    const fragment = document.createDocumentFragment();

    const cantFindSpan = document.createElement('span');
    cantFindSpan.textContent = "Can't find what you're looking for? ";
    fragment.appendChild(cantFindSpan);

    const searchForSpan = document.createElement('span');
    searchForSpan.textContent = 'Search for ';
    fragment.appendChild(searchForSpan);

    const queryEl = document.createElement('span');
    queryEl.textContent = this.query;
    queryEl.classList.add('query');
    fragment.appendChild(queryEl);

    const onGoogleSpan = document.createElement('span');
    onGoogleSpan.textContent = ' on Google ⇗';
    fragment.appendChild(onGoogleSpan);

    this.appendChild(fragment);

    this.onmouseover = () => {
      const groupParent = this.group.parent;
      const highlightedGroupIdx = groupParent.highlightedGroupIdx;
      if (highlightedGroupIdx) {
        // Unhighlight currently higlighted code block
        groupParent.groups[highlightedGroupIdx].unhighlight();
      }
      // Updated codeBlockGroup's highlightedIdx
      this.group.highlightedIdx = this.id;
      // Update codeBlockGroup parent highlightedGroupIdx with codeBlockGroup position
      groupParent.highlightedGroupIdx = this.group.position;
      this.highlight();
    };

    this.subscriptions.add(new DisposableEvent(this, 'click', this.clickHandler));

    this.query = query;
  }

  // what methods of KSGCodeblock does this need to implement?
  clickHandler(e) {
    const query = !this.query.toLowerCase().includes('python') ? `python ${this.query}` : this.query;
    this.emitter.emit(CODEBLOCK_CLICKED, { query: query });
  }

  onClicked(callback) {
    return this.emitter && this.emitter.on(CODEBLOCK_CLICKED, callback);
  }

  unhighlight() {
    this.classList.remove('highlighted');
  }

  highlight() {
    this.classList.add('highlighted');
  }

  makeSelection() {
    this.emitter.emit(CODEBLOCK_CLICKED, { query: this.query });
  }

  dispose() {
    this.emitter && this.emitter.dispose();
    this.subscriptions && this.subscriptions.dispose();
  }
}

customElements.define('kite-ksg-loading-block', KSGLoadingBlock);
customElements.define('kite-ksg-code-block', KSGCodeBlock);
customElements.define('kite-ksg-default-code-block', KSGDefaultCodeBlock);
customElements.define('kite-ksg-code-block-group', KSGCodeBlockGroup);
customElements.define('kite-ksg-code-blocks', KSGCodeBlocks);

module.exports = {
  KSGCodeBlocks,
  KSGCodeBlockGroup,
  KSGCodeBlock,
};
