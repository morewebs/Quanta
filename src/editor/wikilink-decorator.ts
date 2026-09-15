import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Range, Facet } from '@codemirror/state';
import { extractWikilinks, normalizeNoteTitle } from '../lib/wikilinks';

export interface WikilinkConfig {
  existingTitles: Set<string>;
  onNavigate: (targetNote: string, headingAnchor?: string) => void;
}

export const wikilinkConfigFacet = Facet.define<WikilinkConfig, WikilinkConfig>({
  combine: (values) => values[values.length - 1] || { existingTitles: new Set(), onNavigate: () => {} },
});

class WikilinkWidget extends WidgetType {
  constructor(
    readonly targetNote: string,
    readonly displayText: string,
    readonly isResolved: boolean,
    readonly headingAnchor?: string,
    readonly onNavigate?: (targetNote: string, headingAnchor?: string) => void
  ) {
    super();
  }

  eq(other: WikilinkWidget): boolean {
    return (
      this.targetNote === other.targetNote &&
      this.displayText === other.displayText &&
      this.isResolved === other.isResolved &&
      this.headingAnchor === other.headingAnchor
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement('bdi');
    el.className = this.isResolved ? 'cm-wikilink' : 'cm-wikilink-unresolved';
    el.textContent = this.displayText;
    el.title = this.isResolved
      ? `Jump to ${this.targetNote}${this.headingAnchor ? ` > ${this.headingAnchor}` : ''}`
      : `Create note: "${this.targetNote}.md"`;

    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onNavigate?.(this.targetNote, this.headingAnchor);
    });

    return el;
  }
}

function buildWikilinkDecorations(view: EditorView): DecorationSet {
  const config = view.state.facet(wikilinkConfigFacet);
  const decorations: Range<Decoration>[] = [];
  const selection = view.state.selection.main;
  const cursorHead = selection.head;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    const matches = extractWikilinks(text);

    for (const match of matches) {
      const matchFrom = from + match.from;
      const matchTo = from + match.to;

      // If cursor is inside the wikilink token, do not conceal (allow editing)
      const cursorInside = cursorHead >= matchFrom && cursorHead <= matchTo;
      if (cursorInside) {
        continue;
      }

      const isResolved = config.existingTitles.has(normalizeNoteTitle(match.targetNote));
      const displayText = match.alias || (match.headingAnchor ? `${match.targetNote}#${match.headingAnchor}` : match.targetNote);

      decorations.push(
        Decoration.replace({
          widget: new WikilinkWidget(
            match.targetNote,
            displayText,
            isResolved,
            match.headingAnchor,
            config.onNavigate
          ),
        }).range(matchFrom, matchTo)
      );
    }
  }

  return Decoration.set(decorations, true);
}

export const wikilinkDecoratorPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildWikilinkDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.state.facet(wikilinkConfigFacet) !== update.startState.facet(wikilinkConfigFacet)
      ) {
        this.decorations = buildWikilinkDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
