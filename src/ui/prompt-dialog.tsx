import { useEffect, useRef, useState } from 'react';

export type AppDialog = {
  kind: 'prompt';
  title: string;
  hint?: string;
  value?: string;
  confirmLabel?: string;
  allowEmpty?: boolean;
  onSubmit: (value: string) => void;
};

interface Props {
  dialog: AppDialog | null;
  onClose: () => void;
}

export function PromptDialog({ dialog, onClose }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dialog) return;
    setValue(dialog.value ?? '');
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [dialog, onClose]);

  if (!dialog) return null;

  const submit = () => {
    const next = value.trim();
    if (!next && !dialog.allowEmpty) return;
    dialog.onSubmit(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[hsl(32_18%_7%/0.45)] flex items-start justify-center pt-[18vh] px-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-md bg-[var(--bg)] border border-[var(--line)] shadow-[0_24px_64px_var(--shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[15px] font-medium">{dialog.title}</h2>
          {dialog.hint && <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">{dialog.hint}</p>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="px-4 pb-2"
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-[var(--bg-raised)] border border-[var(--line)] rounded-[4px] px-3 py-2 text-[14px] outline-none"
          />
        </form>
        <div className="px-4 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-[13px] px-3 py-1.5 text-[var(--muted)] hover:text-[var(--text)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="text-[13px] px-3 py-1.5 border rounded-[4px] border-[var(--line)] bg-[var(--bg-raised)]"
          >
            {dialog.confirmLabel || 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
