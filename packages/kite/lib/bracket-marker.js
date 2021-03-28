const {CompositeDisposable} = require('atom')
const _ = require('lodash')

const BracketPairs = ['()', '[]', '{}', '""', "''", '``', '“”', '‘’', '«»', '‹›'];
const ClosingBrackets = new Set(BracketPairs.map(x => x[1]));

module.exports =
class BracketMarker {
  init() {
    this.bracketMarkersByEditorID = {};
    const observe = atom.workspace.observeTextEditors(editor => {
      if (!this.bracketMarkersByEditorID[editor.id]) {
        this.bracketMarkersByEditorID[editor.id] = [];
        editor.onDidDestroy(() => { delete this.bracketMarkersByEditorID[editor.id]; });
        editor.onWillInsertText((event) => { this.checkShouldSkipClosingBracket(event, editor); });
      }
    });
    
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(observe);
  }

  processTextForWriteThrough(text, editor, cursorPosBeforeInsert) {
    /* Marks the brackets as 'write-through-able' after an insertion. */
    if (!this.bracketMarkersByEditorID || _.isEmpty(this.bracketMarkersByEditorID)) {
      return;
    }

    const bracketMarkers = this.bracketMarkersByEditorID[editor.id];
    // Uninitialized edtior won't check to skip closing brackets; pointless to mark.
    if (!bracketMarkers) return;

    for (let i = 1; i < text.length; i++) {
      if (this.isClosingBracket(text.charAt(i))) {
        const range = [cursorPosBeforeInsert.traverse([0, i - 1]), cursorPosBeforeInsert.traverse([0, i])];
        const marker = editor.markBufferRange(range);
        marker.onDidDestroy(() => _.remove(bracketMarkers, marker));
        bracketMarkers.push(marker);
      }
    }
  }

  checkShouldSkipClosingBracket(event, editor) {
    /* Based off https://github.com/atom/bracket-matcher/blob/master/lib/bracket-matcher.js#L83 */
    if (!this.bracketMarkersByEditorID || _.isEmpty(this.bracketMarkersByEditorID)) {
      return;
    }

    const text = event.text;
    const bracketMarkers = this.bracketMarkersByEditorID[editor.id];

    if (!bracketMarkers || bracketMarkers.length === 0) return;

    const cursorBufferPosition = editor.getCursorBufferPosition();
    const previousCharacters = editor.getTextInBufferRange([[cursorBufferPosition.row, 0], cursorBufferPosition]);
    const nextCharacter = editor.getTextInBufferRange([cursorBufferPosition, cursorBufferPosition.traverse([0, 1])]);
    const hasEscapeCharacterBeforeCursor = endsWithEscapeCharacter(previousCharacters);

    if (this.isClosingBracket(text) && (nextCharacter === text) && !hasEscapeCharacterBeforeCursor) {
      let bracketMarker = bracketMarkers.find(marker =>  marker.isValid() && marker.getBufferRange().end.isEqual(cursorBufferPosition));

      if (bracketMarker) {
        bracketMarker.destroy();
        editor.moveRight();
        event.cancel();
      }
    }
  }

  isClosingBracket(string) {
    return ClosingBrackets.has(string);
  }

  dispose() {
    this.subscriptions && this.subscriptions.dispose();
    delete this.bracketMarkersByEditorID;
  }
};

const BACKSLASHES_REGEX = /(\\+)$/;

// odd number of backslashes
function endsWithEscapeCharacter(string) {
  const backslashesMatch = string.match(BACKSLASHES_REGEX);
  return backslashesMatch && backslashesMatch[1].length % 2 === 1;
}
