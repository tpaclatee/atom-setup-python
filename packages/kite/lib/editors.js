'use strict';

const { CompositeDisposable } = require('atom');
const { flatten, compact } = require('./utils');
const KiteEditor = require('./kite-editor');
const KiteAPI = require('kite-api');

const EXTENSIONS_BY_LANGUAGES = {
  bash: [
    'sh',
  ],
  c: [
    'c',
    'h',
  ],
  cpp: [
    'cc',
    'cpp',
    'hpp',
  ],
  csharp: [
    'cs',
  ],
  css: [
    'css',
  ],
  go: [
    'go',
  ],
  html: [
    'html',
  ],
  java: [
    'java',
  ],
  javascript: [
    'js',
    'jsx',
    'vue',
  ],
  kotlin: [
    'kt',
  ],
  less: [
    'less',
  ],
  objectivec: [
    'm',
  ],
  php: [
    'php',
  ],
  python: [
    'py',
    'pyw',
  ],
  ruby: [
    'rb',
  ],
  scala: [
    'scala',
  ],
  typescript: [
    'ts',
    'tsx',
  ],
};

const SUPPORTED_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'kotlin',
  'less',
  'objectivec',
  'php',
  'python',
  'ruby',
  'scala',
  'typescript',
];

module.exports = class KiteEditors {
  init(kite) {
    this.Kite = kite;
    this.subscriptions = new CompositeDisposable();
    this.kiteEditorByEditorID = [];
    this.pathSubscriptionsByEditorID = {};

    this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
      // The grammar is known and supported, we can subscribe to that editor
      if (this.isGrammarSupported(editor)) {
        this.subscribeToEditor(editor);
      }

      // We still want to know when an editor path changes so we can check
      // if it is now supported/unsupported
      if (!this.pathSubscriptionsByEditorID[editor.id]) {
        const sub = new CompositeDisposable();
        const dispose = () => {
          sub.dispose();
          delete this.pathSubscriptionsByEditorID[editor.id];
          this.subscriptions.remove(sub);
        };
        this.subscriptions.add(sub);

        sub.add(editor.onDidChangePath(() => {
          if (this.isGrammarSupported(editor)) {
            this.subscribeToEditor(editor);
          } else if (this.hasEditorSubscription(editor)) {
            this.unsubscribeFromEditor(editor);
          }
        }));

        sub.add(editor.onDidDestroy(() => dispose()));

        this.pathSubscriptionsByEditorID[editor.id] = sub;
      }
    }));

    this.subscriptions.add(atom.workspace.observeActiveTextEditor((editor) => {
      KiteAPI.getMaxFileSizeBytes().then(max => {
        this.Kite.maxFileSize = max;
      });
    }));
  }

  dispose() {
    delete this.kiteEditorByEditorID;
    this.subscriptions && this.subscriptions.dispose();
  }

  subscribeToEditor(editor) {
    // We don't want to subscribe twice to the same editor
    if (!this.hasEditorSubscription(editor)) {
      const kiteEditor = new KiteEditor(editor);
      this.kiteEditorByEditorID[editor.id] = kiteEditor;

      this.subscriptions.add(kiteEditor);

      const disposable = editor.onDidDestroy(() => {
        this.unsubscribeFromEditor(editor);
        this.subscriptions.remove(disposable);
      });

      this.subscriptions.add(disposable);
    }
  }

  unsubscribeFromEditor(editor) {
    if (!this.hasEditorSubscription(editor)) { return; }

    const kiteEditor = this.kiteEditorByEditorID[editor.id];
    kiteEditor.dispose();
    this.subscriptions.remove(kiteEditor);
    delete this.kiteEditorByEditorID[editor.id];
  }

  hasEditorSubscription(editor) {
    return this.kiteEditorForEditor(editor) != null;
  }

  kiteEditorForEditor(editor) {
    return editor && this.kiteEditorByEditorID && this.kiteEditorByEditorID[editor.id];
  }

  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  hasSupportedFileOpen() {
    return atom.workspace.getTextEditors().some((e) => this.isGrammarSupported(e));
  }

  hasActiveSupportedFile() {
    const editor = atom.workspace.getActiveTextEditor();
    return editor && this.isGrammarSupported(editor);
  }

  isGrammarSupported(editor) {
    return editor && (
      new RegExp(this.getSupportedLanguagesRegExp(this.getSupportedLanguages()))
        .test(editor.getPath() || '')
    );
  }

  getSupportedLanguagesRegExp(languages) {
    return `\.(${compact(flatten(languages.map(l => EXTENSIONS_BY_LANGUAGES[l]))).join('|')})$`;
  }

  getEditorsForPath(path) {
    return atom.workspace.getPaneItems().filter(i => i && i.getURI && i.getURI() === path);
  }
};
