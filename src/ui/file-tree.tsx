import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, FilePlus, FolderPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { VaultEntry } from '../vault/types';
import { ContextMenu, type MenuEntry } from './context-menu';

interface Props {
  tree: VaultEntry | null;
  active: string | null;
  reveal?: { path: string; n: number } | null;
  onOpen: (relative: string) => void;
  onCreateNote: (folder?: string) => void;
  onCreateFolder: (parent?: string) => void;
  onRename: (relative: string, isDir: boolean) => void;
  onMove: (relative: string, isDir: boolean) => void;
  onDelete: (relative: string) => void;
  onCopyPath: (relative: string, kind: 'absolute' | 'relative') => void;
  onOpenInOs: (relative: string) => void;
  onRevealOs: (relative: string) => void;
}

function TreeNode({
  entry,
  active,
  depth,
  expanded,
  flash,
  toggle,
  onOpen,
  onMenu,
}: {
  entry: VaultEntry;
  active: string | null;
  depth: number;
  expanded: Set<string>;
  flash: string | null;
  toggle: (path: string) => void;
  onOpen: (relative: string) => void;
  onMenu: (e: React.MouseEvent, entry: VaultEntry) => void;
}) {
  if (entry.is_dir) {
    const key = entry.relative_path || '/';
    const open = expanded.has(key);
    const children = entry.children ?? [];
    return (
      <div>
        {entry.relative_path !== '' && (
          <button
            type="button"
            data-tree-path={entry.relative_path}
            onClick={() => toggle(key)}
            onContextMenu={(e) => onMenu(e, entry)}
            className={`w-full flex items-center gap-1 h-7 px-2 text-[13px] text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_10%,transparent)] ${
              flash === entry.relative_path ? 'bg-[color-mix(in_hsl,var(--fill)_18%,transparent)]' : ''
            }`}
            style={{ paddingInlineStart: 8 + depth * 14 }}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" />}
            {open ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" />}
            <span className="truncate">{entry.name}</span>
          </button>
        )}
        {(entry.relative_path === '' || open) &&
          children.map((child) => (
            <TreeNode
              key={child.relative_path || child.name}
              entry={child}
              active={active}
              depth={entry.relative_path ? depth + 1 : depth}
              expanded={expanded}
              flash={flash}
              toggle={toggle}
              onOpen={onOpen}
              onMenu={onMenu}
            />
          ))}
      </div>
    );
  }

  const selected = active === entry.relative_path;
  return (
    <button
      type="button"
      data-tree-path={entry.relative_path}
      onClick={() => onOpen(entry.relative_path)}
      onContextMenu={(e) => onMenu(e, entry)}
      className={`w-full flex items-center gap-1.5 h-7 px-2 text-[13px] truncate ${
        selected || flash === entry.relative_path
          ? 'bg-[color-mix(in_hsl,var(--fill)_18%,transparent)] text-[var(--text)]'
          : 'text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_8%,transparent)]'
      }`}
      style={{ paddingInlineStart: 8 + depth * 14 + 18 }}
    >
      <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" />
      <span className="truncate">{entry.name.replace(/\.md$/i, '')}</span>
    </button>
  );
}

export function FileTree({
  tree,
  active,
  reveal,
  onOpen,
  onCreateNote,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
  onCopyPath,
  onOpenInOs,
  onRevealOs,
}: Props) {
  const allFolders = useMemo(() => {
    const paths = new Set<string>(['/']);
    const walk = (node: VaultEntry) => {
      if (node.is_dir) {
        paths.add(node.relative_path || '/');
        node.children?.forEach(walk);
      }
    };
    if (tree) walk(tree);
    return paths;
  }, [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(allFolders);
  const [menu, setMenu] = useState<{ x: number; y: number; entry: VaultEntry } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  useEffect(() => {
    if (!reveal) return;
    const parts = reveal.path.split('/').filter(Boolean);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add('/');
      for (let i = 0; i < parts.length - 1; i += 1) {
        next.add(parts.slice(0, i + 1).join('/'));
      }
      return next;
    });
    setFlash(reveal.path);
    const scroll = window.setTimeout(() => {
      const el = document.querySelector(`[data-tree-path="${CSS.escape(reveal.path)}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }, 30);
    const clear = window.setTimeout(() => setFlash(null), 1200);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [reveal]);

  const onMenu = (e: React.MouseEvent, entry: VaultEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const menuName = menu
    ? (menu.entry.relative_path.split('/').pop() || menu.entry.relative_path).replace(/\.md$/i, '')
    : '';
  const copyChildren = menu
    ? [
        { label: 'Copy Path', onSelect: () => onCopyPath(menu.entry.relative_path, 'absolute') },
        { label: 'Copy Relative Path', onSelect: () => onCopyPath(menu.entry.relative_path, 'relative') },
      ]
    : [];
  const menuItems: MenuEntry[] = menu
    ? menu.entry.is_dir
      ? [
          { label: 'New note', onSelect: () => onCreateNote(menu.entry.relative_path) },
          { label: 'New folder', onSelect: () => onCreateFolder(menu.entry.relative_path) },
          { separator: true },
          { label: 'Rename…', onSelect: () => onRename(menu.entry.relative_path, true) },
          { label: 'Move to…', onSelect: () => onMove(menu.entry.relative_path, true) },
          {
            label: 'Delete',
            onSelect: () => onDelete(menu.entry.relative_path),
            danger: true,
            confirm: `Delete “${menuName}”?`,
          },
          { separator: true },
          { label: 'Copy path', children: copyChildren },
          { separator: true },
          { label: 'Show in system explorer', onSelect: () => onRevealOs(menu.entry.relative_path), external: true },
        ]
      : [
          { label: 'Open', onSelect: () => onOpen(menu.entry.relative_path) },
          { separator: true },
          { label: 'Rename…', onSelect: () => onRename(menu.entry.relative_path, false) },
          { label: 'Move to…', onSelect: () => onMove(menu.entry.relative_path, false) },
          {
            label: 'Delete',
            onSelect: () => onDelete(menu.entry.relative_path),
            danger: true,
            confirm: `Delete “${menuName}”?`,
          },
          { separator: true },
          { label: 'Copy path', children: copyChildren },
          { separator: true },
          { label: 'Open in default app', onSelect: () => onOpenInOs(menu.entry.relative_path), external: true },
          { label: 'Show in system explorer', onSelect: () => onRevealOs(menu.entry.relative_path), external: true },
        ]
    : [];

  return (
    <aside className="w-[250px] shrink-0 h-full border-e border-[var(--line)] bg-[var(--bg-raised)] flex flex-col min-h-0">
      <div className="h-9 px-2 flex items-center justify-between border-b border-[var(--line)]">
        <span className="text-[13px] font-medium px-1">Files</span>
        <div className="flex items-center">
          <button type="button" title="New note" className="p-1 text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onCreateNote()}>
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="New folder" className="p-1 text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onCreateFolder()}>
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree ? (
          <TreeNode
            entry={tree}
            active={active}
            depth={0}
            expanded={expanded}
            flash={flash}
            toggle={toggle}
            onOpen={onOpen}
            onMenu={onMenu}
          />
        ) : (
          <p className="px-3 py-4 text-[13px] text-[var(--muted)]">This vault has no notes yet. Create one to start writing.</p>
        )}
      </div>
      {menu && (
        <ContextMenu
          key={`${menu.entry.relative_path}:${menu.x}:${menu.y}`}
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}
