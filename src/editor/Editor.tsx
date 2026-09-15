import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { NoteFile } from '../types/vault';
import { precisionThemeExtension } from './theme';
import { livePreviewPlugin } from './live-preview';
import {
  wikilinkDecoratorPlugin,
  wikilinkConfigFacet,
} from './wikilink-decorator';
import {
  createWikilinkAutocomplete,
  AutocompleteNoteItem,
} from './wikilink-autocomplete';
import { findHeadingPosition } from '../lib/wikilinks';
import { Minimize2, Maximize2, Check } from 'lucide-react';
import { LinkedReferences } from '../components/LinkedReferences';
import { BacklinkMention, FontMode } from '../types/vault';

interface EditorProps {
  activeNote: NoteFile | null;
  onContentChange: (content: string) => void;
  existingTitles: Set<string>;
  allNotesList: AutocompleteNoteItem[];
  onNavigateWikilink: (targetNote: string, headingAnchor?: string) => void;
  isSaving: boolean;
  targetHeadingAnchor?: string | null;
  backlinks: BacklinkMention[];
  onNavigateBacklink: (sourcePath: string) => void;
  fontMode: FontMode;
  onChangeFontMode: (mode: FontMode) => void;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
  isRtlAutoDetect?: boolean;
}

export const Editor: React.FC<EditorProps> = ({
  activeNote,
  onContentChange,
  existingTitles,
  allNotesList,
  onNavigateWikilink,
  isSaving,
  targetHeadingAnchor,
  backlinks,
  onNavigateBacklink,
  fontMode,
  onChangeFontMode,
  isFullWidth: isFullWidthProp,
  onToggleFullWidth: onToggleFullWidthProp,
  isRtlAutoDetect = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [internalFullWidth, setInternalFullWidth] = useState<boolean>(false);
  const isFullWidth = isFullWidthProp !== undefined ? isFullWidthProp : internalFullWidth;
  const toggleFullWidth = onToggleFullWidthProp || (() => setInternalFullWidth((prev) => !prev));
  const [stats, setStats] = useState({ words: 0, chars: 0, readingTime: 0 });

  const wikilinkConfigCompartment = useRef(new Compartment());
  const widthCompartment = useRef(new Compartment());

  // Calculate words and reading time
  const updateStats = (text: string) => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readingTime = Math.ceil(words / 200);
    setStats({ words, chars, readingTime });
  };

  // Initialize CodeMirror instance
  useEffect(() => {
    if (!containerRef.current) return;

    const startContent = activeNote?.content ?? '';
    updateStats(startContent);

    const state = EditorState.create({
      doc: startContent,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        precisionThemeExtension(),
        livePreviewPlugin,
        wikilinkConfigCompartment.current.of(
          wikilinkConfigFacet.of({
            existingTitles,
            onNavigate: onNavigateWikilink,
          })
        ),
        wikilinkDecoratorPlugin,
        createWikilinkAutocomplete(() => allNotesList),
        widthCompartment.current.of(
          EditorView.theme({
            '.cm-content': {
              maxWidth: isFullWidth ? '100% !important' : '72ch',
            },
          })
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            updateStats(newContent);
            onContentChange(newContent);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [activeNote?.path]);

  // Handle note content updates when activeNote changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activeNote) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== activeNote.content) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: activeNote.content },
      });
      updateStats(activeNote.content);
    }
  }, [activeNote?.content]);

  // Update wikilink config when vault notes list or titles change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: wikilinkConfigCompartment.current.reconfigure(
        wikilinkConfigFacet.of({
          existingTitles,
          onNavigate: onNavigateWikilink,
        })
      ),
    });
  }, [existingTitles, onNavigateWikilink]);

  // Toggle reading width (72ch vs fluid)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: widthCompartment.current.reconfigure(
        EditorView.theme({
          '.cm-content': {
            maxWidth: isFullWidth ? '100% !important' : '72ch',
          },
        })
      ),
    });
  }, [isFullWidth]);

  // Scroll to heading anchor if requested
  useEffect(() => {
    if (!targetHeadingAnchor || !viewRef.current || !activeNote) return;

    const pos = findHeadingPosition(activeNote.content, targetHeadingAnchor);
    if (pos !== null) {
      const view = viewRef.current;
      view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
    }
  }, [targetHeadingAnchor, activeNote?.path]);

  if (!activeNote) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 select-none">
        <div className="p-8 border border-zinc-900 rounded-lg text-center max-w-sm">
          <div className="text-zinc-300 font-medium mb-1">No note selected</div>
          <div className="text-xs text-zinc-500 mb-4">
            Select a note from the vault sidebar or open the switcher
          </div>
          <kbd className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 font-mono">
            Ctrl + K
          </kbd>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden font-mode-${fontMode} ${
        !isRtlAutoDetect ? 'disable-auto-rtl' : ''
      }`}
    >
      {/* Top Document Header */}
      <header className="h-10 border-b border-zinc-900 px-6 flex items-center justify-between text-xs select-none bg-zinc-950/80 backdrop-blur shrink-0">
        <div className="flex items-center space-x-2 text-zinc-400 truncate">
          <span className="text-zinc-600 font-mono">/</span>
          <bdi className="text-zinc-200 font-medium truncate">{activeNote.title}</bdi>
          <span className="text-zinc-600 font-mono text-[10px]">.md</span>
        </div>

        <div className="flex items-center space-x-3 text-zinc-500">
          {/* Font Mode Selector */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[10px] font-medium">
            {(['auto', 'sans', 'serif', 'mono'] as FontMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onChangeFontMode(mode)}
                className={`px-1.5 py-0.5 rounded capitalize transition-colors ${
                  fontMode === mode
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'auto' ? 'Auto' : mode}
              </button>
            ))}
          </div>

          <div className="h-3 w-[1px] bg-zinc-800" />

          <div className="flex items-center space-x-1.5">
            {isSaving ? (
              <span className="flex items-center space-x-1 text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11px]">Saving...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-zinc-500">
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-[11px]">Saved</span>
              </span>
            )}
          </div>

          <div className="h-3 w-[1px] bg-zinc-800" />

          <div className="flex items-center space-x-2.5 text-[11px] font-mono">
            <span>{stats.words}w</span>
            <span className="text-zinc-700">•</span>
            <span>{stats.chars}c</span>
            <span className="text-zinc-700">•</span>
            <span>{stats.readingTime}m</span>
          </div>

          <div className="h-3 w-[1px] bg-zinc-800" />

          <button
            onClick={toggleFullWidth}
            title={isFullWidth ? 'Constrain reading width (72ch)' : 'Full width canvas'}
            className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Editor Main Surface & In-flow Backlinks */}
      <div className="flex-1 overflow-y-auto relative">
        <div ref={containerRef} />
        {activeNote && (
          <div className={isFullWidth ? 'w-full px-6' : 'max-w-[72ch] mx-auto px-6'}>
            <LinkedReferences
              targetTitle={activeNote.title}
              backlinks={backlinks}
              onNavigate={onNavigateBacklink}
            />
          </div>
        )}
      </div>
    </div>
  );
};
