import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { waitlistEntrySchema, waitlistInputSchema, type WaitlistEntry, type WaitlistInput } from '@/data/schemas';
import { SlidingWindowRateLimiter } from '@/lib/rate-limit';
import type { WaitlistRepository, WaitlistResult } from '../types';

const STORAGE_DIR = path.join(process.cwd(), 'var');
const STORAGE_FILE = path.join(STORAGE_DIR, 'waitlist.jsonl');

/** 5 inscriptions par adresse IP et par quart d'heure : large pour un humain, étroit pour un script. */
const limiter = new SlidingWindowRateLimiter(5, 15 * 60 * 1000);

/**
 * Liste d'attente : une ligne JSON par inscription, dans `var/waitlist.jsonl`.
 *
 * ➜ POUR BRANCHER SUPABASE : créer `src/lib/providers/supabase/waitlist.ts`
 *   exposant le même `WaitlistRepository` (`insert into waitlist ... on
 *   conflict (email) do nothing`), puis changer la ligne `waitlist:` de
 *   `src/lib/providers/index.ts`. Le route handler ne change pas d'une ligne.
 *
 * Limite connue et assumée : le système de fichiers d'un hébergeur serverless
 * est éphémère. Les inscriptions y survivent au mieux jusqu'au prochain
 * déploiement. Cette implémentation existe pour que le parcours soit
 * démontrable de bout en bout, pas pour conserver quoi que ce soit.
 */
export class FileWaitlistRepository implements WaitlistRepository {
  readonly source = {
    name: 'Fichier local (var/waitlist.jsonl)',
    kind: 'measured' as const,
    precision: 'Stockage éphémère. À remplacer par Supabase avant toute collecte réelle.',
  };

  async add(input: WaitlistInput, context: { ip: string }): Promise<WaitlistResult> {
    const parsed = waitlistInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: 'invalid' };

    // La clé de limitation est un hash de l'IP : on ne veut pas la garder en clair en mémoire.
    const key = createHash('sha256').update(context.ip).digest('hex').slice(0, 32);
    if (!limiter.check(key).allowed) return { ok: false, reason: 'rate-limited' };

    const email = parsed.data.email.toLowerCase();
    const entry: WaitlistEntry = waitlistEntrySchema.parse({
      email,
      source: parsed.data.source ?? 'site',
      createdAt: new Date().toISOString(),
    });

    try {
      const existing = await this.readAll();
      if (existing.some((item) => item.email === email)) {
        return { ok: true, alreadyRegistered: true };
      }

      await mkdir(STORAGE_DIR, { recursive: true });
      await appendFile(STORAGE_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
      console.info(`[waitlist] nouvelle inscription : ${email} (source: ${entry.source})`);
      return { ok: true, alreadyRegistered: false };
    } catch (error) {
      console.error('[waitlist] écriture impossible', error);
      return { ok: false, reason: 'storage-error' };
    }
  }

  async count(): Promise<number> {
    return (await this.readAll()).length;
  }

  async listForTests(): Promise<WaitlistEntry[]> {
    return this.readAll();
  }

  private async readAll(): Promise<WaitlistEntry[]> {
    try {
      const raw = await readFile(STORAGE_FILE, 'utf8');
      return raw
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .flatMap((line) => {
          const parsed = waitlistEntrySchema.safeParse(JSON.parse(line) as unknown);
          return parsed.success ? [parsed.data] : [];
        });
    } catch {
      // Fichier absent au premier appel : ce n'est pas une erreur.
      return [];
    }
  }
}
