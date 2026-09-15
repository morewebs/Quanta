import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileText, Plus, CornerDownLeft } from 'lucide-react';
import { VaultEntry } from '../types/vault';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  notes: VaultEntry[];
  onSelectNote: (path: string) => void;
  onCreateNote: (title: string) => void;
}

const MAX_DISPLAYED_RESULTS = 35;

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  notes,
  onSelectNote,
  onCreateNote,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Immediate next-frame focus
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const cleanQuery = query.trim().toLowerCase();

  // Fast search with early exit cap to guarantee sub-millisecond execution
  const filteredNotes = useMemo(() => {
    if (!cleanQuery) {
      return notes.slice(0, MAX_DISPLAYED_RESULTS);
    }

    const results: VaultEntry[] = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const title = n.name.replace(/\.md$/i, '').toLowerCase();
      if (title.includes(cleanQuery) || n.relative_path.toLowerCase().includes(cleanQuery)) {
        results.push(n);
        if (results.length >= MAX_DISPLAYED_RESULTS) {
          break;
        }
      }
    }
    return results;
  }, [notes, cleanQuery]);

  // Check if exact match exists
  const exactMatch = useMemo(() => {
    if (!cleanQuery) return false;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].name.replace(/\.md$/i, '').toLowerCase() === cleanQuery) {
        return true;
      }
    }
    return false;
  }, [notes, cleanQuery]);

  const showCreateOption = cleanQuery.length > 0 && !exactMatch;
  const totalItems = (showCreateOption ? 1 : 0) + filteredNotes.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreateOption && selectedIndex === 0) {
        onCreateNote(query.trim());
        onClose();
      } else {
        const noteIndex = showCreateOption ? selectedIndex - 1 : selectedIndex;
        const targetNote = filteredNotes[noteIndex];
        if (targetNote) {
          onSelectNote(targetNote.path);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <Search className="w-4 h-4 text-zinc-500 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            dir="auto"
            placeholder="Search notes or create new..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          <kbd className="text-[10px] font-mono text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 bg-zinc-950">
            ESC
          </kbd>
        </div>

        {/* Results List (Capped at 35 DOM nodes for instant responsiveness) */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {showCreateOption && (
            <div
              onClick={() => {
                onCreateNote(query.trim());
                onClose();
              }}
              className={`flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${
                selectedIndex === 0
                  ? 'bg-sky-500/10 text-sky-300 font-medium'
                  : 'text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>Create note:</span>
                <bdi className="font-semibold text-zinc-100">"{query.trim()}"</bdi>
              </div>
              <CornerDownLeft className="w-3 h-3 text-zinc-500" />
            </div>
          )}

          {filteredNotes.map((note, index) => {
            const itemIndex = showCreateOption ? index + 1 : index;
            const isSelected = itemIndex === selectedIndex;
            const title = note.name.replace(/\.md$/i, '');

            return (
              <div
                key={note.path}
                onClick={() => {
                  onSelectNote(note.path);
                  onClose();
                }}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-sky-400' : 'text-zinc-500'
                    }`}
                  />
                  <bdi className="truncate">{title}</bdi>
                </div>
                {note.relative_path !== note.name && (
                  <bdi className="text-[10px] text-zinc-600 font-mono truncate max-w-[150px] ml-2">
                    {note.relative_path}
                  </bdi>
                )}
              </div>
            );
          })}

          {totalItems === 0 && (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching notes found
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-950/60 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Quanta Quick Switcher</span>
        </div>
      </div>
    </div>
  );
};
