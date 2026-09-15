import {
  CompletionContext,
  CompletionResult,
  autocompletion,
} from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';

export interface AutocompleteNoteItem {
  title: string;
  relativePath: string;
}

export function createWikilinkAutocomplete(
  getNotes: () => AutocompleteNoteItem[]
): Extension {
  const wikilinkCompletionSource = (
    context: CompletionContext
  ): CompletionResult | null => {
    // Look backwards from cursor for '[['
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text.slice(0, context.pos - line.from);

    const match = textBefore.match(/\[\[([^\]|#]*)$/);
    if (!match || match.index === undefined) {
      return null;
    }

    const query = match[1].toLowerCase();
    const triggerStart = line.from + match.index + 2; // start after '[['

    const notes = getNotes();
    const options = notes
      .filter((note) => {
        const titleMatch = note.title.toLowerCase().includes(query);
        const pathMatch = note.relativePath.toLowerCase().includes(query);
        return titleMatch || pathMatch;
      })
      .map((note) => {
        return {
          label: note.title,
          detail: note.relativePath !== note.title + '.md' ? note.relativePath : '',
          type: 'keyword',
          apply: (view: any, completion: any, from: number, to: number) => {
            // Check if there is already a closing ']]' right after the cursor
            const textAfter = context.state.doc.sliceString(to, to + 2);
            const insertText = textAfter === ']]' ? completion.label : `${completion.label}]]`;
            view.dispatch({
              changes: { from, to, insert: insertText },
              selection: { anchor: from + insertText.length },
            });
          },
        };
      });

    return {
      from: triggerStart,
      options,
      filter: false, // We already filtered with fuzzy/substring
    };
  };

  return autocompletion({
    override: [wikilinkCompletionSource],
    defaultKeymap: true,
  });
}
