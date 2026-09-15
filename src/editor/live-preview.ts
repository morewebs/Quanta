import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Range } from '@codemirror/state';

class CheckboxWidget extends WidgetType {
  checked: boolean;
  pos: number;

  constructor(checked: boolean, pos: number) {
    super();
    this.checked = checked;
    this.pos = pos;
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.pos === other.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-checkbox-wrap inline-flex items-center align-middle mr-2 cursor-pointer select-none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className =
      'rounded bg-zinc-800 border-zinc-600 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer h-4 w-4 transition-colors';

    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const nextChar = this.checked ? ' ' : 'x';
      view.dispatch({
        changes: { from: this.pos + 3, to: this.pos + 4, insert: nextChar },
      });
    });

    wrap.appendChild(input);
    return wrap;
  }
}

class HrWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'border-zinc-800 my-4 select-none';
    return hr;
  }
}

class CalloutHeaderWidget extends WidgetType {
  type: string;
  title: string;

  constructor(type: string, title: string) {
    super();
    this.type = type;
    this.title = title;
  }

  eq(other: CalloutHeaderWidget): boolean {
    return this.type === other.type && this.title === other.title;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className =
      'cm-callout-header inline-flex items-center space-x-1.5 font-semibold text-xs tracking-wide uppercase mr-2 select-none text-zinc-200';
    const icon = document.createElement('span');
    icon.className = 'mr-1.5 opacity-90';
    icon.textContent =
      this.type === 'quote'
        ? '❝'
        : this.type === 'tip' || this.type === 'check'
        ? '💡'
        : this.type === 'warning' || this.type === 'caution'
        ? '⚠️'
        : 'ℹ️';

    const label = document.createElement('bdi');
    label.textContent = this.title ? this.title : this.type;

    wrap.appendChild(icon);
    wrap.appendChild(label);
    return wrap;
  }
}

// RTL Unicode range: Arabic, Persian, Hebrew, etc.
const RTL_REGEX = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

