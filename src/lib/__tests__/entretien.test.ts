import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La tâche planifiée et la route qu'elle appelle doivent rester d'accord.
 *
 * C'est une paire fragile par nature : deux fichiers sans lien de compilation,
 * dont l'un peut être renommé sans que rien n'échoue — jusqu'au jour où l'on
 * s'aperçoit que les sessions périmées s'accumulent depuis des mois.
 */
const ROOT = process.cwd();
const VERCEL = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
  crons?: { path: string; schedule: string }[];
};

describe('entretien quotidien de la base', () => {
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

  it('ne touche qu’à ce qui est expiré, et à rien d’autre', () => {
    // Ce point d'accès peut être appelé sans session. Il ne doit donc jamais
    // toucher aux profils, aux avis, aux prises ni à la liste d'attente — la
    // purge se limite aux sessions et aux jetons dont la date est passée.
    const source = readFileSync(path.join(ROOT, 'src/app/api/entretien/route.ts'), 'utf8');
    for (const table of ['profiles', 'waitlist', 'catches', 'spot_reviews']) {
      expect(source, `table hors périmètre citée : ${table}`).not.toContain(table);
    }
    expect(source).toContain('purgeExpired');
  });
});
