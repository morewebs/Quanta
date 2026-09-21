import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.from === other.from;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement('span');
    wrap.className = 'cm-checkbox-wrap';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.addEventListener('mousedown', (e) => e.preventDefault());
    input.addEventListener('change', () => {
      const next = this.checked ? ' ' : 'x';
      const inner = view.state.doc.sliceString(this.from, this.to);
      const replaced = inner.replace(/\[[ xX]\]/, `[${next}]`);
      view.dispatch({ changes: { from: this.from, to: this.to, insert: replaced } });
    });
    wrap.appendChild(input);
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'cm-hr';
    return hr;
  }
}

const RTL_REGEX = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

export function isRtlLine(text: string): boolean {
  const stripped = text.replace(/^[\s#>*\-+.`[\]!]+/, '').trim();
  if (!stripped) return false;
  return RTL_REGEX.test(stripped[0]);
}

function overlaps(from: number, to: number, selFrom: number, selTo: number) {
  return Math.max(from, selFrom) <= Math.min(to, selTo);
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const sel = view.state.selection.main;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (isRtlLine(line.text)) {
        decorations.push(
          Decoration.line({ class: 'cm-rtl-line', attributes: { dir: 'rtl' } }).range(line.from),
        );
      }
      if (line.text.trim() === '---' || line.text.trim() === '***') {
        if (!overlaps(line.from, line.to, sel.from, sel.to)) {
          decorations.push(Decoration.replace({ widget: new HrWidget() }).range(line.from, line.to));
        }
      }
      pos = line.to + 1;
    }
  }

  syntaxTree(view.state).iterate({
    enter(node) {
      const name = node.name;
      if (name.startsWith('ATXHeading') || name.startsWith('SetextHeading')) {
        const level = Number(name.replace(/\D/g, '')) || 1;
        decorations.push(
          Decoration.line({ class: `cm-header-line cm-header-line-${level}` }).range(
            view.state.doc.lineAt(node.from).from,
          ),
        );
      }

      const editing = overlaps(node.from, node.to, sel.from, sel.to);

      if (
        (name === 'HeaderMark' ||
          name === 'EmphasisMark' ||
          name === 'CodeMark' ||
          name === 'QuoteMark' ||
          name === 'StrikethroughMark' ||
          name === 'LinkMark') &&
        !editing
      ) {
        const parent = node.node.parent;
        if (parent && !overlaps(parent.from, parent.to, sel.from, sel.to)) {
          decorations.push(Decoration.replace({}).range(node.from, node.to));
        }
      }

      if (name === 'StrongEmphasis' && !editing) {
        decorations.push(Decoration.mark({ class: 'cm-strong' }).range(node.from, node.to));
      }
      if (name === 'Emphasis' && !editing) {
        decorations.push(Decoration.mark({ class: 'cm-emphasis' }).range(node.from, node.to));
      }
      if (name === 'InlineCode' && !editing) {
        decorations.push(Decoration.mark({ class: 'cm-inline-code' }).range(node.from, node.to));
      }
      if (name === 'Blockquote') {
        decorations.push(
          Decoration.line({ class: 'cm-callout-line' }).range(view.state.doc.lineAt(node.from).from),
        );
      }
      if (name === 'TaskMarker' && !editing) {
        const text = view.state.doc.sliceString(node.from, node.to);
        const checked = /\[[xX]\]/.test(text);
        decorations.push(
          Decoration.replace({
            widget: new CheckboxWidget(checked, node.from, node.to),
          }).range(node.from, node.to),
        );
      }
    },
  });

  return Decoration.set(decorations, true);
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
