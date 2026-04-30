// Tiny shared primitives. Hand-rolled rather than pulling in shadcn/ui's
// scaffolder, since we only need a handful of components and want full
// control over the SupplyChain Flux look.

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-fg-onDeep hover:bg-navy-700 active:bg-navy-900',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-inset',
  ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-surface-inset',
  danger: 'bg-danger text-white hover:bg-red-700',
};

const buttonSizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    />
  );
});

// ---------- Input ----------

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-fg mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-fg-muted mt-1.5">{hint}</span>}
      {error && <span className="block text-xs text-danger mt-1.5">{error}</span>}
    </label>
  );
}

const inputBase =
  'block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-navy';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputBase, 'num', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(inputBase, 'pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

// ---------- Card ----------

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, trailing, children, className }: CardProps) {
  return (
    <section className={cn('surface p-6', className)}>
      {(title || subtitle || trailing) && (
        <header className="flex items-start justify-between mb-4">
          <div>
            {title && <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>}
            {subtitle && <p className="text-sm text-fg-muted mt-1">{subtitle}</p>}
          </div>
          {trailing}
        </header>
      )}
      {children}
    </section>
  );
}

// ---------- Pill ----------

type PillTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';

const pillTones: Record<PillTone, string> = {
  neutral: 'bg-surface-inset text-fg-muted',
  success: 'bg-accent-progress text-accent-progressInk',
  warn: 'bg-amber/15 text-amber',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-navy/10 text-navy',
};

export function Pill({ tone = 'neutral', children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return <span className={cn('pill', pillTones[tone], className)}>{children}</span>;
}

// ---------- Modal ----------

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const modalSizes: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'lg' }: ModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/50"
      onClick={onClose}
    >
      <div
        className={cn('w-full bg-surface rounded-card shadow-cardHover overflow-hidden', modalSizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-line">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
        </header>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <footer className="px-6 py-4 border-t border-line bg-surface-inset">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- Metric ----------

export function Metric({
  label,
  value,
  unit,
  trend,
  size = 'md',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  size?: 'sm' | 'md' | 'lg';
}) {
  const valueClass =
    size === 'lg' ? 'text-metric-lg' : size === 'sm' ? 'text-metric-sm' : 'text-metric';
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-fg-muted font-medium mb-1">
        {label}
      </div>
      <div className={cn('num text-fg', valueClass)}>
        {value}
        {unit && <span className="ml-1.5 text-sm text-fg-muted font-normal align-middle">{unit}</span>}
      </div>
      {trend && (
        <div
          className={cn(
            'text-xs mt-1',
            trend === 'up' && 'text-accent-progressInk',
            trend === 'down' && 'text-danger',
            trend === 'flat' && 'text-fg-muted',
          )}
        >
          {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
        </div>
      )}
    </div>
  );
}
