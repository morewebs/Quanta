interface Props {
  vaultName: string;
  saving: boolean;
  words: number;
  chars: number;
  syncLabel: string;
  fontMode: string;
}

export function StatusBar({ vaultName, saving, words, chars, syncLabel, fontMode }: Props) {
  return (
    <footer className="h-6 shrink-0 border-t border-[var(--line)] bg-[var(--bg-raised)] px-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
      <div className="flex items-center gap-4 min-w-0">
        <span className="truncate">{vaultName}</span>
        <span>{saving ? 'Saving' : 'Saved'}</span>
        <span>{syncLabel}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>{fontMode}</span>
        <span>{words} words</span>
        <span>{chars} characters</span>
      </div>
    </footer>
  );
}
