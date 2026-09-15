import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const precisionDarkTheme = EditorView.theme(
  {
    '&': {
      color: '#e4e4e7',
      backgroundColor: '#09090b',
      fontSize: '15px',
      lineHeight: '1.75',
    },
    '.cm-content': {
      caretColor: '#38bdf8',
      maxWidth: '72ch',
      margin: '0 auto',
      padding: '2.5rem 1.5rem 12rem 1.5rem',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#38bdf8',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#27272a !important',
    },
    '.cm-panels': {
      backgroundColor: '#09090b',
      color: '#e4e4e7',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid #27272a',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid #27272a',
    },
    '.cm-searchMatch': {
      backgroundColor: '#3f3f46',
      outline: '1px solid #71717a',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#0284c7',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(39, 39, 42, 0.35)',
      borderRadius: '4px',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#27272a',
    },
    // Markdown specific typography styling
    '.cm-header-1': {
      fontSize: '1.85rem',
      fontWeight: '700',
      color: '#fafafa',
      lineHeight: '1.3',
    },
    '.cm-header-2': {
      fontSize: '1.45rem',
      fontWeight: '600',
      color: '#f4f4f5',
      lineHeight: '1.35',
    },
    '.cm-header-3': {
      fontSize: '1.2rem',
      fontWeight: '600',
      color: '#e4e4e7',
      lineHeight: '1.4',
    },
    '.cm-header-4, .cm-header-5, .cm-header-6': {
      fontSize: '1.05rem',
      fontWeight: '600',
      color: '#d4d4d8',
    },
    '.cm-strong': {
      fontWeight: '600',
      color: '#fafafa',
    },
    '.cm-emphasis': {
      fontStyle: 'italic',
      color: '#e4e4e7',
    },
    '.cm-inline-code': {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.875em',
      backgroundColor: '#18181b',
      color: '#38bdf8',
      padding: '0.15rem 0.35rem',
      borderRadius: '4px',
      border: '1px solid #27272a',
    },
    '.cm-code-block': {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.875rem',
      backgroundColor: '#121215',
      border: '1px solid #27272a',
      borderRadius: '6px',
      padding: '0.5rem 0.75rem',
      margin: '0.5rem 0',
      color: '#e4e4e7',
    },
    '.cm-blockquote': {
      borderInlineStart: '3px solid #a855f7',
      borderInlineEnd: 'none',
      paddingInlineStart: '1rem',
      paddingInlineEnd: '0.5rem',
      color: '#d4d4d8',
      margin: '0.5rem 0',
    },
    // Wikilink styles
    '.cm-wikilink': {
      color: '#38bdf8',
      fontWeight: '500',
      textDecoration: 'none',
      cursor: 'pointer',
      padding: '0.05rem 0.3rem',
      borderRadius: '3px',
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
      transition: 'background-color 0.15s ease, color 0.15s ease',
    },
    '.cm-wikilink:hover': {
      backgroundColor: 'rgba(56, 189, 248, 0.18)',
      textDecoration: 'underline',
    },
    '.cm-wikilink-unresolved': {
      color: '#a1a1aa',
      textDecoration: 'underline',
      textDecorationStyle: 'dashed',
      textUnderlineOffset: '3px',
      opacity: '0.8',
      cursor: 'pointer',
      padding: '0.05rem 0.3rem',
      borderRadius: '3px',
      backgroundColor: 'rgba(161, 161, 170, 0.08)',
    },
    '.cm-wikilink-unresolved:hover': {
      opacity: '1',
      color: '#e4e4e7',
      backgroundColor: 'rgba(161, 161, 170, 0.15)',
    },
    // Autocomplete tooltip
    '.cm-tooltip-autocomplete': {
      backgroundColor: '#18181b !important',
      border: '1px solid #27272a !important',
      borderRadius: '6px !important',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important',
      padding: '4px !important',
    },
    '.cm-tooltip-autocomplete ul li': {
      padding: '6px 10px !important',
      borderRadius: '4px !important',
      color: '#d4d4d8 !important',
      fontSize: '13px !important',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: '#27272a !important',
      color: '#ffffff !important',
    },
  },
  { dark: true }
);

export const precisionHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, class: 'cm-header-1' },
  { tag: t.heading2, class: 'cm-header-2' },
  { tag: t.heading3, class: 'cm-header-3' },
  { tag: [t.heading4, t.heading5, t.heading6], class: 'cm-header-4' },
  { tag: t.strong, class: 'cm-strong' },
  { tag: t.emphasis, class: 'cm-emphasis' },
  { tag: t.monospace, class: 'cm-inline-code' },
  { tag: t.quote, class: 'cm-blockquote' },
  { tag: t.link, color: '#38bdf8' },
  { tag: t.url, color: '#71717a' },
  { tag: t.comment, color: '#52525b', fontStyle: 'italic' },
  { tag: t.keyword, color: '#f472b6' },
  { tag: t.string, color: '#4ade80' },
  { tag: t.number, color: '#fb923c' },
  { tag: t.variableName, color: '#e4e4e7' },
]);

export function precisionThemeExtension(): Extension[] {
  return [precisionDarkTheme, syntaxHighlighting(precisionHighlightStyle)];
}
