import { useCallback, useEffect, useRef, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

const SKIP_KEY = 'quanta_skip_version';

export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; notes: string | null; current: string }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'installing'; version: string }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'error'; message: string };

const isTauri = () =>
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

function skippedVersion(): string | null {
  return localStorage.getItem(SKIP_KEY);
}

export async function currentVersion(): Promise<string> {
  if (!isTauri()) return '0.1.0';
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'idle' });
  const [version, setVersion] = useState('0.1.0');
  const pending = useRef<Update | null>(null);

  useEffect(() => {
    currentVersion().then(setVersion).catch(() => undefined);
  }, []);

  const check = useCallback(async (opts?: { ignoreSkip?: boolean }) => {
    if (!isTauri()) {
      setStatus({ kind: 'up-to-date', current: version });
      return;
    }
    setStatus({ kind: 'checking' });
    try {
      const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
      const update = await checkUpdate();
      if (!update) {
        pending.current = null;
        setStatus({ kind: 'up-to-date', current: version });
        return;
      }
      if (!opts?.ignoreSkip && skippedVersion() === update.version) {
        pending.current = null;
        setStatus({ kind: 'idle' });
        return;
      }
      pending.current = update;
      setStatus({
        kind: 'available',
        version: update.version,
        notes: update.body ?? null,
        current: update.currentVersion,
      });
    } catch (e) {
      pending.current = null;
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, [version]);

  const install = useCallback(async () => {
    const update = pending.current;
    if (!update) return;
    setStatus({ kind: 'downloading', version: update.version, percent: 0 });
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const percent = total ? Math.min(99, Math.round((downloaded / total) * 100)) : 0;
          setStatus({ kind: 'downloading', version: update.version, percent });
        } else if (event.event === 'Finished') {
          setStatus({ kind: 'installing', version: update.version });
        }
      });
      setStatus({ kind: 'installing', version: update.version });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const skip = useCallback(() => {
    if (status.kind === 'available') {
      localStorage.setItem(SKIP_KEY, status.version);
    }
    pending.current = null;
    setStatus({ kind: 'idle' });
  }, [status]);

  const dismiss = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  return { status, version, check, install, skip, dismiss };
}
