import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--text)',
  },
  '.cm-content': {
    caretColor: 'var(--text)',
    fontFamily: 'inherit',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--text)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'hsl(32 18% 50% / 0.22)',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
});
