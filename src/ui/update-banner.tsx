import type { UpdateStatus } from '../updater';

interface Props {
  status: UpdateStatus;
  onInstall: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ status, onInstall, onSkip, onDismiss }: Props) {
  if (status.kind !== 'available' && status.kind !== 'downloading' && status.kind !== 'installing') {
    return null;
  }

  const version = status.version;
  const busy = status.kind !== 'available';

  return (
    <div className="h-10 shrink-0 px-4 border-b border-[var(--line)] flex items-center justify-between gap-3 text-sm bg-[var(--bg-raised)]">
      <p className="truncate">
        {status.kind === 'available' && (
          <>
            Version {version} is ready
            {status.notes ? <span className="text-[var(--muted)]"> — {status.notes}</span> : null}
          </>
        )}
        {status.kind === 'downloading' && <>Downloading {version} · {status.percent}%</>}
        {status.kind === 'installing' && <>Installing {version}. Quanta will restart.</>}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {status.kind === 'available' && (
          <>
            <button type="button" onClick={onSkip} className="text-[var(--muted)] hover:text-[var(--text)]">
              Skip
            </button>
            <button type="button" onClick={onDismiss} className="text-[var(--muted)] hover:text-[var(--text)]">
              Later
            </button>
            <button
              type="button"
              onClick={onInstall}
              className="px-2 py-0.5 border border-[var(--fill)]"
            >
              Install
            </button>
          </>
        )}
        {busy && (
          <span className="w-24 h-1 bg-[var(--line)] overflow-hidden">
            <span
              className="block h-full bg-[var(--fill)]"
              style={{ width: `${status.kind === 'downloading' ? status.percent : 100}%` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}