export function isRtlLine(text: string): boolean {
  const stripped = text
    .replace(/^(\s*([#>*\-+|\d.]|\[[ xX]?\]|\(.*?\)|:[a-z0-9_]+:|\p{Extended_Pictographic}|\p{P}|\p{S}))+/u, '')
    .trim();
  if (!stripped) return false;
  return RTL_REGEX.test(stripped[0]);
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const selection = view.state.selection.main;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const lineClasses: string[] = [];
      const lineAttrs: Record<string, string> = {};

      // 0. Line direction: RTL detection
      if (isRtlLine(text)) {
        lineClasses.push('cm-rtl-line');
        lineAttrs.dir = 'rtl';
      }

      // 1. Callout detection: > [!type] or standard blockquote >
      const calloutMatch = text.match(/^>\s*\[!([a-zA-Z]+)\]\s*(.*)$/);
      if (calloutMatch) {
        const type = calloutMatch[1].toLowerCase();
        const title = calloutMatch[2].trim();
        lineClasses.push(`cm-callout-line cm-callout-${type}`);
        const prefixEnd = line.from + text.indexOf(calloutMatch[2]);
        const isEditingCallout = selection.head >= line.from && selection.head <= (title ? prefixEnd : line.to);
        if (!isEditingCallout) {
          decorations.push(
            Decoration.replace({
              widget: new CalloutHeaderWidget(type, title),
            }).range(line.from, title ? prefixEnd : line.to)
          );
        }
      } else if (text.startsWith('>')) {
        lineClasses.push('cm-callout-line cm-callout-quote');
        const quotePrefix = text.match(/^>\s*/);
        if (quotePrefix) {
          const prefixLen = quotePrefix[0].length;
          const isEditingQuotePrefix = selection.head >= line.from && selection.head <= line.from + prefixLen;
          if (!isEditingQuotePrefix) {
            decorations.push(
              Decoration.replace({}).range(line.from, line.from + prefixLen)
            );
          }
        }
      }

      // 2. Headings: #, ##, ###, etc.
      const headingMatch = text.match(/^(#{1,6})\s+/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        lineClasses.push(`cm-header-line cm-header-line-${level}`);
        const hashLen = headingMatch[0].length;
        // Only reveal hashes if cursor is directly touching the leading hashes
        const isEditingHashes = selection.head >= line.from && selection.head <= line.from + hashLen;
        if (!isEditingHashes) {
          decorations.push(
            Decoration.replace({}).range(line.from, line.from + hashLen)
          );
        }
      }

      // Apply line decoration if any classes or attributes are collected
      if (lineClasses.length > 0) {
        decorations.push(
          Decoration.line({
            class: lineClasses.join(' '),
            attributes: Object.keys(lineAttrs).length > 0 ? lineAttrs : undefined,
          }).range(line.from)
        );
      }

      // 3. Task lists: - [ ] or - [x]
      const taskMatch = text.match(/^(\s*[-*]\s+\[)([ xX])(\]\s*)/);
      if (taskMatch && taskMatch.index !== undefined) {
        const checkStart = line.from + taskMatch.index + taskMatch[1].length - 3;
        const checkEnd = line.from + taskMatch.index + taskMatch[0].length;
        const isEditingCheck = selection.head >= checkStart && selection.head <= checkEnd;
        if (!isEditingCheck) {
          const isChecked = taskMatch[2].toLowerCase() === 'x';
          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(isChecked, line.from + taskMatch.index),
            }).range(checkStart, checkEnd)
          );
        }
      }

      // 4. Horizontal rules: ---
      if (text.trim() === '---' || text.trim() === '***') {
        const isEditingHr = selection.head >= line.from && selection.head <= line.to;
        if (!isEditingHr) {
          decorations.push(
            Decoration.replace({
              widget: new HrWidget(),
            }).range(line.from, line.to)
          );
        }
      }

      // 5. Bold: **text**
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let boldMatch: RegExpExecArray | null;
      while ((boldMatch = boldRegex.exec(text)) !== null) {
        const matchStart = line.from + boldMatch.index;
        const matchEnd = matchStart + boldMatch[0].length;
        const isEditingBold = Math.max(selection.from, matchStart) <= Math.min(selection.to, matchEnd);
        if (!isEditingBold) {
          // Hide opening **
          decorations.push(Decoration.replace({}).range(matchStart, matchStart + 2));
          // Style inner text
          decorations.push(
            Decoration.mark({ class: 'cm-strong font-semibold text-zinc-100' }).range(
              matchStart + 2,
              matchEnd - 2
            )
          );
          // Hide closing **
          decorations.push(Decoration.replace({}).range(matchEnd - 2, matchEnd));
        }
      }

      // 6. Italic: *text* (excluding **)
      const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;
      let italicMatch: RegExpExecArray | null;
      while ((italicMatch = italicRegex.exec(text)) !== null) {
        const matchStart = line.from + italicMatch.index;
        const matchEnd = matchStart + italicMatch[0].length;
        const isEditingItalic = Math.max(selection.from, matchStart) <= Math.min(selection.to, matchEnd);
        if (!isEditingItalic) {
          decorations.push(Decoration.replace({}).range(matchStart, matchStart + 1));
          decorations.push(
            Decoration.mark({ class: 'cm-emphasis italic text-zinc-200' }).range(
              matchStart + 1,
              matchEnd - 1
            )
          );
          decorations.push(Decoration.replace({}).range(matchEnd - 1, matchEnd));
        }
      }

      // 7. Inline code: `text`
      const codeRegex = /(?<!`)`([^`]+)`(?!`)/g;
      let codeMatch: RegExpExecArray | null;
      while ((codeMatch = codeRegex.exec(text)) !== null) {
        const matchStart = line.from + codeMatch.index;
        const matchEnd = matchStart + codeMatch[0].length;
        const isEditingCode = Math.max(selection.from, matchStart) <= Math.min(selection.to, matchEnd);
        if (!isEditingCode) {
          decorations.push(Decoration.replace({}).range(matchStart, matchStart + 1));
          decorations.push(
            Decoration.mark({ class: 'cm-inline-code' }).range(
              matchStart + 1,
              matchEnd - 1
            )
          );
          decorations.push(Decoration.replace({}).range(matchEnd - 1, matchEnd));
        }
      }

      pos = line.to + 1;
    }
  }

  // CodeMirror requires decorations to be sorted by range 'from' ascending
  return Decoration.set(decorations, true);
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
