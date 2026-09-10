import type { Metadata } from 'next';
import Link from 'next/link';

import { NouveauMotDePasseForm } from '@/components/account/AuthForms';
import { Section } from '@/components/ui/Section';
import { accountsEnabled } from '@/lib/auth/config';
import { absoluteUrl } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choisir un nouveau mot de passe',
  alternates: { canonical: absoluteUrl('/compte/nouveau-mot-de-passe') },
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const brut = (await searchParams)['jeton'];
  const jeton = typeof brut === 'string' ? brut : '';

  return (
    <Section title="Choisir un nouveau mot de passe">
      {!accountsEnabled() ? (
        <p className="demo-frame max-w-prose p-4 text-read text-fg-muted">
          Les comptes ne sont pas ouverts sur ce déploiement.
        </p>
      ) : jeton === '' ? (
        /*
          Aucun jeton dans l'adresse : le lien a été tronqué en chemin, ce que
          font certains clients de messagerie. On le DIT, plutôt que d'afficher
          un formulaire qui échouerait à l'envoi sans expliquer pourquoi.
        */
        <div className="max-w-prose">
          <p className="demo-frame p-4 text-read text-fg-muted">
            Ce lien est incomplet — il a probablement été coupé par votre logiciel de messagerie.
          </p>
          <p className="mt-4 text-body text-fg-muted">
            <Link
              href="/compte/mot-de-passe-oublie"
              className="underline decoration-dotted underline-offset-4"
            >
              Demander un nouveau lien
            </Link>
          </p>
        </div>
      ) : (
        <div className="max-w-prose">
          <div className="surface p-4">
            <NouveauMotDePasseForm jeton={jeton} />
          </div>
          <p className="mt-4 text-body text-fg-muted">
            <Link href="/compte" className="underline decoration-dotted underline-offset-4">
              Retour à la connexion
            </Link>
          </p>
        </div>
      )}
    </Section>
  );
}
