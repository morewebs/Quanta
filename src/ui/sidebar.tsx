import { FolderPlus, FilePlus, PanelLeftClose, Settings2 } from 'lucide-react';
import type { VaultEntry } from '../vault/types';

interface Props {
  tree: VaultEntry | null;
  active: string | null;
  onOpen: (relative: string) => void;
  onCreateNote: (folder?: string) => void;
  onCreateFolder: (parent?: string) => void;
  onRename: (relative: string) => void;
  onDelete: (relative: string) => void;
  onClose: () => void;
  onSettings: () => void;
  syncLabel: string;
}

function Node({
  entry,
  active,
  onOpen,
  onRename,
  onDelete,
  depth,
}: {
  entry: VaultEntry;
  active: string | null;
  onOpen: (relative: string) => void;
  onRename: (relative: string) => void;
  onDelete: (relative: string) => void;
  depth: number;
}) {
  if (entry.is_dir) {
    return (
      <div>
        {entry.relative_path && (
          <div
            className="px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--muted)]"
            style={{ paddingInlineStart: 12 + depth * 10 }}
          >
            {entry.name}
          </div>
        )}
        {entry.children?.map((child) => (
          <Node
            key={child.relative_path || child.name}
            entry={child}
            active={active}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
            depth={entry.relative_path ? depth + 1 : depth}
          />
        ))}
      </div>
    );
  }
  const selected = active === entry.relative_path;
  return (
    <button
      type="button"
      onClick={() => onOpen(entry.relative_path)}
      onContextMenu={(e) => {
        e.preventDefault();
        const next = window.prompt('Rename or type delete', entry.name.replace(/\.md$/i, ''));
        if (next === null) return;
        if (next.toLowerCase() === 'delete') onDelete(entry.relative_path);
        else onRename(entry.relative_path);
      }}
      className={`w-full text-left px-3 py-1.5 text-sm truncate ${
        selected ? 'bg-[color-mix(in_hsl,var(--fill)_14%,transparent)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
      style={{ paddingInlineStart: 12 + depth * 10 }}
    >
      {entry.name.replace(/\.md$/i, '')}
    </button>
  );
}

export function Sidebar({
  tree,
  active,
  onOpen,
  onCreateNote,
  onCreateFolder,
  onRename,
  onDelete,
  onClose,
  onSettings,
  syncLabel,
}: Props) {
  return (
    <aside className="w-[240px] shrink-0 h-full border-e border-[var(--line)] bg-[var(--bg-raised)] sidebar-grain flex flex-col">
      <div className="h-11 px-3 flex items-center justify-between border-b border-[var(--line)]">
        <span className="text-sm font-medium">Quanta</span>
        <div className="flex items-center gap-1">
          <button type="button" title="New note" className="p-1 text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onCreateNote()}>
            <FilePlus className="w-4 h-4" />
          </button>
          <button type="button" title="New folder" className="p-1 text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onCreateFolder()}>
            <FolderPlus className="w-4 h-4" />
          </button>
          <button type="button" title="Hide sidebar" className="p-1 text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose}>
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {tree ? (
          <Node
            entry={tree}
            active={active}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
            depth={0}
          />
        ) : (
          <p className="px-3 text-sm text-[var(--muted)]">Empty vault</p>
        )}
      </div>
      <div className="h-11 px-3 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span className="truncate">{syncLabel}</span>
        <button type="button" onClick={onSettings} className="p-1 hover:text-[var(--text)]" title="Settings">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
