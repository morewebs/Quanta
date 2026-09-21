import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Strikethrough, Table, TaskList } from '@lezer/markdown';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import type { FontMode, NoteFile } from '../vault/types';
import { findHeadingPosition } from '../vault/wikilinks';
import { livePreviewPlugin } from './live-preview';
import { editorTheme } from './theme';
import { wikilinkAutocomplete, wikilinkConfigFacet, wikilinkDecoratorPlugin } from './wikilink';

interface Props {
  note: NoteFile | null;
  onChange: (content: string) => void;
  existingTitles: Set<string>;
  notes: Array<{ title: string; relativePath: string }>;
  onNavigate: (target: string, heading?: string) => void;
  heading?: string | null;
  fontMode: FontMode;
  fullWidth: boolean;
  rtl: boolean;
  onStats: (stats: { words: number; chars: number }) => void;
}

export function Editor({
  note,
  onChange,
  existingTitles,
  notes,
  onNavigate,
  heading,
  fontMode,
  fullWidth,
  rtl,
  onStats,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const wikiComp = useRef(new Compartment());
  const widthComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onStatsRef = useRef(onStats);
  onChangeRef.current = onChange;
  onStatsRef.current = onStats;

  const reportStats = (text: string) => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    onStatsRef.current({ words, chars });
  };

  useEffect(() => {
    if (!parentRef.current || !note) return;
    const start = note.content;
    reportStats(start);
    const view = new EditorView({
      state: EditorState.create({
        doc: start,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage, extensions: [Table, TaskList, Strikethrough] }),
          EditorView.lineWrapping,
          editorTheme,
          livePreviewPlugin,
          wikiComp.current.of(wikilinkConfigFacet.of({ existingTitles, notes, onNavigate })),
          wikilinkDecoratorPlugin,
          wikilinkAutocomplete(),
          widthComp.current.of(
            EditorView.theme({
              '.cm-content': { maxWidth: fullWidth ? '100% !important' : '72ch' },
            }),
          ),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              const text = u.state.doc.toString();
              reportStats(text);
              onChangeRef.current(text);
            }
          }),
        ],
      }),
      parent: parentRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.relative_path]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !note) return;
    const current = view.state.doc.toString();
    if (current !== note.content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: note.content } });
      reportStats(note.content);
    }
  }, [note?.content, note]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wikiComp.current.reconfigure(wikilinkConfigFacet.of({ existingTitles, notes, onNavigate })),
    });
  }, [existingTitles, notes, onNavigate]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: widthComp.current.reconfigure(
        EditorView.theme({
          '.cm-content': { maxWidth: fullWidth ? '100% !important' : '72ch' },
        }),
      ),
    });
  }, [fullWidth]);

  useEffect(() => {
    if (!heading || !viewRef.current || !note) return;
    const pos = findHeadingPosition(note.content, heading);
    if (pos === null) return;
    viewRef.current.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  }, [heading, note?.relative_path, note]);

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
        <div className="max-w-sm px-6">
          <p className="text-[var(--text)] mb-1">Open a note</p>
          <p className="text-sm mb-4">Pick a file from the tree, or press Ctrl+K to search.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto font-mode-${fontMode} ${rtl ? '' : 'disable-auto-rtl'}`}>
      <div ref={parentRef} />
    </div>
  );
}
