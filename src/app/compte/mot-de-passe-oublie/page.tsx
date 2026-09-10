import type { Metadata } from 'next';
import Link from 'next/link';

import { MotDePasseOublieForm } from '@/components/account/AuthForms';
import { Section } from '@/components/ui/Section';
import { accountsEnabled, magicLinkEnabled } from '@/lib/auth/config';
import { absoluteUrl } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  description: 'Recevoir un lien pour choisir un nouveau mot de passe Luna Marea.',
  alternates: { canonical: absoluteUrl('/compte/mot-de-passe-oublie') },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <Section title="Mot de passe oublié">
      {!accountsEnabled() ? (
        <p className="demo-frame max-w-prose p-4 text-read text-fg-muted">
          Les comptes ne sont pas ouverts sur ce déploiement.
        </p>
      ) : !magicLinkEnabled() ? (
        /*
          Sans serveur d'envoi, cette page ne peut RIEN faire. Afficher le
          formulaire quand même serait cruel : on attendrait un courriel qui
          ne peut pas partir, sur la seule voie de récupération d'un compte.
        */
        <div className="max-w-prose">
          <p className="demo-frame p-4 text-read text-fg-muted">
            <strong className="font-600 text-fg">
              L’envoi de courriel n’est pas encore configuré sur ce site.
            </strong>{' '}
            Aucun lien de réinitialisation ne peut donc partir, et nous préférons le dire plutôt
            que d’afficher un formulaire sans effet.
          </p>
          <p className="mt-4 text-read text-fg-muted">
            Écrivez-nous depuis la{' '}
            <Link href="/contact" className="underline decoration-dotted underline-offset-4">
              page de contact
            </Link>{' '}
            et nous rouvrirons votre accès à la main.
          </p>
        </div>
      ) : (
        <div className="max-w-prose">
          <p className="text-read text-fg-muted">
            Indiquez l’adresse de votre compte. Si elle nous est connue, un lien y sera envoyé ; il
            est valable une heure et ne sert qu’une fois.
          </p>
          <div className="surface mt-6 p-4">
            <MotDePasseOublieForm />
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
