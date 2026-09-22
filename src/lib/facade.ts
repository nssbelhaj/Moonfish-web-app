import { PAYS } from '@/data/spots';

/**
 * La façade d'accueil : le pays que la page d'accueil montre en direct.
 *
 * ─── Un seul endroit qui écrit ────────────────────────────────────────────
 *
 * Deux composants la changent — le sélecteur de l'accueil et le bouton de
 * la page pays — et ils passent tous deux par ici. La page de confidentialité
 * déclare UN point d'écriture, ce fichier, et le test qui la garde vraie
 * compte les `setItem` fichier par fichier : centraliser l'écriture est ce
 * qui rend cette déclaration exacte et stable.
 *
 * La valeur est le slug du pays. Rien d'autre n'est écrit : ni date, ni
 * identifiant, ni position.
 */
export const CLE_PAYS = 'luna-marea:pays';

/** Le pays affiché tant qu'aucun n'est choisi : le premier du catalogue. */
export const FACADE_PAR_DEFAUT: string = PAYS[0]?.slug ?? 'france';

const SLUGS = new Set(PAYS.map((pays) => pays.slug));

/** Le slug retenu, ou `null`. Une valeur qui n'est plus un pays du catalogue vaut `null`. */
export function lireFacade(): string | null {
  try {
    const valeur = localStorage.getItem(CLE_PAYS);
    return valeur !== null && SLUGS.has(valeur) ? valeur : null;
  } catch {
    // Navigation privée, stockage bloqué : la façade par défaut est un état
    // parfaitement utilisable, rien à signaler.
    return null;
  }
}

/** Retient un pays, ou l'oublie avec `null`. N'échoue jamais bruyamment. */
export function ecrireFacade(slug: string | null): void {
  try {
    if (slug === null) localStorage.removeItem(CLE_PAYS);
    else localStorage.setItem(CLE_PAYS, slug);
  } catch {
    // Le choix vaut pour cette page ; il ne survivra pas au rechargement.
  }
}

/**
 * Applique la façade au document : montre les blocs `[data-pays]` du pays
 * choisi, masque les autres. Le serveur a déjà rendu la façade par défaut
 * de la même manière, si bien que sans script la page est déjà cohérente.
 */
export function appliquerFacade(slug: string): void {
  for (const bloc of document.querySelectorAll<HTMLElement>('[data-pays]')) {
    bloc.hidden = bloc.dataset['pays'] !== slug;
  }
}
