import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

import { databaseEnabled } from '@/lib/db/mysql';
import { checkMysqlLimit, refundMysqlLimit } from '@/lib/providers/mysql/rate-limit';
import { SlidingWindowRateLimiter, type RateLimitDecision } from '@/lib/rate-limit';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Les budgets d'appel, en un seul endroit
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un seul point d'entrée était protégé jusqu'ici : la liste d'attente. Le
 * formulaire de connexion, lui, ne l'était pas — alors que c'est le seul de
 * tout le site qui, sans authentification, fait PARTIR UN COURRIEL vers une
 * adresse choisie par l'appelant.
 *
 * Trois budgets le couvrent, et les trois sont nécessaires :
 *
 *   • par adresse — empêche de noyer une boîte précise ;
 *   • par IP — empêche d'arroser mille adresses différentes depuis un script ;
 *   • global — empêche de dépasser le plafond horaire du serveur d'envoi.
 *
 * Le troisième mérite un mot, parce qu'il a l'air excessif. Un hébergeur
 * mutualisé plafonne les envois SMTP à l'heure ; au-delà, il SUSPEND le compte
 * d'envoi. Or il n'y a pas de mot de passe de secours sur ce site : sans
 * courriel, plus personne ne se connecte, et le rétablissement passe par un
 * humain chez l'hébergeur. Une limite atteinte, elle, se relâche toute seule
 * en une heure. Entre les deux pannes, le choix n'est pas difficile.
 */

export interface Budget {
  /** Identifie la file en base. Ne jamais renommer sans vider la table. */
  readonly bucket: string;
  readonly limit: number;
  readonly windowMs: number;
}

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

export const BUDGETS = {
  /** Trois liens vers la même adresse par quart d'heure. Un humain qui ne reçoit rien réessaie deux ou trois fois. */
  connexionAdresse: { bucket: 'connexion-adresse', limit: 3, windowMs: 15 * MINUTE },

  /** Dix par IP et par heure : large pour un foyer ou un bureau partagé, étroit pour un script. */
  connexionIp: { bucket: 'connexion-ip', limit: 10, windowMs: HEURE },

  /** Plafond de tout le site. Volontairement sous le plafond de l'hébergeur. */
  connexionGlobal: { bucket: 'connexion-global', limit: 60, windowMs: HEURE },

  /** Écritures d'un compte : avis, prises, favoris, sorties. */
  contribution: { bucket: 'contribution', limit: 40, windowMs: HEURE },

  /** Dépôts de photos. Plus bas : chaque dépôt occupe du disque. */
  photo: { bucket: 'photo', limit: 20, windowMs: HEURE },
} as const satisfies Record<string, Budget>;

/** La plus longue fenêtre : ce que le ménage doit conserver. */
export const RETENTION_MS = Math.max(...Object.values(BUDGETS).map((b) => b.windowMs));

/**
 * Repli en mémoire, utilisé quand aucune base n'est configurée.
 *
 * Un déploiement sans base n'a ni comptes ni courriels : il n'y a alors
 * presque rien à protéger. Ce repli existe pour que le code appelant n'ait
 * pas à connaître le mode de déploiement.
 */
const enMemoire = new Map<string, SlidingWindowRateLimiter>();

function limiteurLocal(budget: Budget): SlidingWindowRateLimiter {
  const existant = enMemoire.get(budget.bucket);
  if (existant) return existant;

  const cree = new SlidingWindowRateLimiter(budget.limit, budget.windowMs);
  enMemoire.set(budget.bucket, cree);
  return cree;
}

/**
 * Empreinte de la clé.
 *
 * La table ne doit contenir ni adresse ni IP en clair : compter n'exige pas
 * de pouvoir remonter à la personne. Une empreinte tronquée à 32 caractères
 * laisse 128 bits, très au-delà de ce qu'il faut pour éviter les collisions
 * à cette échelle.
 */
function empreinte(cle: string): string {
  return createHash('sha256').update(cle).digest('hex').slice(0, 32);
}

/**
 * Consomme une unité du budget.
 *
 * ── En cas de panne de base, on REFUSE ────────────────────────────────────
 *
 * Laisser passer serait tentant : une base indisponible ne devrait pas
 * bloquer le site. Sauf que toutes les actions protégées ici ont besoin de la
 * base pour aboutir — la connexion y écrit son jeton avant d'envoyer le
 * courriel, les contributions y écrivent leur ligne. Refuser tout de suite ne
 * fait donc perdre aucune action qui aurait réussi ; laisser passer, en
 * revanche, ouvrirait l'envoi de courrier sans compteur pendant toute la
 * durée de la panne.
 */
export async function consommer(budget: Budget, cle: string): Promise<RateLimitDecision> {
  if (!databaseEnabled()) return limiteurLocal(budget).check(empreinte(cle));

  try {
    return await checkMysqlLimit(budget.bucket, empreinte(cle), budget.limit, budget.windowMs);
  } catch (error) {
    console.error(`[limites] compteur « ${budget.bucket} » injoignable`, error);
    return { allowed: false, remaining: 0, resetAt: Date.now() + budget.windowMs };
  }
}

/**
 * Rend une unité consommée, quand l'action protégée a échoué.
 *
 * ── Pourquoi ça n'est pas un détail ──────────────────────────────────────
 *
 * Le budget se prend AVANT l'action : autrement, deux requêtes simultanées
 * liraient le même compteur et passeraient toutes les deux. Mais si l'action
 * échoue, la personne n'a rien obtenu — et sans remboursement, elle paie
 * quand même.
 *
 * Ce défaut a été observé en production, et il ne se contentait pas de
 * pénaliser : au quatrième essai, le formulaire de connexion répondait « un
 * lien a déjà été demandé, vérifiez vos indésirables » alors qu'aucun des
 * trois envois précédents n'avait abouti. Le site envoyait chercher un
 * courriel qui n'était jamais parti, et masquait la vraie panne pendant un
 * quart d'heure.
 *
 * Un échec ne se rembourse jamais silencieusement en cas de panne du
 * compteur : on préfère laisser l'unité consommée plutôt que de rouvrir le
 * robinet quand la base ne répond plus.
 */
export async function rembourser(budget: Budget, cle: string): Promise<void> {
  if (!databaseEnabled()) {
    limiteurLocal(budget).refund(empreinte(cle));
    return;
  }

  try {
    await refundMysqlLimit(budget.bucket, empreinte(cle));
  } catch (error) {
    console.error(`[limites] remboursement « ${budget.bucket} » impossible`, error);
  }
}

/**
 * Adresse IP de l'appelant, vue depuis une action serveur.
 *
 * `x-forwarded-for` est falsifiable : ce que cette clé protège, c'est le
 * bruit et les scripts naïfs, pas un attaquant décidé. Les budgets par adresse
 * et global existent précisément parce que celui-ci ne suffit pas.
 */
export async function ipAppelante(): Promise<string> {
  const entetes = await headers();
  const transmise = entetes.get('x-forwarded-for');

  if (transmise) return transmise.split(',')[0]?.trim() || 'inconnu';
  return entetes.get('x-real-ip') ?? 'inconnu';
}

/** « Réessayez dans 12 minutes », sans jamais annoncer « 0 minute ». */
export function delaiLisible(resetAt: number, now: number = Date.now()): string {
  const minutes = Math.max(1, Math.ceil((resetAt - now) / MINUTE));

  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;

  const heures = Math.ceil(minutes / 60);
  return `${heures} heure${heures > 1 ? 's' : ''}`;
}
