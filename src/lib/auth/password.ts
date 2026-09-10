import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

export { MOT_DE_PASSE_MAX, MOT_DE_PASSE_MIN } from './password-regles';

/**
 * `promisify` perd la surcharge à options de `scrypt` : le typage résultant
 * n'accepte que trois arguments, et `maxmem` — indispensable ici — devient
 * inexprimable. On enveloppe donc à la main plutôt que d'affaiblir le typage.
 */
function scrypt(
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(motDePasse, sel, longueur, options, (erreur, derive) => {
      if (erreur) reject(erreur);
      else resolve(derive);
    });
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Empreintes de mots de passe, avec scrypt
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── Pourquoi scrypt et pas bcrypt ou argon2 ──────────────────────────────
 *
 * scrypt est dans `node:crypto` : aucune dépendance, aucune compilation
 * native. bcrypt et argon2 sont des modules natifs qui doivent se compiler à
 * l'installation — sur un hébergement mutualisé, c'est le genre de chose qui
 * échoue au pire moment, avec une erreur qui ne parle pas de mot de passe.
 *
 * scrypt est un dérivateur à coût mémoire, recommandé par l'OWASP pour cet
 * usage. Ses paramètres sont ci-dessous.
 *
 * ── Le format porte ses paramètres ───────────────────────────────────────
 *
 *     scrypt$N$r$p$sel$empreinte
 *
 * Stocker N, r et p AVEC l'empreinte permet de les durcir plus tard sans
 * invalider les comptes existants : une ancienne empreinte reste vérifiable
 * avec ses propres paramètres, et `besoinDeRehachage` dit quand la remplacer.
 * Sans cela, durcir signifierait déconnecter tout le monde.
 */

/**
 * Coût. N=2^16 tient environ 100 ms sur un cœur modeste et demande 64 Mio.
 * Assez pour rendre une attaque hors ligne coûteuse, assez peu pour ne pas
 * saturer un hébergement mutualisé sous quelques connexions simultanées.
 */
const N = 65_536;
const R = 8;
const P = 1;
const LONGUEUR = 32;
const SEL_OCTETS = 16;

/** `maxmem` par défaut (32 Mio) est trop bas pour N=2^16 : il faut le dire. */
const MEMOIRE = 128 * N * R * 2;


function b64(donnees: Buffer): string {
  return donnees.toString('base64url');
}

/**
 * Empreinte d'un mot de passe.
 *
 * Le sel est tiré au hasard pour chaque compte : deux personnes qui
 * choisissent le même mot de passe n'ont pas la même empreinte, et une table
 * précalculée ne sert à rien.
 */
export async function hacher(motDePasse: string): Promise<string> {
  const sel = randomBytes(SEL_OCTETS);
  const empreinte = await scrypt(motDePasse.normalize('NFKC'), sel, LONGUEUR, {
    N,
    r: R,
    p: P,
    maxmem: MEMOIRE,
  });

  return `scrypt$${N}$${R}$${P}$${b64(sel)}$${b64(empreinte)}`;
}

/**
 * Vérifie un mot de passe contre une empreinte stockée.
 *
 * Rend `false` plutôt que de lever, y compris sur une empreinte illisible :
 * une ligne corrompue en base ne doit pas faire tomber la page de connexion
 * en erreur 500, elle doit refuser la connexion.
 */
export async function verifier(motDePasse: string, stocke: string): Promise<boolean> {
  const parts = stocke.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nBrut, rBrut, pBrut, selB64, empreinteB64] = parts;
  const n = Number(nBrut);
  const r = Number(rBrut);
  const p = Number(pBrut);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let attendu: Buffer;
  let calcule: Buffer;
  try {
    attendu = Buffer.from(empreinteB64 ?? '', 'base64url');
    calcule = await scrypt(
      motDePasse.normalize('NFKC'),
      Buffer.from(selB64 ?? '', 'base64url'),
      attendu.length,
      { N: n, r, p, maxmem: 128 * n * r * 2 },
    );
  } catch {
    return false;
  }

  /*
    Comparaison à temps constant. Un `===` sortirait au premier octet
    différent, et la durée de la réponse révélerait combien d'octets sont
    justes — de quoi reconstruire l'empreinte octet par octet.
  */
  if (attendu.length !== calcule.length || attendu.length === 0) return false;
  return timingSafeEqual(attendu, calcule);
}

/** L'empreinte a-t-elle été calculée avec des paramètres plus faibles qu'aujourd'hui ? */
export function besoinDeRehachage(stocke: string): boolean {
  const parts = stocke.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true;

  return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}
