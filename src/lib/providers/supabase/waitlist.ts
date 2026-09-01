import { waitlistInputSchema, type WaitlistInput } from '@/data/schemas';
import { SlidingWindowRateLimiter } from '@/lib/rate-limit';
import { supabaseServer } from '@/lib/supabase/server';
import { createHash } from 'node:crypto';
import type { WaitlistRepository, WaitlistResult } from '../types';

/** 5 inscriptions par adresse IP et par quart d'heure, comme la version fichier. */
const limiter = new SlidingWindowRateLimiter(5, 15 * 60 * 1000);

/** Code PostgreSQL d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505';

/**
 * Liste d'attente dans Supabase.
 *
 * Remplace `FileWaitlistRepository`, qui écrivait dans un fichier temporaire
 * effacé à chaque déploiement — les inscriptions y étaient perdues, ce que la
 * politique de confidentialité disait franchement mais qui n'en restait pas
 * moins une collecte sans conservation.
 *
 * La table n'est LISIBLE PAR PERSONNE : la migration ne crée aucune politique
 * de SELECT, seulement une politique d'INSERT publique. Conséquences directes,
 * et assumées :
 *
 *   — `count()` ne peut pas compter, et rend `null` plutôt qu'un zéro qui
 *     ressemblerait à une liste vide ;
 *   — une adresse déjà inscrite ne peut pas être détectée par une lecture
 *     préalable. C'est la contrainte de clé primaire qui la rejette, et son
 *     code d'erreur qui nous dit « déjà inscrite ».
 *
 * Ce n'est pas un contournement : c'est ce qui garantit qu'une clé publique
 * volée ne permet pas d'aspirer la liste des adresses. Un formulaire
 * d'inscription n'a aucune raison de pouvoir la lire.
 */
export class SupabaseWaitlistRepository implements WaitlistRepository {
  readonly source = {
    name: 'Liste d’attente (Supabase)',
    kind: 'measured' as const,
    precision:
      'Stockage durable. La table est en écriture seule pour le public : personne ne peut lire la liste des adresses depuis le site.',
  };

  async add(input: WaitlistInput, context: { ip: string }): Promise<WaitlistResult> {
    const parsed = waitlistInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: 'invalid' };

    // Empreinte de l'IP, jamais l'IP : la clé du limiteur n'a pas à être
    // réversible pour faire son travail.
    const key = createHash('sha256').update(context.ip).digest('hex').slice(0, 32);
    if (!limiter.check(key).allowed) return { ok: false, reason: 'rate-limited' };

    const client = await supabaseServer();
    if (!client) return { ok: false, reason: 'storage-error' };

    const email = parsed.data.email.toLowerCase();
    const { error } = await client
      .from('waitlist')
      .insert({ email, source: parsed.data.source ?? 'site' });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { ok: true, alreadyRegistered: true };
      console.error('[waitlist] insertion impossible', error);
      return { ok: false, reason: 'storage-error' };
    }

    // La SOURCE est journalisée, jamais l'adresse : une console d'hébergeur est
    // un traitement de plus, avec ses propres accès et sa propre durée.
    console.info(`[waitlist] nouvelle inscription (source: ${parsed.data.source ?? 'site'})`);
    return { ok: true, alreadyRegistered: false };
  }

  /**
   * `null` : nous n'avons pas le droit de compter, et le dire est la seule
   * réponse juste. S'il fallait un compteur public un jour, il passerait par
   * une fonction SQL rendant un total sans exposer une seule ligne.
   */
  async count(): Promise<number | null> {
    return null;
  }
}
