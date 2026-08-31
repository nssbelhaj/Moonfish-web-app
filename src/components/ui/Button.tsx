import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Zones tactiles du handoff §2.7 : 48 px minimum, 56 px pour l'action primaire.
 * L'accent (best) n'est jamais décoratif : s'il apparaît, c'est qu'une action
 * primaire le porte.
 */
const BASE =
  'inline-flex items-center justify-center rounded-input px-5 font-600 transition-colors';

const VARIANTS = {
  primary: 'min-h-[56px] bg-accent text-abyss hover:opacity-90',
  secondary: 'min-h-[48px] border border-edge-strong text-fg hover:bg-card-raised',
  ghost: 'min-h-[48px] text-fg-muted hover:text-fg',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${BASE} ${VARIANTS[variant]} disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
