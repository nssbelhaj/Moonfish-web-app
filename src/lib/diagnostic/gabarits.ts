/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Reconnaître un texte d'exemple pris pour une valeur
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois fois de suite, un gabarit de documentation s'est retrouvé posé comme
 * valeur réelle :
 *
 *   · `Authorization: Bearer COLLEZ_ICI_VOTRE_CRON_SECRET` — refus opaque ;
 *   · `Authorization: Bearer VOTRE_SECRET` — même refus ;
 *   · `DATABASE_URL=mysql://UTILISATEUR:MOTDEPASSE@…` — et là, TOUT tombe :
 *     migrations, comptes, compteurs d'appels. Chacun se plaignait d'autre
 *     chose, aucun ne disait « l'identifiant est le mot d'exemple ».
 *
 * La faute est du côté de la documentation, pas de qui la suit : un gabarit
 * qui ressemble à une valeur SERA collé tel quel. Puisqu'on ne peut pas
 * empêcher cela, on le détecte.
 *
 * ── Le contrôle AVERTIT, il ne bloque jamais ─────────────────────────────
 *
 * Un mot de passe réellement écrit en capitales existe. Refuser de démarrer
 * sur une ressemblance ferait tomber un site qui marche ; le dire dans le
 * diagnostic ne coûte rien à personne.
 */

/** Mots qui ne sont jamais une vraie valeur. */
const MOTS = [
  'utilisateur',
  'motdepasse',
  'mot_de_passe',
  'username',
  'password',
  'valeur',
  'secret',
  'changeme',
  'exemple',
  'example',
  'placeholder',
  'identifiant',
];

/** Fragments qui trahissent un gabarit, où qu'ils soient dans la valeur. */
const FRAGMENTS = ['votre', 'collez', 'your_', 'your-', 'xxxx', '...', '…', '<', '>'];

/**
 * La valeur ressemble-t-elle à un texte d'exemple ?
 *
 * Trois signes, du plus sûr au plus indicatif :
 *   1. la valeur EST un mot de gabarit connu ;
 *   2. elle contient un fragment qui n'apparaît que dans une documentation ;
 *   3. elle est écrite tout en capitales et tirets bas, comme s'écrivent les
 *      gabarits — et comme ne s'écrit presque jamais un vrai identifiant.
 */
export function ressembleAUnGabarit(valeur: string | undefined): boolean {
  const v = valeur?.trim();
  if (!v || v.length < 3) return false;

  const bas = v.toLowerCase();

  if (MOTS.includes(bas)) return true;
  if (FRAGMENTS.some((f) => bas.includes(f))) return true;

  return /^[A-Z][A-Z_]{4,}$/.test(v);
}

/**
 * Les parties d'une URL qui ressemblent à un gabarit.
 *
 * Rend les noms des parties fautives — « identifiant », « mot de passe »,
 * « hôte », « base » — jamais leur contenu : cette sortie est faite pour être
 * recopiée dans un message.
 */
export function partiesGabarit(url: string | undefined): string[] {
  if (!url) return [];

  let analysee: URL;
  try {
    analysee = new URL(url.trim());
  } catch {
    return [];
  }

  const fautives: string[] = [];
  const lire = (brut: string): string => {
    try {
      return decodeURIComponent(brut);
    } catch {
      return brut;
    }
  };

  if (ressembleAUnGabarit(lire(analysee.username))) fautives.push('l’identifiant');
  if (ressembleAUnGabarit(lire(analysee.password))) fautives.push('le mot de passe');
  if (ressembleAUnGabarit(analysee.hostname)) fautives.push('l’hôte');

  const base = analysee.pathname.replace(/^\//, '');
  if (ressembleAUnGabarit(base)) fautives.push('le nom de la base');

  return fautives;
}
