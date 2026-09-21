import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { UpdateStatus } from '../updater';
import type { AppConfig, AuthStatus, ChatOption, FontMode, ThemeMode } from '../vault/types';
import * as api from '../vault/api';

type Pane = 'general' | 'editor' | 'appearance' | 'files' | 'telegram' | 'about';

interface Props {
  open: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfig: (c: AppConfig) => void;
  auth: AuthStatus;
  onAuthChange: () => void;
  fontMode: FontMode;
  onFontMode: (m: FontMode) => void;
  rtl: boolean;
  onRtl: (v: boolean) => void;
  fullWidth: boolean;
  onToggleWidth: () => void;
  onPickVault: () => void;
  appVersion: string;
  updateStatus: UpdateStatus;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-[22px] rounded-full shrink-0 ${on ? 'bg-[var(--fill)]' : 'bg-[var(--line)]'}`}
    >
      <span
        className={`absolute top-[2px] size-[18px] rounded-full bg-[var(--bg)] shadow-sm ${
          on ? 'inset-inline-start-[20px]' : 'inset-inline-start-[2px]'
        }`}
      />
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-[160px] bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-2 py-1.5 text-[13px]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-[14px] border-b border-[var(--line)] flex items-center justify-between gap-8">
      <div className="min-w-0 pr-4">
        <div className="text-[14px] font-medium leading-snug">{label}</div>
        {hint && <p className="text-[12.5px] text-[var(--muted)] mt-1 leading-[1.45]">{hint}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">{children}</div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[15px] font-semibold pt-5 pb-1">{children}</h3>;
}

const NAV: Array<{ group: string; items: Array<{ id: Pane; label: string }> }> = [
  {
    group: 'Options',
    items: [
      { id: 'general', label: 'General' },
      { id: 'editor', label: 'Editor' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'files', label: 'Files and links' },
      { id: 'telegram', label: 'Telegram' },
      { id: 'about', label: 'About' },
    ],
  },
];

export function Settings({
  open,
  onClose,
  config,
  onConfig,
  auth,
  onAuthChange,
  fontMode,
  onFontMode,
  rtl,
  onRtl,
  fullWidth,
  onToggleWidth,
  onPickVault,
  appVersion,
  updateStatus,
  onCheckUpdates,
  onInstallUpdate,
}: Props) {
  const [pane, setPane] = useState<Pane>('editor');
  const [query, setQuery] = useState('');
  const [apiId, setApiId] = useState(config.api_id?.toString() ?? '');
  const [apiHash, setApiHash] = useState(config.api_hash ?? '');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'idle' | 'code' | 'password'>('idle');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatOption[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setApiId(config.api_id?.toString() ?? '');
    setApiHash(config.api_hash ?? '');
  }, [config]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();
  const match = (...parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q));

  const visibleNav = useMemo(() => {
    if (!q) return NAV;
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  if (!open) return null;

  const persistCreds = async () => {
    onConfig(
      await api.saveConfig({
        ...config,
        api_id: apiId ? Number(apiId) : null,
        api_hash: apiHash || null,
      }),
    );
  };

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      await persistCreds();
      await api.tgConnect();
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.tgRequestCode(phone);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.tgSignIn(code);
      if (result.needs_password) {
        setHint(result.password_hint);
        setStep('password');
      } else {
        setStep('idle');
        await api.tgStartUpdates().catch(() => undefined);
        onAuthChange();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.tgCheckPassword(password);
      setStep('idle');
      await api.tgStartUpdates().catch(() => undefined);
      onAuthChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const title = NAV[0].items.find((i) => i.id === pane)?.label ?? 'Settings';
  const searching = q.length > 0;

  const generalRows = (
    <>
      {match('Detect right-to-left', 'Persian', 'Arabic') && (
        <SettingRow
          label="Detect right-to-left"
          hint="Lines that start with Persian or Arabic script flip direction automatically."
        >
          <Toggle label="Detect right-to-left" on={rtl} onChange={onRtl} />
        </SettingRow>
      )}
    </>
  );

  const editorRows = (
    <>
      {match('Typeface', 'font', 'Vazirmatn', 'Source Serif', 'Persian') && (
        <SettingRow
          label="Typeface"
          hint="Auto uses Source Serif 4 for Latin and Vazirmatn for Persian in the same note."
        >
          <Select
            value={fontMode}
            onChange={(v) => onFontMode(v as FontMode)}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'sans', label: 'Vazirmatn' },
              { value: 'serif', label: 'Source Serif 4' },
              { value: 'mono', label: 'IBM Plex Mono' },
            ]}
          />
        </SettingRow>
      )}
      {match('Readable line length', 'measure', 'width') && (
        <SettingRow
          label="Readable line length"
          hint="Keep the writing column around 72 characters. Turn off to let the note fill the window."
        >
          <Toggle label="Readable line length" on={!fullWidth} onChange={() => onToggleWidth()} />
        </SettingRow>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-40 bg-[hsl(32_18%_7%/0.55)] flex items-center justify-center p-5">
      <div
        className="w-[min(1080px,96vw)] h-[min(740px,92vh)] bg-[var(--bg)] border border-[var(--line)] shadow-[0_28px_80px_var(--shadow)] flex overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <aside className="w-[240px] shrink-0 bg-[var(--bg-raised)] border-e border-[var(--line)] flex flex-col">
          <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2">
            {visibleNav.map((group) => (
              <div key={group.group} className="mb-4">
                <div className="px-3 pt-1 pb-1.5 text-[11px] text-[var(--muted)]">{group.group}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPane(item.id);
                      setQuery('');
                    }}
                    className={`w-full text-start px-3 py-[6px] text-[13.5px] rounded-[4px] ${
                      pane === item.id && !searching
                        ? 'bg-[color-mix(in_hsl,var(--fill)_18%,transparent)] text-[var(--text)]'
                        : 'text-[var(--text)] hover:bg-[color-mix(in_hsl,var(--fill)_8%,transparent)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col bg-[var(--bg)]">
          <div className="px-6 pt-4 pb-2 flex items-center gap-3">
            <label className="flex-1 flex items-center gap-2 h-9 px-3 border border-[var(--line)] rounded-[6px] bg-[var(--bg-raised)]">
              <Search className="w-4 h-4 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings..."
                className="flex-1 bg-transparent outline-none text-[14px]"
              />
            </label>
            <button type="button" onClick={onClose} className="p-1.5 text-[var(--muted)] hover:text-[var(--text)]" aria-label="Close settings">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-10">
            <h1 className="text-[28px] font-semibold tracking-tight pt-3 pb-1">{searching ? 'Search' : title}</h1>

            {(pane === 'general' || searching) && (
              <section>
                {(searching ? match('Detect right-to-left', 'Persian') : true) && (
                  <>
                    {!searching && <Heading>Behavior</Heading>}
                    {searching && <Heading>General</Heading>}
                    {generalRows}
                  </>
                )}
              </section>
            )}

            {(pane === 'editor' || searching) && (
              <section>
                {!searching && <Heading>Display</Heading>}
                {searching && match('Typeface', 'Readable line length', 'font') && <Heading>Editor</Heading>}
                {editorRows}
              </section>
            )}

            {(pane === 'appearance' || searching) && (
              <section>
                {!searching && <Heading>Theme</Heading>}
                {searching && match('Theme', 'dark', 'light', 'Base color') && <Heading>Appearance</Heading>}
                {match('Theme', 'dark', 'light', 'Base color') && (
                  <SettingRow label="Base color" hint="The interface stays on one ink umber hue in both modes.">
                    <Select
                      value={(config.theme as string) || 'dark'}
                      onChange={async (v) => onConfig(await api.saveConfig({ ...config, theme: v as ThemeMode }))}
                      options={[
                        { value: 'dark', label: 'Dark' },
                        { value: 'light', label: 'Light' },
                      ]}
                    />
                  </SettingRow>
                )}
              </section>
            )}

            {(pane === 'files' || searching) && match('Vault folder', 'files', 'vault') && (
              <section>
                <Heading>Files</Heading>
                <SettingRow label="Vault folder" hint={config.vault_path || 'Notes live in the app data folder until you choose one.'}>
                  <button type="button" onClick={onPickVault} className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5 bg-[var(--bg-raised)]">
                    Choose folder
                  </button>
                </SettingRow>
              </section>
            )}

            {(pane === 'telegram' || searching) && (
              <section>
                {(searching ? match('Telegram', 'phone', 'api_id', 'Saved Messages') : true) && <Heading>Telegram</Heading>}
                {!searching && (
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed py-3">
                    Sign in with the same phone you use in Telegram. Notes are stored as documents captioned quanta/v1 so Saved Messages stays usable.
                  </p>
                )}
                {match('Status', 'signed in', 'Telegram') && (
                  <SettingRow
                    label="Account"
                    hint={auth.authorized ? `Signed in${auth.name ? ` as ${auth.name}` : ''}.` : 'Not signed in. Local notes still work.'}
                  >
                    <span className="text-[13px] text-[var(--muted)]">{auth.authorized ? 'Connected' : 'Local only'}</span>
                  </SettingRow>
                )}
                {match('api_id') && (
                  <SettingRow label="API ID" hint="Create an app at my.telegram.org and paste the id here.">
                    <input
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      className="w-44 bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-2 py-1.5 text-[13px]"
                    />
                  </SettingRow>
                )}
                {match('api_hash') && (
                  <SettingRow label="API hash">
                    <input
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      className="w-44 bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-2 py-1.5 text-[13px]"
                    />
                  </SettingRow>
                )}
                {match('Connect', 'Save and connect') && (
                  <SettingRow label="Connect" hint="Saves the API credentials and opens a Telegram session.">
                    <button type="button" onClick={connect} disabled={busy} className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5 bg-[var(--bg-raised)]">
                      Save and connect
                    </button>
                  </SettingRow>
                )}
                {match('Phone') && (
                  <SettingRow label="Phone number">
                    <div className="flex gap-2">
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+98912…"
                        className="w-40 bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-2 py-1.5 text-[13px]"
                      />
                      <button type="button" onClick={sendCode} disabled={busy} className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5">
                        Send code
                      </button>
                    </div>
                  </SettingRow>
                )}
                {step === 'code' && (
                  <SettingRow label="Login code">
                    <div className="flex gap-2">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-28 bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-2 py-1.5 text-[13px]"
                      />
                      <button type="button" onClick={submitCode} disabled={busy} className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5">
                        Sign in
                      </button>
                    </div>
                  </SettingRow>
                )}
                {step === 'password' && (
                  <SettingRow label="Two-factor password" hint={hint ? `Hint: ${hint}` : undefined}>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-40 bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-2 py-1.5 text-[13px]"
                      />
                      <button type="button" onClick={submitPassword} disabled={busy} className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5">
                        Unlock
                      </button>
                    </div>
                  </SettingRow>
                )}
                {auth.authorized && match('Storage', 'Saved Messages', 'chat') && (
                  <>
                    <SettingRow label="Storage" hint="Saved Messages is the default. Pick a private chat for a dedicated vault.">
                      <button type="button" onClick={() => api.tgListChats().then(setChats).catch((e) => setError(String(e)))} className="text-[13px] text-[var(--muted)]">
                        Refresh chats
                      </button>
                    </SettingRow>
                    <div className="py-3 space-y-1">
                      <button
                        type="button"
                        onClick={async () => onConfig(await api.tgSetStorage({ kind: 'saved_messages' }))}
                        className={`block w-full text-start px-3 py-2 text-[13px] rounded-[4px] border ${
                          config.storage.kind === 'saved_messages' ? 'border-[var(--fill)]' : 'border-[var(--line)]'
                        }`}
                      >
                        Saved Messages
                      </button>
                      {chats
                        .filter((c) => c.kind !== 'saved')
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={async () =>
                              onConfig(await api.tgSetStorage({ kind: 'chat', id: c.id, name: c.name }))
                            }
                            className={`block w-full text-start px-3 py-2 text-[13px] rounded-[4px] border ${
                              config.storage.kind === 'chat' && config.storage.id === c.id
                                ? 'border-[var(--fill)]'
                                : 'border-[var(--line)]'
                            }`}
                          >
                            {c.name || c.id}
                          </button>
                        ))}
                    </div>
                    <SettingRow label="Sync now">
                      <button
                        type="button"
                        onClick={() => api.tgSyncNow().catch((e) => setError(String(e)))}
                        className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5 bg-[var(--bg-raised)]"
                      >
                        Sync
                      </button>
                    </SettingRow>
                  </>
                )}
                {error && <p className="py-3 text-[13px] font-medium">{error}</p>}
              </section>
            )}

            {(pane === 'about' || searching) && match('version', 'update', 'About', 'Installed') && (
              <section>
                <Heading>About</Heading>
                <SettingRow label="Current version" hint="Quanta checks GitHub Releases for a newer signed build.">
                  <span className="text-[13px] tabular-nums">{appVersion}</span>
                </SettingRow>
                <SettingRow
                  label="Automatic updates"
                  hint={
                    updateStatus.kind === 'available'
                      ? `${updateStatus.version} is ready${updateStatus.notes ? `. ${updateStatus.notes}` : ''}`
                      : updateStatus.kind === 'downloading'
                        ? `Downloading ${updateStatus.percent}%`
                        : updateStatus.kind === 'installing'
                          ? 'Installing. Quanta will restart.'
                          : updateStatus.kind === 'up-to-date'
                            ? 'You are on the latest version.'
                            : updateStatus.kind === 'error'
                              ? updateStatus.message
                              : 'Check whenever you want a newer build.'
                  }
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onCheckUpdates}
                      disabled={updateStatus.kind === 'checking' || updateStatus.kind === 'downloading' || updateStatus.kind === 'installing'}
                      className="text-[13px] border border-[var(--line)] rounded-[4px] px-3 py-1.5 bg-[var(--bg-raised)]"
                    >
                      {updateStatus.kind === 'checking' ? 'Checking' : 'Check for updates'}
                    </button>
                    {updateStatus.kind === 'available' && (
                      <button type="button" onClick={onInstallUpdate} className="text-[13px] border border-[var(--fill)] rounded-[4px] px-3 py-1.5">
                        Install and restart
                      </button>
                    )}
                  </div>
                </SettingRow>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
