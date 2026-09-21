import { ChevronRight, SquareArrowOutUpRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MenuItem = {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  confirm?: string;
  disabled?: boolean;
  external?: boolean;
  children?: MenuItem[];
};

export type MenuEntry = MenuItem | { separator: true };

interface Props {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
}

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return 'separator' in entry && entry.separator === true;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const [pending, setPending] = useState<MenuItem | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const confirmRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = () => onClose();
    const timer = window.setTimeout(() => {
      window.addEventListener('click', close);
      window.addEventListener('scroll', close, true);
      window.addEventListener('contextmenu', close);
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [pending]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - r.width - 8);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - r.height - 8);
    setPos({ left, top });
  }, [x, y, pending, openSub]);

  const run = (item: MenuItem) => {
    item.onSelect?.();
    onClose();
  };

  const flipSub = pos.left > window.innerWidth - 340;

  return createPortal(
    <div
      ref={rootRef}
      data-no-drag
      className="fixed z-[80] w-max min-w-[9.5rem] py-0.5 bg-[var(--bg)] border border-[var(--line)] shadow-[0_8px_20px_var(--shadow)]"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      role={pending ? 'alertdialog' : 'menu'}
      aria-label={pending?.confirm}
    >
      {pending ? (
        <div className="px-2 py-1.5">
          <p className="text-[12px] leading-snug truncate">{pending.confirm}</p>
          <div className="mt-1 flex justify-end gap-0.5">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => run(pending)}
              className="text-[12px] px-1.5 py-0.5 font-medium hover:bg-[color-mix(in_hsl,var(--fill)_12%,transparent)]"
            >
              {pending.label}
            </button>
          </div>
        </div>
      ) : (
        items.map((entry, i) => {
          if (isSeparator(entry)) {
            return <div key={`sep-${i}`} role="separator" className="h-px my-0.5 mx-1.5 bg-[var(--line)]" />;
          }
          const subOpen = openSub === entry.label && Boolean(entry.children?.length);
          return (
            <div
              key={entry.label}
              className="relative"
              onMouseEnter={() => setOpenSub(entry.children?.length ? entry.label : null)}
            >
              <button
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => {
                  if (entry.disabled) return;
                  if (entry.children?.length) {
                    setOpenSub(entry.label);
                    return;
                  }
                  if (entry.confirm) setPending(entry);
                  else run(entry);
                }}
                className={`flex w-full items-center gap-1.5 text-start px-2 h-6 text-[12px] leading-none ${
                  entry.disabled
                    ? 'text-[var(--muted)] opacity-50'
                    : 'hover:bg-[color-mix(in_hsl,var(--fill)_12%,transparent)]'
                } ${entry.danger && !entry.disabled ? 'font-medium' : ''}`}
              >
                {entry.external ? (
                  <SquareArrowOutUpRight className="w-2.5 h-2.5 shrink-0 text-[var(--muted)]" />
                ) : null}
                <span className="flex-1 whitespace-nowrap">{entry.label}</span>
                {entry.children?.length ? <ChevronRight className="w-2.5 h-2.5 shrink-0 text-[var(--muted)]" /> : null}
              </button>
              {subOpen && entry.children ? (
                <div
                  className={`absolute top-0 w-max min-w-[8rem] py-0.5 bg-[var(--bg)] border border-[var(--line)] shadow-[0_8px_20px_var(--shadow)] ${
                    flipSub ? 'right-full' : 'left-full'
                  }`}
                  role="menu"
                >
                  {entry.children.map((child) => (
                    <button
                      key={child.label}
                      type="button"
                      role="menuitem"
                      onClick={() => run(child)}
                      className="block w-full text-start px-2 h-6 text-[12px] leading-none whitespace-nowrap hover:bg-[color-mix(in_hsl,var(--fill)_12%,transparent)]"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>,
    document.body,
  );
}
