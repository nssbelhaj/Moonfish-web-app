import type { Point } from './etat';

/**
 * Essai RÉEL de connexion à la base.
 *
 * ── Pourquoi lire la configuration ne suffit pas ─────────────────────────
 *
 * Le diagnostic savait dire « DATABASE_URL est lisible, base X sur l'hôte Y ».
 * Il l'affirmait — en vert — alors que le serveur refusait toutes les
 * connexions : l'identifiant était resté le mot d'exemple `UTILISATEUR`.
 *
 * Entre « l'URL a la bonne forme » et « la base répond » il y a toute la
 * place pour : un utilisateur qui n'existe pas, un mot de passe faux, un hôte
 * qui refuse les connexions distantes, une base supprimée. Aucun de ces cas
 * ne se voit dans la forme de l'URL ; tous se voient en se connectant.
 */
export async function essaiBase(url: string | undefined): Promise<Point> {
  if (!url) {
    return {
      sujet: 'Connexion à la base',
      etat: 'absent',
      constat: 'DATABASE_URL est absente : rien à tester.',
      remede: 'Définissez DATABASE_URL, puis redéployez.',
    };
  }

  try {
    const mysql = await import('mysql2/promise');
    const connexion = await mysql.createConnection({ uri: url.trim(), connectTimeout: 8_000 });

    try {
      const [lignes] = await connexion.query('select 1 as vivant');
      const vivant = Array.isArray(lignes) && lignes.length === 1;

      return {
        sujet: 'Connexion à la base',
        etat: vivant ? 'ok' : 'attention',
        constat: vivant
          ? 'Connexion et authentification réussies. La base répond aux requêtes.'
          : 'La connexion s’ouvre mais la base ne répond pas comme attendu.',
        remede: vivant ? null : 'Vérifiez que la base existe et n’est pas en cours de restauration.',
      };
    } finally {
      await connexion.end().catch(() => undefined);
    }
  } catch (error) {
    const detail = (error as { sqlMessage?: string; code?: string; message?: string });
    const message = detail.sqlMessage ?? detail.message ?? String(error);

    /*
      Le message du serveur est rendu tel quel : c'est lui qui nomme la cause.
      Il contient l'identifiant refusé — ce qui est précisément l'information
      utile quand l'identifiant est le mot d'exemple — mais jamais le mot de
      passe. MySQL ne le met pas dans ses erreurs, et on le retire par
      précaution : cette sortie est faite pour être recopiée.
    */
    const motDePasse = motDePasseDe(url);
    const propre = motDePasse ? message.split(motDePasse).join('•••') : message;

    return {
      sujet: 'Connexion à la base',
      etat: 'absent',
      constat: `Impossible de se connecter. MySQL répond : « ${propre.slice(0, 300)} »`,
      remede: remedePour(detail.code ?? '', propre),
    };
  }
}

function motDePasseDe(url: string): string | null {
  try {
    const mot = decodeURIComponent(new URL(url.trim()).password);
    return mot.length > 0 ? mot : null;
  } catch {
    return null;
  }
}

function remedePour(code: string, message: string): string {
  if (code === 'ER_ACCESS_DENIED_ERROR' || message.includes('Access denied')) {
    return (
      'Identifiant ou mot de passe refusé. Relevez les DEUX dans hPanel → Bases de données MySQL : ' +
      'l’identifiant ressemble à « u0000000_nom », il ne s’invente pas. Attention à ne pas laisser ' +
      'le texte d’exemple de la documentation à la place d’une vraie valeur.'
    );
  }
  if (code === 'ER_BAD_DB_ERROR' || message.includes('Unknown database')) {
    return 'La base nommée dans l’URL n’existe pas. Son nom figure dans hPanel → Bases de données MySQL.';
  }
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || message.includes('ETIMEDOUT')) {
    return 'L’hôte ne répond pas sur ce port. Chez Hostinger, une application et sa base partagent la machine : l’hôte est « localhost ».';
  }
  if (code === 'ENOTFOUND') {
    return 'Le nom d’hôte est introuvable. Vérifiez qu’un « / » du mot de passe n’a pas coupé l’URL en deux.';
  }
  return 'Relisez DATABASE_URL : mysql://‹identifiant›:‹mot-de-passe›@localhost:3306/‹nom-de-la-base›';
}
