// Brand chrome: wordmark + Operations Briefing tag, used in the lobby and
// the simulation top bar.

import { PRODUCT } from '@/lib/copy';
import { cn } from '@/lib/cn';

interface Props {
  variant?: 'lobby' | 'chrome';
  className?: string;
}

export function Brand({ variant = 'chrome', className }: Props) {
  const isLobby = variant === 'lobby';
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <BrandMark size={isLobby ? 36 : 24} />
      <div className="leading-none">
        <div
          className={cn(
            'font-display font-semibold tracking-tight',
            isLobby ? 'text-2xl text-fg' : 'text-base text-fg',
          )}
        >
          {PRODUCT.name}
        </div>
        <div
          className={cn(
            'font-sans text-fg-muted',
            isLobby ? 'text-sm mt-1' : 'text-xs mt-0.5',
          )}
        >
          {PRODUCT.subtitle}
        </div>
      </div>
    </div>
  );
}

export function BrandMark({ size = 24, tone = 'navy' as 'navy' | 'onDeep' }: { size?: number; tone?: 'navy' | 'onDeep' }) {
  const surface = tone === 'navy' ? '#1B263B' : '#F8F9FA';
  const stroke = tone === 'navy' ? '#D8F3DC' : '#1B263B';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill={surface} />
      <path
        d="M6 22 L10 14 L14 20 L18 10 L22 18 L26 12"
        stroke={stroke}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
