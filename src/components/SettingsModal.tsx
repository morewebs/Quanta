import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  Palette,
  Sliders,
  Keyboard,
  Info,
  Check,
} from 'lucide-react';
import { FontMode } from '../types/vault';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultPath: string | null;
  vaultName: string;
  onOpenVault: () => void;
  fontMode: FontMode;
  onChangeFontMode: (mode: FontMode) => void;
  isFullWidth: boolean;
  onToggleFullWidth: () => void;
  isRtlAutoDetect: boolean;
  onToggleRtlAutoDetect: () => void;
}

type SettingsTab = 'vault' | 'appearance' | 'editor' | 'hotkeys' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  vaultPath,
  vaultName,
  onOpenVault,
  fontMode,
  onChangeFontMode,
  isFullWidth,
  onToggleFullWidth,
  isRtlAutoDetect,
  onToggleRtlAutoDetect,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'vault', label: 'Vault', icon: <Folder className="w-3.5 h-3.5" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'editor', label: 'Editor', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'hotkeys', label: 'Hotkeys', icon: <Keyboard className="w-3.5 h-3.5" /> },
    { id: 'about', label: 'About', icon: <Info className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[760px] h-[520px] bg-zinc-925 border border-zinc-800/90 rounded-xl shadow-2xl flex overflow-hidden text-zinc-300 font-sans"
        style={{ backgroundColor: '#131316' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Sidebar */}
        <div className="w-48 border-r border-zinc-800/80 bg-zinc-950/60 p-3 flex flex-col justify-between shrink-0">
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
              Settings
            </div>
            <nav className="space-y-0.5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <span className={isActive ? 'text-sky-400' : 'text-zinc-500'}>
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Hint */}
          <div className="px-2 pt-2 border-t border-zinc-900 text-[10px] text-zinc-600 font-mono flex items-center justify-between">
            <span>Esc to close</span>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-900/30">
          {/* Header */}
          <div className="h-12 px-6 border-b border-zinc-800/60 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-zinc-100 capitalize">
              {activeTab}
            </h2>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* 1. VAULT */}
            {activeTab === 'vault' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="text-xs font-medium text-zinc-200">Current Vault</div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Physical directory path on disk where your markdown notes and assets are stored.
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <bdi
                      title={vaultPath || 'Default Vault'}
                      className="px-2 py-1 bg-zinc-950 border border-zinc-800/90 rounded text-[11px] font-mono text-zinc-400 max-w-[180px] truncate"
                    >
                      {vaultPath ? vaultPath.split(/[/\\]/).pop() : 'Default Vault'}
                    </bdi>
                    <button
                      onClick={onOpenVault}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded text-xs font-medium transition-colors"
                    >
                      Change...
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="text-xs font-medium text-zinc-200">Vault Display Name</div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Label shown in the sidebar header for this workspace.
                    </div>
                  </div>
                  <span className="text-xs font-medium text-zinc-300 px-2 py-1 bg-zinc-900 rounded border border-zinc-800">
                    {vaultName}
                  </span>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between py-3 border-b border-zinc-800/50">
                  <div className="space-y-0.5 max-w-[55%]">
                    <div className="text-xs font-medium text-zinc-200">Font Mode</div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Choose between semantic pairing (Auto), pure sans-serif, editorial serif, or developer monospace.
                    </div>
                  </div>
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                    {(
                      [
                        { id: 'auto', label: 'Auto' },
                        { id: 'sans', label: 'Sans' },
                        { id: 'serif', label: 'Serif' },
                        { id: 'mono', label: 'Mono' },
                      ] as const
                    ).map((m) => {
                      const isSelected = fontMode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => onChangeFontMode(m.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="text-xs font-medium text-zinc-200">Readable Line Length</div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Constrain note text to 72 characters centered for comfortable reading, or expand to full viewport width.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleFullWidth}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      !isFullWidth ? 'bg-sky-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        !isFullWidth ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* 3. EDITOR */}
            {activeTab === 'editor' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="text-xs font-medium text-zinc-200">
                      Dynamic RTL / Persian Detection
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Automatically right-align Persian and Arabic paragraphs, placing blockquote accents and bullets on the right side.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleRtlAutoDetect}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isRtlAutoDetect ? 'bg-sky-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isRtlAutoDetect ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div className="space-y-0.5 max-w-[65%]">
                    <div className="text-xs font-medium text-zinc-200">Live Preview</div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Conceal markdown syntax markers like headings and italics unless cursor is adjacent.
                    </div>
                  </div>
                  <span className="inline-flex items-center text-xs text-sky-400 font-medium">
                    <Check className="w-3.5 h-3.5 mr-1" /> Enabled
                  </span>
                </div>
              </div>
            )}

            {/* 4. HOTKEYS */}
            {activeTab === 'hotkeys' && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-500 mb-3">
                  Keyboard shortcuts configured across Quanta:
                </div>
                {[
                  { name: 'Quick Switcher', desc: 'Jump to note or create by title', keys: ['Ctrl', 'K'] },
                  { name: 'Settings', desc: 'Open preferences modal', keys: ['Ctrl', ','] },
                  { name: 'Toggle Left Sidebar', desc: 'Collapse or expand navigation tree', keys: ['Ctrl', '\\'] },
                  { name: 'New Note', desc: 'Create a new markdown note in root', keys: ['Ctrl', 'N'] },
                  { name: 'Close Dialogs', desc: 'Dismiss switcher or settings modal', keys: ['Esc'] },
                ].map((hk) => (
                  <div
                    key={hk.name}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-950/40 border border-zinc-800/40"
                  >
                    <div>
                      <div className="text-xs font-medium text-zinc-200">{hk.name}</div>
                      <div className="text-[11px] text-zinc-500">{hk.desc}</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {hk.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-mono text-zinc-300 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 5. ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-lg shrink-0 font-mono">
                    Q
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-zinc-100">Quanta</span>
                      <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded text-[10px] font-mono">
                        v1.0.0
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      A distraction-free, local-first markdown note engine built with Tauri v2, React 19, and CodeMirror 6.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-zinc-500">
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span>Architecture</span>
                    <span className="text-zinc-300 font-mono text-[11px]">Local-First / Offline Native</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span>Editor Core</span>
                    <span className="text-zinc-300 font-mono text-[11px]">CodeMirror 6 Live Preview</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
                    <span>Desktop Runtime</span>
                    <span className="text-zinc-300 font-mono text-[11px]">Tauri v2 + Rust</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
