import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, PanelRight } from 'lucide-react';
import type { MouseEvent } from 'react';
import { TabBar, type TabActions, type TabItem } from './tab-bar';

interface Props {
  tabs: TabItem[];
  active: string | null;
  onSelect: (path: string) => void;
  tabActions: TabActions;
  filesOpen: boolean;
  linksOpen: boolean;
  onToggleLinks: () => void;
}

function currentWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

function win(action: 'minimize' | 'toggleMaximize' | 'close') {
  const appWindow = currentWindow();
  if (!appWindow) return;
  if (action === 'minimize') void appWindow.minimize();
  if (action === 'toggleMaximize') void appWindow.toggleMaximize();
  if (action === 'close') void appWindow.close();
}

function onChromeMouseDown(e: MouseEvent<HTMLElement>) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('button, [data-no-drag]')) return;
  const appWindow = currentWindow();
  if (!appWindow) return;
  // startDragging must run in this mousedown turn — do not await
  if (e.detail === 2) {
    void appWindow.toggleMaximize();
  } else {
    void appWindow.startDragging();
  }
}

export function TitleBar({ tabs, active, onSelect, tabActions, filesOpen, linksOpen, onToggleLinks }: Props) {
  return (
    <header
      className="titlebar h-9 shrink-0 flex items-stretch border-b border-[var(--line)] bg-[var(--bg-raised)] select-none"
      data-tauri-drag-region="deep"
      onMouseDown={onChromeMouseDown}
    >
      <div className="w-11 shrink-0 border-e border-[var(--line)]" />
      {filesOpen && <div className="w-[250px] shrink-0 border-e border-[var(--line)]" />}
      <div className="flex-1 min-w-0 flex items-stretch">
        <TabBar tabs={tabs} active={active} onSelect={onSelect} actions={tabActions} embedded />
      </div>
      <button
        type="button"
        title={linksOpen ? 'Hide right sidebar' : 'Show right sidebar'}
        aria-pressed={linksOpen}
        onClick={onToggleLinks}
        className={`w-9 grid place-items-center ${
          linksOpen ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
        }`}
      >
        <PanelRight className="w-4 h-4" />
      </button>
      <button type="button" title="Minimize" className="w-10 grid place-items-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_10%,transparent)]" onClick={() => win('minimize')}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Maximize"
        className="w-10 grid place-items-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_10%,transparent)]"
        onClick={() => win('toggleMaximize')}
      >
        <Square className="w-3 h-3" />
      </button>
      <button type="button" title="Close" className="w-10 grid place-items-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_22%,transparent)]" onClick={() => win('close')}>
        <X className="w-3.5 h-3.5" />
      </button>
    </header>
  );
}
