import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { Facet } from '@codemirror/state';
import { extractWikilinks, normalizeNoteTitle } from '../vault/wikilinks';

export interface WikilinkConfig {
  existingTitles: Set<string>;
  notes: Array<{ title: string; relativePath: string }>;
  onNavigate: (target: string, heading?: string) => void;
}

export const wikilinkConfigFacet = Facet.define<WikilinkConfig, WikilinkConfig>({
  combine: (values) => values[values.length - 1],
});

function buildWikilinkDecos(view: EditorView): DecorationSet {
  const cfg = view.state.facet(wikilinkConfigFacet);
  if (!cfg) return Decoration.none;
  const decorations: Range<Decoration>[] = [];
  const sel = view.state.selection.main;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const offset = from;
    for (const link of extractWikilinks(text)) {
      const start = offset + link.from;
      const end = offset + link.to;
      const editing = Math.max(sel.from, start) <= Math.min(sel.to, end);
      if (editing) continue;
      const exists = cfg.existingTitles.has(normalizeNoteTitle(link.targetNote));
      decorations.push(
        Decoration.mark({
          class: exists ? 'cm-wikilink' : 'cm-wikilink-missing',
          attributes: {
            'data-wiki-target': link.targetNote,
            'data-wiki-heading': link.headingAnchor || '',
          },
        }).range(start, end),
      );
    }
  }
  return Decoration.set(decorations, true);
}

export const wikilinkDecoratorPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildWikilinkDecos(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildWikilinkDecos(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement | null;
        const link = target?.closest('[data-wiki-target]') as HTMLElement | null;
        if (!link) return false;
        if (!(event.ctrlKey || event.metaKey) && event.button === 0) {
          // plain click also follows — this is a notes app, not an IDE
        }
        const cfg = view.state.facet(wikilinkConfigFacet);
        const name = link.getAttribute('data-wiki-target') || '';
        const heading = link.getAttribute('data-wiki-heading') || undefined;
        cfg?.onNavigate(name, heading || undefined);
        event.preventDefault();
        return true;
      },
    },
  },
);

export function wikilinkAutocomplete() {
  return autocompletion({
    override: [
      (context: CompletionContext) => {
        const cfg = context.state.facet(wikilinkConfigFacet);
        if (!cfg) return null;
        const match = context.matchBefore(/\[\[\w*[^\[\]]*$/);
        if (!match) return null;
        const query = match.text.replace(/^\[\[/, '').toLowerCase();
        return {
          from: match.from + 2,
          options: cfg.notes
            .filter((n) => n.title.toLowerCase().includes(query))
            .slice(0, 20)
            .map((n) => ({
              label: n.title,
              type: 'text',
              detail: n.relativePath,
            })),
        };
      },
    ],
  });
}
