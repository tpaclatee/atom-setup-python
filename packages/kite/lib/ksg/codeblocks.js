'use strict';

const { Emitter } = require('atom');

const { CODEBLOCKS_MODEL_UPDATE, CODEBLOCKS_LOADING } = require('./constants');

const { getKSGCodeBlocks } = require('../data-loader');

module.exports = class Codeblocks {
  static decorateCodeblocks(blocks, link, title) {
    return `>>>>>>> HEAD: ${title}
=======
# This code was inserted by Kite.
# You may need to alter it for it to work properly.

# Source: ${link}
${blocks.join('\n# BLOCK\n')}
>>>>>>> end of Kite Snippet
`;
  }

  constructor() {
    this.emitter = new Emitter();
  }

  dispose() {
    this.emitter && this.emitter.dispose();
  }

  onDidUpdate(callback) {
    return this.emitter.on(CODEBLOCKS_MODEL_UPDATE, callback);
  }

  onDidLoading(callback) {
    return this.emitter.on(CODEBLOCKS_LOADING, callback);
  }

  executeQuery({ query }) {
    const origQuery = query;
    // make sure results include only python related stuff
    if (!query.toLowerCase().includes('python')) {
      query = `python ${query}`;
    }
    this.emitter.emit(CODEBLOCKS_LOADING);
    getKSGCodeBlocks(query).then(data => {
      if (!data) {
        this.emitter.emit(CODEBLOCKS_MODEL_UPDATE, { payload: 'error' });
        return;
      }
      // we want more votes appearing first
      if (data && data.answers) {
        data.answers = data.answers.filter(answer => {
          if (answer.votes <= 0) {
            return false;
          }
          if (!answer.code_blocks || answer.code_blocks.length === 0) {
            return false;
          }
          return true;
        });
        data.answers.sort((a, b) => b.votes - a.votes);
      }
      data.origQuery = origQuery;
      this.emitter.emit(CODEBLOCKS_MODEL_UPDATE, { payload: 'codeblocks model update', data });
    });
  }
};
