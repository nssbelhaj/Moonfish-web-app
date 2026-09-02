import { databaseEnabled } from '@/lib/db/mysql';

/**
 * Disponibilité des comptes, SANS importer la bibliothèque d'authentification.
 *
 * Ce module existe pour une raison de dépendances : le point de bascule des
 * fournisseurs (`src/lib/providers/index.ts`) a besoin de savoir si les
 * comptes sont ouverts, mais il ne doit pas tirer Auth.js avec lui. Sans cette
 * séparation, le simple fait de lire la liste des spots dans un test chargeait
 * tout le cadre d'authentification et échouait sur `next/server`.
 *
 * La règle générale : les couches basses ne connaissent pas les hautes.
 */

function smtpServer(): string | undefined {
  const url = process.env.EMAIL_SERVER?.trim();
  return url && url.length > 0 ? url : undefined;
}

/** L'envoi de courriel est-il configuré ? Sans lui, aucune connexion possible. */
export function mailEnabled(): boolean {
  return smtpServer() !== undefined && (process.env.EMAIL_FROM?.trim() ?? '').length > 0;
}

/**
 * Les comptes sont ouverts quand la base ET l'envoi de courriel sont
 * configurés.
 *
 * Les deux, pas l'un ou l'autre : une base sans courriel donnerait un
 * formulaire de connexion qui n'envoie jamais rien, et un courriel sans base
 * n'aurait nulle part où écrire la session.
 */
export function accountsEnabled(): boolean {
  return databaseEnabled() && mailEnabled();
}

export { smtpServer };
