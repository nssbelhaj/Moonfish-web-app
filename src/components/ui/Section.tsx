import type { ReactNode } from 'react';

/** Rythme de section du handoff : 32 mobile / 48 desktop, marge d'écran 16 / 32. */
export function Section({
  children,
  title,
  lead,
  id,
  as: Tag = 'section',
}: {
  children: ReactNode;
  title?: string;
  lead?: string;
  id?: string;
  as?: 'section' | 'div';
}) {
  return (
    <Tag id={id} className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
      {title && <h2 className="text-h2 font-600">{title}</h2>}
      {lead && <p className="mt-2 max-w-measure text-body text-fg-muted">{lead}</p>}
      <div className={title || lead ? 'mt-6' : undefined}>{children}</div>
    </Tag>
  );
}
