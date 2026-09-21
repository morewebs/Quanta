import { Files, Search, FilePlus, Settings2 } from 'lucide-react';

interface Props {
  filesOpen: boolean;
  onToggleFiles: () => void;
  onSearch: () => void;
  onNewNote: () => void;
  onSettings: () => void;
}

function RibbonButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`w-9 h-9 grid place-items-center rounded-[3px] ${
        active
          ? 'bg-[color-mix(in_hsl,var(--fill)_16%,transparent)] text-[var(--text)]'
          : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_8%,transparent)]'
      }`}
    >
      {children}
    </button>
  );
}

export function Ribbon({
  filesOpen,
  onToggleFiles,
  onSearch,
  onNewNote,
  onSettings,
}: Props) {
  return (
    <nav className="w-11 shrink-0 h-full border-e border-[var(--line)] bg-[var(--bg-raised)] flex flex-col items-center py-1.5 gap-0.5">
      <RibbonButton label="Files" active={filesOpen} onClick={onToggleFiles}>
        <Files className="w-[18px] h-[18px]" />
      </RibbonButton>
      <RibbonButton label="Quick switcher" onClick={onSearch}>
        <Search className="w-[18px] h-[18px]" />
      </RibbonButton>
      <RibbonButton label="New note" onClick={onNewNote}>
        <FilePlus className="w-[18px] h-[18px]" />
      </RibbonButton>
      <div className="flex-1" />
      <RibbonButton label="Settings" onClick={onSettings}>
        <Settings2 className="w-[18px] h-[18px]" />
      </RibbonButton>
    </nav>
  );
}
