import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard cn() helper. Lets components compose Tailwind classes safely.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Locale-aware money formatter for landed-cost displays.
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
export function fmtUSD(n: number) {
  return usd.format(n);
}

// Compact integer formatter for inventory / order counts.
const compactInt = new Intl.NumberFormat('en-US', {
  notation: 'standard',
  maximumFractionDigits: 0,
});
export function fmtInt(n: number) {
  return compactInt.format(Math.round(n));
}
