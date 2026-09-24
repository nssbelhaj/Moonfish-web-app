import type { Point } from './etat';
import { resumeVisites } from '@/lib/visites/compter';

/** Les pages vues des sept derniers jours : ce que le compteur sait, et rien de plus. */
export async function etatDesVisites(): Promise<Point> {
  const sujet = 'Pages vues (7 jours)';
  try {
    const resume = await resumeVisites(7, 8);
    if (resume.total === 0) {
      return {
        sujet,
        etat: 'ok',
        constat: 'Aucune page vue enregistrée sur sept jours. Soit le site vient d’être déployé, soit la migration 0010 manque.',
        remede: null,
      };
    }
    const pages = resume.pages.map((page) => `${page.chemin} (${page.n})`).join(', ');
    return {
      sujet,
      etat: 'ok',
      constat: `${resume.total} pages vues. Les plus vues : ${pages}. Comptées par jour et par chemin, sans cookie, sans identifiant, sans adresse : dix vues peuvent être une personne.`,
      remede: null,
    };
  } catch (error) {
    return {
      sujet,
      etat: 'attention',
      constat: `Le compteur est illisible : ${error instanceof Error ? error.message : String(error)}.`,
      remede: 'Vérifiez que la migration 0010 est appliquée.',
    };
  }
}
