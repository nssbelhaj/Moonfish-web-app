import { createHash } from 'node:crypto';

import { waitlistInputSchema, type WaitlistInput } from '@/data/schemas';
import { execute } from '@/lib/db/mysql';
import { SlidingWindowRateLimiter } from '@/lib/rate-limit';
import type { WaitlistRepository, WaitlistResult } from '../types';

/** 5 inscriptions par adresse IP et par quart d'heure : large pour un humain, étroit pour un script. */
const limiter = new SlidingWindowRateLimiter(5, 15 * 60 * 1000);

/**
 * Liste d'attente dans MySQL.
 *
 * ═══ AUCUNE LECTURE N'EXISTE ICI, ET C'EST VOULU ═══
 *
 * Sur PostgreSQL, la table n'avait aucune politique de lecture : les adresses
 * étaient inaspirables même avec la clé publique, parce que le MOTEUR
 * refusait. MySQL ne sait pas faire cela.
 *
 * La protection est donc devenue : aucun chemin de lecture n'est écrit dans le
 * code, et `src/lib/db/__tests__/proprietaire.test.ts` échoue si un `select`
 * sur `waitlist` apparaît où que ce soit. C'est plus faible — un accès direct
 * à la base contourne tout — mais c'est vérifiable, et l'accès direct à la
 * base n'est pas exposé au public.
 *
 * Conséquence assumée, la même qu'avant : `count()` rend `null`. Ne pas avoir
 * de chemin de lecture n'est pas la même chose que compter zéro.
 */
export class MysqlWaitlistRepository implements WaitlistRepository {
  readonly source = {
    name: 'Liste d’attente (MySQL)',
    kind: 'measured' as const,
    precision:
      'Stockage durable. Aucun chemin de lecture n’existe dans l’application : la liste des adresses ne peut pas être consultée depuis le site.',
  };

  async add(input: WaitlistInput, context: { ip: string }): Promise<WaitlistResult> {
    const parsed = waitlistInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: 'invalid' };

    // Empreinte de l'IP, jamais l'IP : la clé du limiteur n'a pas à être
    // réversible pour faire son travail.
    const key = createHash('sha256').update(context.ip).digest('hex').slice(0, 32);
    if (!limiter.check(key).allowed) return { ok: false, reason: 'rate-limited' };

    const email = parsed.data.email.toLowerCase();
    const source = parsed.data.source ?? 'site';

    try {
      /*
        `insert ignore` plutôt qu'une lecture préalable : sans droit de lecture,
        on ne PEUT pas vérifier l'existence, et c'est très bien ainsi. La clé
        primaire fait le travail, et le nombre de lignes affectées dit si
        l'adresse était déjà là — zéro ligne signifie « déjà inscrite ».
      */
      const inserted = await execute('insert ignore into waitlist (email, source) values (?, ?)', [
        email,
        source,
      ]);

      if (inserted === 0) return { ok: true, alreadyRegistered: true };

      // La SOURCE est journalisée, jamais l'adresse : une console d'hébergeur
      // est un traitement de plus, avec ses propres accès et sa propre durée.
      console.info(`[waitlist] nouvelle inscription (source: ${source})`);
      return { ok: true, alreadyRegistered: false };
    } catch (error) {
      console.error('[waitlist] insertion impossible', error);
      return { ok: false, reason: 'storage-error' };
    }
  }

  /** `null` : aucun chemin de lecture n'existe, et le dire est la seule réponse juste. */
  async count(): Promise<number | null> {
    return null;
  }
}
