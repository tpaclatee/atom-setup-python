'use strict';

const { Emitter } = require('atom');

const { SEARCH_MODEL_UPDATE, SEARCH_LOADING } = require('./constants');
const { getKSGCompletions } = require('../data-loader');

module.exports = class Search {
  static scrubPrependedPython(term) {
    return term.substring(term.toLowerCase().indexOf('python ') + 'python '.length);
  }

  constructor() {
    this.emitter = new Emitter();
  }

  dispose() {
    this.emitter && this.emitter.dispose();
  }

  onDidUpdate(callback) {
    return this.emitter.on(SEARCH_MODEL_UPDATE, callback);
  }

  onDidLoading(callback) {
    return this.emitter.on(SEARCH_LOADING, callback);
  }

  executeQuery({ query }) {
    if (!query || query.length === 0) {
      this.emitter.emit(SEARCH_MODEL_UPDATE, {});
      return;
    }
    // make sure results include only python related stuff
    let newQuery = query;
    if (!query.includes('python')) {
      newQuery = `python ${query}`;
    }
    this.emitter.emit(SEARCH_LOADING);
    getKSGCompletions(newQuery).then(data => {
      if (!data) {
        this.emitter.emit(SEARCH_MODEL_UPDATE, { payload: 'error' });
        return;
      }
      // scrub preceding pythons from the data
      data.query = query;
      if (data.completions) {
        data.completions = data.completions.map(completion => {
          if (completion.toLowerCase().startsWith('python ')) {
            return Search.scrubPrependedPython(completion);
          }
          return completion;
        });
      }
      this.emitter.emit(SEARCH_MODEL_UPDATE, { payload: 'search model update', data });
    });
  }
};
