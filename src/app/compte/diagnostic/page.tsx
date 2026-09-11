import type { Metadata } from 'next';
import Link from 'next/link';

import { Section } from '@/components/ui/Section';
import { SPOTS } from '@/data/spots';
import { estProprietaire } from '@/lib/auth/proprietaire';
import { BUILD_STAMP } from '@/lib/build-stamp';
import { diagnostiquer, verdictGlobal, type Etat, type Point } from '@/lib/diagnostic/etat';
import { etatMigrations } from '@/lib/diagnostic/migrations';
import { uploadsDir } from '@/lib/photo/storage';
import { absoluteUrl } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'État du déploiement',
  alternates: { canonical: absoluteUrl('/compte/diagnostic') },
  robots: { index: false, follow: false },
};

/**
 * L'état de la configuration, LISIBLE, sans terminal ni secret.
 *
 * La même information existe en JSON sur `/api/diagnostic`, pour une tâche
 * planifiée. Cette page-ci est pour un humain : elle demande seulement d'être
 * connecté avec le compte qui a déployé le site.
 *
 * Elle n'expose aucune valeur de secret — le module de diagnostic s'en charge,
 * et un test le vérifie.
 */

const ETIQUETTE: Record<Etat, { texte: string; classe: string }> = {
  ok: { texte: 'OK', classe: 'text-bon' },
  attention: { texte: 'À VÉRIFIER', classe: 'text-warn' },
  absent: { texte: 'MANQUANT', classe: 'text-danger' },
};

function Ligne({ point }: { point: Point }) {
  const etiquette = ETIQUETTE[point.etat];

  return (
    <article className="surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-serif text-[17px] font-semibold">{point.sujet}</h3>
        {/* L'état est écrit EN TOUTES LETTRES, pas seulement coloré : une
            pastille verte ou rouge ne dit rien en niveaux de gris. */}
        <span className={`text-meta font-600 ${etiquette.classe}`}>{etiquette.texte}</span>
      </div>

      <p className="mt-2 text-body text-fg-muted">{point.constat}</p>
      {point.remede !== null && (
        <p className="mt-2 text-body">
          <span className="font-600">À faire : </span>
          <span className="text-fg-muted">{point.remede}</span>
        </p>
      )}
    </article>
  );
}

export default async function Page() {
  if (!(await estProprietaire())) {
    return (
      <Section title="État du déploiement">
        <p className="demo-frame max-w-prose p-4 text-read text-fg-muted">
          Cette page est réservée au compte qui a déployé le site — le premier inscrit.{' '}
          <Link href="/compte" className="underline decoration-dotted underline-offset-4">
            Se connecter
          </Link>
          .
        </p>
      </Section>
    );
  }

  const points = diagnostiquer({
    env: process.env,
    buildStamp: BUILD_STAMP,
    spotCount: SPOTS.length,
    uploadsDir: uploadsDir(),
    appDir: process.cwd(),
  });

  points.push(await etatMigrations());

  const rang = (etat: Etat) => (etat === 'absent' ? 0 : etat === 'attention' ? 1 : 2);
  const ordonnes = [...points].sort((a, b) => rang(a.etat) - rang(b.etat));
  const verdict = verdictGlobal(points);

  const resume = {
    absent: points.filter((p) => p.etat === 'absent').length,
    attention: points.filter((p) => p.etat === 'attention').length,
    ok: points.filter((p) => p.etat === 'ok').length,
  };

  return (
    <Section title="État du déploiement">
      <p className="max-w-prose text-read text-fg-muted">
        {verdict === 'ok'
          ? 'Tout est en place.'
          : verdict === 'attention'
            ? 'Le site fonctionne, mais certains points méritent d’être réglés.'
            : 'Il manque des éléments indispensables. Ils sont listés en premier.'}{' '}
        <span className="nums">
          {resume.absent} manquant{resume.absent > 1 ? 's' : ''} · {resume.attention} à vérifier ·{' '}
          {resume.ok} OK
        </span>
      </p>

      <p className="mt-2 max-w-prose text-body text-fg-muted">
        Aucune valeur de secret n’apparaît ici : cette page dit qu’une variable est définie, jamais
        son contenu. Elle peut donc être recopiée sans risque.
      </p>

      <div className="mt-6 flex max-w-[46rem] flex-col gap-3">
        {ordonnes.map((point) => (
          <Ligne key={point.sujet} point={point} />
        ))}
      </div>

      <p className="mt-6 text-body text-fg-muted">
        L’essai de connexion au serveur d’envoi n’est pas lancé ici : il ouvre une vraie connexion.
        Pour l’inclure :{' '}
        <code className="nums">/api/diagnostic?smtp=1</code>, connecté avec ce compte.
      </p>
    </Section>
  );
}
