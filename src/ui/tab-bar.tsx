import { Pin, X } from 'lucide-react';
import { useState } from 'react';
import { ContextMenu, type MenuEntry } from './context-menu';

export interface TabItem {
  path: string;
  title: string;
  pinned?: boolean;
}

export interface TabActions {
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseRight: (path: string) => void;
  onCloseAll: () => void;
  onPin: (path: string) => void;
  onRename: (path: string) => void;
  onCopyPath: (path: string, relative: boolean) => void;
  onOpenInOs: (path: string) => void;
  onRevealOs: (path: string) => void;
  onRevealTree: (path: string) => void;
}

interface Props {
  tabs: TabItem[];
  active: string | null;
  onSelect: (path: string) => void;
  actions: TabActions;
  embedded?: boolean;
}

export function TabBar({ tabs, active, onSelect, actions, embedded }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  if (tabs.length === 0) {
    return <div className={embedded ? 'flex-1' : 'h-9 shrink-0'} data-tauri-drag-region />;
  }

  const menuTab = menu ? tabs.find((t) => t.path === menu.path) : null;
  const menuIndex = menu ? tabs.findIndex((t) => t.path === menu.path) : -1;
  const unpinnedOthers = menu
    ? tabs.filter((t) => t.path !== menu.path && !t.pinned).length
    : 0;
  const unpinnedRight =
    menuIndex >= 0
      ? tabs.slice(menuIndex + 1).filter((t) => !t.pinned).length
      : 0;

  const menuItems: MenuEntry[] = menuTab
    ? [
        { label: 'Close', onSelect: () => actions.onClose(menuTab.path) },
        {
          label: 'Close Others',
          onSelect: () => actions.onCloseOthers(menuTab.path),
          disabled: unpinnedOthers === 0,
        },
        {
          label: 'Close to the Right',
          onSelect: () => actions.onCloseRight(menuTab.path),
          disabled: unpinnedRight === 0,
        },
        { label: 'Close All', onSelect: () => actions.onCloseAll() },
        { separator: true },
        {
          label: menuTab.pinned ? 'Unpin' : 'Pin',
          onSelect: () => actions.onPin(menuTab.path),
        },
        { separator: true },
        { label: 'Rename…', onSelect: () => actions.onRename(menuTab.path) },
        { separator: true },
        { label: 'Copy Path', onSelect: () => actions.onCopyPath(menuTab.path, false) },
        { label: 'Copy Relative Path', onSelect: () => actions.onCopyPath(menuTab.path, true) },
        { separator: true },
        { label: 'Open in default app', onSelect: () => actions.onOpenInOs(menuTab.path), external: true },
        { label: 'Show in system explorer', onSelect: () => actions.onRevealOs(menuTab.path), external: true },
        { label: 'Reveal in Files', onSelect: () => actions.onRevealTree(menuTab.path) },
      ]
    : [];

  return (
    <div
      className={`${embedded ? 'flex-1 min-w-0' : 'h-9 shrink-0 border-b border-[var(--line)] bg-[var(--bg-raised)]'} flex items-stretch overflow-x-auto`}
    >
      {tabs.map((tab) => {
        const selected = tab.path === active;
        return (
          <div
            key={tab.path}
            data-no-drag
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, path: tab.path });
            }}
            className={`group flex items-center gap-1 px-3 min-w-[7rem] max-w-[14rem] border-e border-[var(--line)] ${
              selected ? 'bg-[var(--bg)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.pinned ? <Pin className="w-3 h-3 shrink-0" /> : null}
            <button
              type="button"
              onClick={() => onSelect(tab.path)}
              className="flex-1 truncate text-[13px] text-start"
              title={tab.path}
            >
              {tab.title}
            </button>
            <button
              type="button"
              title="Close"
              onClick={(e) => {
                e.stopPropagation();
                actions.onClose(tab.path);
              }}
              className={`p-0.5 rounded-[2px] hover:bg-[color-mix(in_hsl,var(--fill)_16%,transparent)] ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      {menu && (
        <ContextMenu
          key={`${menu.path}:${menu.x}:${menu.y}`}
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
