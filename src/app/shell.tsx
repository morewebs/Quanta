import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from '../editor/Editor';
import { FileTree } from '../ui/file-tree';
import { PromptDialog, type AppDialog } from '../ui/prompt-dialog';
import { Ribbon } from '../ui/ribbon';
import { RightSidebar } from '../ui/right-sidebar';
import { Settings } from '../ui/settings';
import { StatusBar } from '../ui/status-bar';
import { Switcher } from '../ui/switcher';
import { TitleBar } from '../ui/title-bar';
import { UpdateBanner } from '../ui/update-banner';
import { useUpdater } from '../updater';
import * as api from '../vault/api';
import { extractHeadings, extractOutgoing, extractTags } from '../vault/note-meta';
import type { AppConfig, AuthStatus, FontMode, NoteFile, SyncStatus, ThemeMode, VaultEntry } from '../vault/types';
import {
  findBacklinks,
  findVaultEntry,
  flattenVaultTree,
  normalizeNoteTitle,
  refactorWikilinksOnRename,
  titleFromPath,
} from '../vault/wikilinks';

export function Shell() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [auth, setAuth] = useState<AuthStatus>({ configured: false, authorized: false, name: null });
  const [tree, setTree] = useState<VaultEntry | null>(null);
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [heading, setHeading] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(true);
  const [linksOpen, setLinksOpen] = useState(true);
  const [switcher, setSwitcher] = useState(false);
  const [settings, setSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [sync, setSync] = useState<SyncStatus>({ state: 'idle' });
  const [fontMode, setFontMode] = useState<FontMode>(() => (localStorage.getItem('quanta_font') as FontMode) || 'auto');
  const [fullWidth, setFullWidth] = useState(() => localStorage.getItem('quanta_width') === 'full');
  const [rtl, setRtl] = useState(() => localStorage.getItem('quanta_rtl') !== 'off');
  const saveTimer = useRef<number | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const updater = useUpdater();
  const [dialog, setDialog] = useState<AppDialog | null>(null);
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('quanta_pinned') || '[]') as unknown;
      return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      return [];
    }
  });
  const [reveal, setReveal] = useState<{ path: string; n: number } | null>(null);
  const persistPinned = (next: string[]) => {
    setPinned(next);
    localStorage.setItem('quanta_pinned', JSON.stringify(next));
  };

  const active = notes.find((n) => n.relative_path === activePath) ?? null;
  const theme = (config?.theme as ThemeMode) || 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    const nextTree = await api.readVaultTree();
    setTree(nextTree);
    const flat = flattenVaultTree(nextTree);
    const previous = notesRef.current;
    const meta: NoteFile[] = flat.map((e) => ({
      relative_path: e.relative_path,
      title: titleFromPath(e.relative_path),
      content: previous.find((n) => n.relative_path === e.relative_path)?.content ?? '',
    }));
    setNotes(meta);
    setActivePath((current) => {
      if (current && meta.some((n) => n.relative_path === current)) return current;
      return meta[0]?.relative_path ?? null;
    });
    setTabs((current) => {
      const valid = current.filter((p) => meta.some((n) => n.relative_path === p));
      if (valid.length) return valid;
      return meta[0] ? [meta[0].relative_path] : [];
    });
    setPinned((current) => {
      const next = current.filter((p) => meta.some((n) => n.relative_path === p));
      if (next.length !== current.length) localStorage.setItem('quanta_pinned', JSON.stringify(next));
      return next;
    });
    window.setTimeout(async () => {
      const loaded: NoteFile[] = [];
      for (const n of meta) {
        if (n.content) continue;
        try {
          loaded.push({ ...n, content: await api.readNote(n.relative_path) });
        } catch {
          /* ignore */
        }
      }
      if (loaded.length) {
        setNotes((prev) => prev.map((n) => loaded.find((l) => l.relative_path === n.relative_path) || n));
      }
    }, 80);
  }, []);

  useEffect(() => {
    (async () => {
      const cfg = await api.getConfig();
      setConfig(cfg);
      document.documentElement.setAttribute('data-theme', cfg.theme || 'dark');
      const status = await api.tgStatus();
      setAuth(status);
      if (status.authorized) {
        try {
          await api.tgConnect();
          await api.tgStartUpdates();
        } catch {
          /* offline */
        }
      }
      await refresh();
      if (!import.meta.env.DEV) {
        window.setTimeout(() => updater.check(), 2500);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    let unlisten: Array<() => void> = [];
    (async () => {
      try {
        unlisten.push(
          await listen<SyncStatus>('sync-status', (e) => setSync(e.payload)),
          await listen('vault-changed', () => refresh()),
          await listen<string>('note-changed', async (e) => {
            const path = e.payload;
            const content = await api.readNote(path);
            setNotes((prev) => prev.map((n) => (n.relative_path === path ? { ...n, content } : n)));
          }),
        );
      } catch {
        /* browser preview */
      }
    })();
    return () => unlisten.forEach((fn) => fn());
  }, [refresh]);

  const openNote = async (relative: string, headingAnchor?: string) => {
    const content = await api.readNote(relative);
    const note: NoteFile = { relative_path: relative, title: titleFromPath(relative), content };
    setNotes((prev) => {
      if (prev.some((n) => n.relative_path === relative)) {
        return prev.map((n) => (n.relative_path === relative ? note : n));
      }
      return [...prev, note];
    });
    setTabs((prev) => {
      if (prev.includes(relative)) return prev;
      if (pinned.includes(relative)) {
        const next = [...prev];
        next.splice(
          next.filter((p) => pinned.includes(p)).length,
          0,
          relative,
        );
        return next;
      }
      return [...prev, relative];
    });
    setActivePath(relative);
    setHeading(headingAnchor || null);
  };

  const closeTab = (path: string) => {
    setTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      setActivePath((current) => {
        if (current !== path) return current;
        const i = prev.indexOf(path);
        return next[i] || next[i - 1] || next[0] || null;
      });
      return next;
    });
  };

  const closeOthers = (keep: string) => {
    setTabs((prev) => {
      const next = prev.filter((p) => p === keep || pinned.includes(p));
      setActivePath((current) => (current && next.includes(current) ? current : keep));
      return next;
    });
  };

  const closeToTheRight = (path: string) => {
    setTabs((prev) => {
      const i = prev.indexOf(path);
      const next = prev.filter((p, idx) => idx <= i || pinned.includes(p));
      setActivePath((current) => (current && next.includes(current) ? current : path));
      return next;
    });
  };

  const closeAllTabs = () => {
    setTabs([]);
    setActivePath(null);
  };

  const togglePin = (path: string) => {
    const isPinned = pinned.includes(path);
    persistPinned(isPinned ? pinned.filter((p) => p !== path) : [...pinned, path]);
    setTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      const pinCount = next.filter((p) => pinned.includes(p) && p !== path).length;
      next.splice(pinCount, 0, path);
      return next;
    });
  };

  const copyPath = async (relative: string, asRelative: boolean) => {
    const text = asRelative ? relative : findVaultEntry(tree, relative)?.path || relative;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const revealInTree = (path: string) => {
    setFilesOpen(true);
    setReveal({ path, n: Date.now() });
  };

  const mapRelocated = (p: string, from: string, to: string, isDir: boolean) => {
    if (p === from) return to;
    if (isDir && p.startsWith(`${from}/`)) return `${to}${p.slice(from.length)}`;
    return p;
  };

  const relocate = async (
    relative: string,
    newRel: string,
    isDir: boolean,
    titles?: { old: string; next: string },
  ) => {
    if (newRel === relative) return;
    await api.renamePath(relative, newRel);
    if (!isDir && titles && titles.old !== titles.next) {
      for (const note of notesRef.current) {
        if (note.relative_path === relative || !note.content) continue;
        const { updatedContent, count } = refactorWikilinksOnRename(note.content, titles.old, titles.next);
        if (count) await api.writeNote(note.relative_path, updatedContent);
      }
    }
    const map = (p: string) => mapRelocated(p, relative, newRel, isDir);
    setTabs((prev) => prev.map(map));
    persistPinned(pinned.map(map));
    const wasActive = activePath === relative || (isDir && Boolean(activePath?.startsWith(`${relative}/`)));
    const nextActive = activePath ? map(activePath) : activePath;
    await refresh();
    if (wasActive && nextActive) await openNote(nextActive);
  };

  const createNote = async (folder?: string, title?: string) => {
    let name = title?.trim() || '';
    if (!name) {
      let i = 1;
      name = `Untitled ${i}`;
      while (notes.some((n) => normalizeNoteTitle(n.title) === normalizeNoteTitle(name))) {
        i += 1;
        name = `Untitled ${i}`;
      }
    }
    const file = name.endsWith('.md') ? name : `${name}.md`;
    const relative = folder ? `${folder.replace(/\/$/, '')}/${file}` : file;
    await api.createNote(relative, `# ${name.replace(/\.md$/i, '')}\n\n`);
    await refresh();
    await openNote(relative);
  };

  const createFolder = (parent?: string) => {
    setDialog({
      kind: 'prompt',
      title: 'New folder',
      hint: parent ? `Inside ${parent}` : 'Created at the vault root.',
      confirmLabel: 'Create',
      onSubmit: async (name) => {
        const relative = parent ? `${parent.replace(/\/$/, '')}/${name}` : name;
        await api.createDir(relative);
        await refresh();
      },
    });
  };

  const rename = (relative: string, isDir = false) => {
    const current = titleFromPath(relative);
    setDialog({
      kind: 'prompt',
      title: isDir ? 'Rename folder' : 'Rename note',
      value: current,
      confirmLabel: 'Rename',
      onSubmit: async (next) => {
        if (next === current) return;
        const dir = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/') + 1) : '';
        const newRel = isDir ? `${dir}${next}` : `${dir}${next.replace(/\.md$/i, '')}.md`;
        await relocate(relative, newRel, isDir, { old: current, next });
      },
    });
  };

  const moveTo = (relative: string, isDir: boolean) => {
    const parent = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : '';
    setDialog({
      kind: 'prompt',
      title: isDir ? 'Move folder' : 'Move file',
      hint: 'Vault-relative folder. Leave empty for the vault root.',
      value: parent,
      allowEmpty: true,
      confirmLabel: 'Move',
      onSubmit: async (folder) => {
        const dest = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (dest.includes('..')) return;
        const name = relative.split('/').pop() || relative;
        const newRel = dest ? `${dest}/${name}` : name;
        await relocate(relative, newRel, isDir);
      },
    });
  };

  const remove = async (relative: string) => {
    await api.deletePath(relative);
    setTabs((prev) => {
      const gone = (p: string) => p === relative || p.startsWith(`${relative}/`);
      const next = prev.filter((p) => !gone(p));
      setActivePath((current) => {
        if (!current || !gone(current)) return current;
        const i = prev.findIndex(gone);
        return next[Math.min(i, Math.max(next.length - 1, 0))] || null;
      });
      return next;
    });
    await refresh();
  };

  const onChange = (content: string) => {
    if (!activePath) return;
    setSaving(true);
    setNotes((prev) => prev.map((n) => (n.relative_path === activePath ? { ...n, content } : n)));
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const path = activePath;
    saveTimer.current = window.setTimeout(async () => {
      try {
        await api.writeNote(path, content);
      } finally {
        setSaving(false);
      }
    }, 400);
  };

  const navigateWiki = async (target: string, headingAnchor?: string) => {
    const existing = notes.find((n) => normalizeNoteTitle(n.title) === normalizeNoteTitle(target));
    if (existing) await openNote(existing.relative_path, headingAnchor);
    else await createNote(undefined, target.trim());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'p')) {
        e.preventDefault();
        setSwitcher((v) => !v);
      } else if (mod && e.key === ',') {
        e.preventDefault();
        setSettings((v) => !v);
      } else if (mod && e.key === 'n') {
        e.preventDefault();
        createNote();
      } else if (mod && e.key === 'w') {
        e.preventDefault();
        if (activePath) closeTab(activePath);
      } else if (mod && e.key === 'b') {
        e.preventDefault();
        setFilesOpen((v) => !v);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLinksOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const titles = useMemo(() => new Set(notes.map((n) => normalizeNoteTitle(n.title))), [notes]);
  const auto = useMemo(
    () => notes.map((n) => ({ title: n.title, relativePath: n.relative_path })),
    [notes],
  );
  const backlinks = useMemo(
    () => (active ? findBacklinks(active.title, notes) : []),
    [active, notes],
  );
  const headings = useMemo(() => (active ? extractHeadings(active.content) : []), [active]);
  const tags = useMemo(() => (active ? extractTags(active.content) : []), [active]);
  const outgoing = useMemo(() => (active ? extractOutgoing(active.content) : []), [active]);
  const tabItems = tabs.map((path) => ({
    path,
    title: titleFromPath(path),
    pinned: pinned.includes(path),
  }));
  const tabActions = {
    onClose: closeTab,
    onCloseOthers: closeOthers,
    onCloseRight: closeToTheRight,
    onCloseAll: closeAllTabs,
    onPin: togglePin,
    onRename: (path: string) => rename(path, false),
    onCopyPath: (path: string, relative: boolean) => {
      void copyPath(path, relative);
    },
    onOpenInOs: (path: string) => {
      void api.openInOs(path);
    },
    onRevealOs: (path: string) => {
      void api.revealInOs(path);
    },
    onRevealTree: revealInTree,
  };

  const syncLabel = auth.authorized
    ? sync.state === 'idle'
      ? 'Telegram idle'
      : sync.detail || sync.state
    : 'Local only';

  const vaultName = tree?.name || 'Vault';

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <TitleBar
        tabs={tabItems}
        active={activePath}
        onSelect={(p) => openNote(p)}
        tabActions={tabActions}
        filesOpen={filesOpen}
        linksOpen={linksOpen}
        onToggleLinks={() => setLinksOpen((v) => !v)}
      />
      <div className="flex-1 flex min-h-0">
        <Ribbon
          filesOpen={filesOpen}
          onToggleFiles={() => setFilesOpen((v) => !v)}
          onSearch={() => setSwitcher(true)}
          onNewNote={() => createNote()}
          onSettings={() => setSettings(true)}
        />
        {filesOpen && (
          <FileTree
            tree={tree}
            active={activePath}
            reveal={reveal}
            onOpen={(p) => openNote(p)}
            onCreateNote={(folder) => createNote(folder)}
            onCreateFolder={(parent) => createFolder(parent)}
            onRename={rename}
            onMove={moveTo}
            onDelete={remove}
            onCopyPath={(path, kind) => {
              void copyPath(path, kind === 'relative');
            }}
            onOpenInOs={(path) => {
              void api.openInOs(path);
            }}
            onRevealOs={(path) => {
              void api.revealInOs(path);
            }}
          />
        )}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <UpdateBanner
            status={updater.status}
            onInstall={() => updater.install()}
            onSkip={updater.skip}
            onDismiss={updater.dismiss}
          />
          <Editor
            note={active}
            onChange={onChange}
            existingTitles={titles}
            notes={auto}
            onNavigate={navigateWiki}
            heading={heading}
            fontMode={fontMode}
            fullWidth={fullWidth}
            rtl={rtl}
            onStats={setStats}
          />
        </main>
        {linksOpen && (
          <RightSidebar
            headings={headings}
            tags={tags}
            incoming={backlinks}
            outgoing={outgoing}
            onOpenHeading={(text) => setHeading(text)}
            onOpenNote={(target) => navigateWiki(target)}
            onOpenBacklink={(p) => openNote(p)}
          />
        )}
      </div>
      <StatusBar
        vaultName={vaultName}
        saving={saving}
        words={stats.words}
        chars={stats.chars}
        syncLabel={syncLabel}
        fontMode={fontMode}
      />
      <Switcher
        open={switcher}
        tree={tree}
        onClose={() => setSwitcher(false)}
        onOpen={(p) => openNote(p)}
        onCreate={(title) => createNote(undefined, title)}
      />
      {config && (
        <Settings
          open={settings}
          onClose={() => setSettings(false)}
          config={config}
          onConfig={setConfig}
          auth={auth}
          onAuthChange={() => api.tgStatus().then(setAuth)}
          fontMode={fontMode}
          onFontMode={(m) => {
            setFontMode(m);
            localStorage.setItem('quanta_font', m);
          }}
          rtl={rtl}
          onRtl={(v) => {
            setRtl(v);
            localStorage.setItem('quanta_rtl', v ? 'on' : 'off');
          }}
          fullWidth={fullWidth}
          onToggleWidth={() => {
            setFullWidth((v) => {
              localStorage.setItem('quanta_width', !v ? 'full' : 'measure');
              return !v;
            });
          }}
          onPickVault={async () => {
            await api.pickVaultFolder();
            setConfig(await api.getConfig());
            await refresh();
          }}
          appVersion={updater.version}
          updateStatus={updater.status}
          onCheckUpdates={() => updater.check({ ignoreSkip: true })}
          onInstallUpdate={() => updater.install()}
        />
      )}
      <PromptDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
