import { useEffect, useMemo, useRef, useState } from 'react';
import { flattenVaultTree, normalizeNoteTitle } from '../vault/wikilinks';
import type { VaultEntry } from '../vault/types';

interface Props {
  open: boolean;
  tree: VaultEntry | null;
  onClose: () => void;
  onOpen: (relative: string) => void;
  onCreate: (title: string) => void;
}

type Item =
  | { id: string; kind: 'note'; path: string; title: string; subtitle: string }
  | { id: string; kind: 'create'; title: string };

export function Switcher({ open, tree, onClose, onOpen, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const notes = useMemo(() => (tree ? flattenVaultTree(tree) : []), [tree]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const matches: Item[] = (qLower ? notes.filter((n) => n.relative_path.toLowerCase().includes(qLower)) : notes)
      .slice(0, 30)
      .map((n) => ({
        id: n.relative_path,
        kind: 'note' as const,
        path: n.relative_path,
        title: n.name.replace(/\.md$/i, ''),
        subtitle: n.relative_path,
      }));
    const exact = q !== '' && notes.some((n) => normalizeNoteTitle(n.name) === normalizeNoteTitle(q));
    if (q && !exact) matches.push({ id: `create:${q}`, kind: 'create', title: q });
    return matches;
  }, [notes, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const activate = (item: Item) => {
    if (item.kind === 'create') onCreate(item.title);
    else onOpen(item.path);
    onClose();
  };

  const move = (delta: number) => {
    if (!items.length) return;
    setSelected((i) => (i + delta + items.length) % items.length);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-[18vh] px-4 bg-[color-mix(in_hsl,var(--bg)_45%,transparent)] backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg)] border border-[var(--line)] shadow-[0_18px_40px_var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="switcher-list"
          aria-activedescendant={items[selected] ? `switcher-${items[selected].id}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              move(1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              move(-1);
            } else if (e.key === 'Home') {
              e.preventDefault();
              setSelected(0);
            } else if (e.key === 'End') {
              e.preventDefault();
              setSelected(Math.max(0, items.length - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const item = items[selected];
              if (item) activate(item);
            }
          }}
          placeholder="Open or create a note"
          className="w-full bg-transparent px-4 py-3 outline-none border-b border-[var(--line)]"
        />
        <ul id="switcher-list" role="listbox" ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {items.map((item, i) => {
            const active = i === selected;
            return (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  id={`switcher-${item.id}`}
                  role="option"
                  aria-selected={active}
                  data-index={i}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    active ? 'bg-[color-mix(in_hsl,var(--fill)_16%,transparent)]' : ''
                  } ${item.kind === 'create' && !active ? 'text-[var(--muted)]' : ''}`}
                  onMouseMove={() => {
                    if (selected !== i) setSelected(i);
                  }}
                  onClick={() => activate(item)}
                >
                  {item.kind === 'create' ? (
                    <>Create “{item.title}”</>
                  ) : (
                    <>
                      {item.title}
                      <span className="ms-2 text-[11px] text-[var(--muted)]">{item.subtitle}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-3 text-sm text-[var(--muted)]">No notes yet</li>}
        </ul>
      </div>
    </div>
  );
}
