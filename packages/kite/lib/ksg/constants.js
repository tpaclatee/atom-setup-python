'use strict';

const CODEBLOCKS_ADD = 'did-codeblocks-add-all';
const CODEBLOCK_CLICKED = 'did-codeblock-get-clicked';
const CODEBLOCKS_SELECTED = 'did-codeblocks-get-selected';
const CODEBLOCKS_DEFAULT_SELECTED = 'did-codeblocks-default-get-selected';
const CODEBLOCKS_SELECTION_EVENT = 'did-codeblocks-selection-event';
const DEFAULT_CODEBLOCKS_SELECTION_EVENT = 'did-default-codeblocks-selection-event';
const CODEBLOCKS_LOADING = 'did-codeblocks-loading';

const CODEBLOCK_LINE_LIMIT = 10;

const SEARCH_QUERY_EVENT = 'did-search-query-event';
const SEARCH_LOADING = 'did-search-loading';

const SEARCH_QUERY_SELECTION_EVENT = 'did-search-query-selected-event';
const DEFAULT_QUERY_SELECTION_EVENT = 'did-default-search-query-selection-event';

const CODEBLOCKS_EVENT = 'did-codeblocks-event';
const SEARCH_EVENT = 'did-search-event';

const CODEBLOCKS_MODEL_UPDATE = 'did-codeblocks-model-update';
const SEARCH_MODEL_UPDATE = 'did-search-model-update';

const SEARCH_DEBOUNCE = 200; //ms

const SEARCH_NAV_UP = -1;
const SEARCH_NAV_DOWN = 1;
const CODEBLOCKS_NAV_UP = -1;
const CODEBLOCKS_NAV_DOWN = 1;

const KSG_NAV_UP_EVENT = 'did-nav-up-event';
const KSG_NAV_DOWN_EVENT = 'did-nav-down-event';
const KSG_SELECTION_EVENT = 'did-select-event';

module.exports = {
  CODEBLOCKS_ADD,
  CODEBLOCK_CLICKED,
  CODEBLOCKS_SELECTED,
  CODEBLOCKS_DEFAULT_SELECTED,
  CODEBLOCKS_SELECTION_EVENT,
  CODEBLOCKS_LOADING,
  CODEBLOCK_LINE_LIMIT,
  SEARCH_QUERY_EVENT,
  SEARCH_LOADING,
  SEARCH_QUERY_SELECTION_EVENT,
  DEFAULT_QUERY_SELECTION_EVENT,
  DEFAULT_CODEBLOCKS_SELECTION_EVENT,
  CODEBLOCKS_EVENT,
  SEARCH_EVENT,
  CODEBLOCKS_MODEL_UPDATE,
  SEARCH_MODEL_UPDATE,
  SEARCH_DEBOUNCE,
  SEARCH_NAV_DOWN,
  SEARCH_NAV_UP,
  CODEBLOCKS_NAV_UP,
  CODEBLOCKS_NAV_DOWN,
  KSG_NAV_UP_EVENT,
  KSG_NAV_DOWN_EVENT,
  KSG_SELECTION_EVENT,
};
