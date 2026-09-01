import Link from 'next/link';
import type { Guide } from '@/lib/guides';
import { Card } from '@/components/ui/Card';

export function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Card interactive className="relative flex h-full flex-col p-4">
      <p className="text-meta text-fg-faint nums">
        {guide.category}
      </p>
      <h3 className="mt-2 text-body font-semibold font-600">
        <Link
          href={`/guides/${guide.slug}`}
          className="after:absolute after:inset-0 after:content-['']"
        >
          {guide.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-body text-fg-muted">{guide.description}</p>
      <p className="mt-3 text-meta nums text-fg-faint" data-numeric="">
        {guide.readingMinutes} min de lecture ·{' '}
        {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
          new Date(guide.published),
        )}
      </p>
    </Card>
  );
}
