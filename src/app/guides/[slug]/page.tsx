import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuideCard } from '@/components/guides/GuideCard';
import { getGuide, listGuides } from '@/lib/guides';
import { absoluteUrl } from '@/lib/routes';

interface RouteParams {
  slug: string;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  const guides = await listGuides();
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: 'Guide introuvable' };

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: absoluteUrl(`/guides/${guide.slug}`) },
    openGraph: {
      type: 'article',
      title: guide.title,
      description: guide.description,
      url: absoluteUrl(`/guides/${guide.slug}`),
      publishedTime: guide.published,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();

  const others = (await listGuides()).filter((item) => item.slug !== guide.slug).slice(0, 2);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.published,
    dateModified: guide.published,
    inLanguage: 'fr-FR',
    articleSection: guide.category,
    wordCount: guide.wordCount,
    url: absoluteUrl(`/guides/${guide.slug}`),
    author: { '@type': 'Organization', name: 'Moonfish' },
    publisher: { '@type': 'Organization', name: 'Moonfish' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/guides/${guide.slug}`) },
  };

  return (
    /*
      D6 : le thème clair habille les pages éditoriales, contenu de lecture
      longue et de jour. Ce n'est pas un mode d'affichage de l'app — le sondeur
      ne s'inverse pas, et prefers-color-scheme ne le déclenche pas.
    */
    <div className="bg-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="mx-auto w-full max-w-shell px-4 py-8 md:px-8 md:py-12">
        <nav aria-label="Fil d’Ariane" className="text-meta nums text-fg-muted">
          <Link href="/guides" className="underline decoration-dotted underline-offset-4">
            Guides
          </Link>
          {' / '}
          {guide.category}
        </nav>

        <header className="mt-4 max-w-prose">
          <h1 className="font-serif text-h1 font-semibold">{guide.title}</h1>
          <p className="mt-3 text-meta nums text-fg-muted" data-numeric="">
            <time dateTime={guide.published}>
              {new Intl.DateTimeFormat('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date(guide.published))}
            </time>
            {' · '}
            {guide.readingMinutes} min de lecture · {guide.wordCount} mots
          </p>
        </header>

        {/*
          Le corps des guides est en Spectral : le changement de famille est le
          seul signal de bascule du mode de lecture (handoff §2.6).
          `dangerouslySetInnerHTML` est sûr ici : le convertisseur maison échappe
          tout le HTML avant transformation, aucun balisage brut ne passe.
        */}
        <div
          className="guide-prose mt-8 max-w-prose font-serif text-[19px]"
          dangerouslySetInnerHTML={{ __html: guide.html }}
        />

        <footer className="mt-12 border-t border-edge pt-8">
          <p className="text-body text-fg-muted">
            Les scores affichés sur Moonfish traduisent ce qui est décrit ici en une note par
            créneau de deux heures.{' '}
            <Link href="/spots" className="underline decoration-dotted underline-offset-4">
              Voir les 12 spots suivis
            </Link>
            .
          </p>

          <h2 className="mt-8 font-serif text-h2 font-semibold">À lire ensuite</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {others.map((other) => (
              <li key={other.slug}>
                <GuideCard guide={other} />
              </li>
            ))}
          </ul>
        </footer>
      </article>
    </div>
  );
}
