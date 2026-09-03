import NextAuth from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import type { Provider } from 'next-auth/providers';

import { accountsEnabled, mailEnabled, smtpServer } from '@/lib/auth/config';
import { SITE_NAME, verificationEmail } from '@/lib/auth/email-template';
import { MysqlAdapter } from '@/lib/auth/mysql-adapter';

export { accountsEnabled, mailEnabled };

/**
 * Authentification : un lien reçu par courriel, et rien d'autre.
 *
 * Pas de mot de passe, volontairement. Ce que nous ne stockons pas ne peut pas
 * fuir, et un site de pêche n'a aucune raison de détenir un secret qu'une
 * personne réutilise peut-être ailleurs. Pas de fournisseur externe non plus :
 * « se connecter avec Google » ferait savoir à Google que vous pêchez.
 *
 * Les sessions sont EN BASE, pas dans un jeton signé. Conséquence qui compte :
 * une déconnexion ou une suppression de compte prend effet immédiatement,
 * partout, alors qu'un jeton auto-porté reste valable jusqu'à son expiration —
 * y compris après un « supprimez mes données ».
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MysqlAdapter(),
  session: { strategy: 'database', maxAge: 60 * 60 * 24 * 30 },

  /*
    Le transtypage tient à une incohérence des types d'Auth.js sous
    `exactOptionalPropertyTypes` : la bibliothèque déclare le paramètre
    `provider` de `sendVerificationRequest` comme `NodemailerConfig` là où
    l'interface attend `EmailConfig`. Rien dans NOTRE code n'est affaibli — la
    concession est limitée à cette frontière, et le drapeau strict reste actif
    partout ailleurs.
  */
  /*
    Le fournisseur n'est déclaré QUE si l'envoi de courriel est configuré.
    Auth.js valide sa configuration au chargement du module et refuse un
    serveur SMTP vide : sans cette condition, un déploiement sans courriel ne
    COMPILAIT PLUS — « Failed to collect page data » — alors que le site est
    précisément conçu pour fonctionner sans comptes, en le disant.
  */
  providers: mailEnabled()
    ? [
        Nodemailer({
          server: smtpServer() ?? '',
          from: process.env.EMAIL_FROM ?? 'lunamarea@localhost',
          // Une heure. Le défaut d'Auth.js est de 24 h : c'est long pour un lien
          // qui donne accès à un compte et qui traîne dans une boîte aux lettres.
          maxAge: 60 * 60,

          async sendVerificationRequest({ identifier, url, provider }) {
            const { host } = new URL(url);
            const { text, html } = verificationEmail(url, host);

            // Import tardif : `nodemailer` ne doit pas être embarqué dans les
            // paquets qui n'envoient pas de courriel.
            const { createTransport } = await import('nodemailer');
            const transport = createTransport(provider.server);

            const result = await transport.sendMail({
              to: identifier,
              from: provider.from,
              subject: `Votre lien de connexion à ${SITE_NAME}`,
              text,
              html,
            });

            const refused = result.rejected.concat(result.pending).filter(Boolean);
            if (refused.length > 0) {
              // Échouer bruyamment : un courriel refusé par le serveur SMTP qui
              // passerait pour un envoi réussi laisserait la personne attendre un
              // message qui n'arrivera jamais.
              throw new Error(`Courriel refusé par le serveur d’envoi (${refused.join(', ')}).`);
            }
              },
        }) as Provider,
      ]
    : [],

  pages: {
    signIn: '/compte',
    verifyRequest: '/compte?lien=envoye',
    error: '/compte',
  },

  callbacks: {
    /*
      L'identifiant est recopié dans la session pour que le reste du code n'ait
      jamais à interroger la base pour savoir QUI agit. C'est cet identifiant
      qui est passé aux suppressions, où il tient lieu de la politique de
      sécurité que PostgreSQL appliquait.
    */
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },

  // Les journaux d'un hébergeur mutualisé sont lisibles par plus de monde
  // qu'on ne croit : pas de détail d'authentification en dehors du débogage.
  debug: false,
});
