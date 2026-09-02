import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La tâche planifiée et la route qu'elle appelle doivent rester d'accord.
 *
 * C'est une paire fragile par nature : deux fichiers sans lien de compilation,
 * dont l'un peut être renommé sans que rien n'échoue — jusqu'au jour où le
 * projet Supabase se met en pause faute d'activité, une semaine plus tard, et
 * où personne ne fait le rapprochement.
 */
const ROOT = process.cwd();
const VERCEL = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
  crons?: { path: string; schedule: string }[];
};

describe('maintien en éveil du projet Supabase', () => {
  it('déclare une tâche planifiée vers une route qui existe', () => {
    const crons = VERCEL.crons ?? [];
    expect(crons.length).toBeGreaterThan(0);

    for (const cron of crons) {
      const route = path.join(ROOT, 'src/app', cron.path, 'route.ts');
      expect(existsSync(route), `route absente pour la tâche ${cron.path}`).toBe(true);
    }
  });

  it('reste dans ce qu’un compte Vercel gratuit accepte : une fois par jour', () => {
    // Un compte Hobby REFUSE le déploiement d'une expression plus fréquente
    // qu'une fois par jour. Une erreur de fréquence ne casse donc pas la tâche :
    // elle casse la mise en ligne entière.
    for (const cron of VERCEL.crons ?? []) {
      const [minute, hour] = cron.schedule.split(' ');
      expect(minute, `minute variable dans « ${cron.schedule} »`).toMatch(/^\d+$/);
      expect(hour, `heure variable dans « ${cron.schedule} »`).toMatch(/^\d+$/);
    }
  });

  it('n’interroge que des tables publiques', () => {
    // Ce point d'accès peut être appelé sans session. Il ne doit donc jamais
    // toucher aux profils ni à la liste d'attente, quand bien même la sécurité
    // au niveau des lignes le lui refuserait.
    const source = readFileSync(path.join(ROOT, 'src/app/api/keep-alive/route.ts'), 'utf8');
    for (const table of ['profiles', 'waitlist']) {
      expect(source, `table non publique interrogée : ${table}`).not.toContain(`from('${table}')`);
    }
    expect(source).toContain('supabasePublic');
  });
});
