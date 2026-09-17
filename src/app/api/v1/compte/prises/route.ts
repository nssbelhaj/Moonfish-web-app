import { catchInputSchema } from '@/data/schemas';
import { contributions } from '@/lib/providers';
import { BUDGETS, consommer, delaiLisible } from '@/lib/limites';
import { MAX_STORED_BYTES, deletePhoto, savePhoto } from '@/lib/photo/storage';
import { refus, refusDeContribution, saisieInvalide, succes, tropDeDemandes } from '@/lib/api/reponse';
import { exigerAuteur } from '@/lib/api/garde';
import { priseDuCarnetEnJson } from '@/lib/api/serialisation';

export const dynamic = 'force-dynamic';

/**
 * Déclarer une prise, photo comprise.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA PHOTO ARRIVE DÉJÀ NETTOYÉE. CE N'EST PAS UNE HYPOTHÈSE COMMODE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une photo de téléphone porte les coordonnées GPS de la prise de vue.
 * Publier une photo de bar sans y toucher, c'est publier la position d'un
 * poste — ou, si elle a été prise en rentrant, celle d'un domicile.
 *
 * Le retrait a donc lieu SUR L'APPAREIL, avant tout envoi, par réencodage —
 * la même méthode que le navigateur (`lib/photo/strip-metadata.ts`), pour la
 * même raison : décoder puis redessiner ne conserve que les pixels, ni EXIF,
 * ni XMP, ni IPTC, ni vignette d'aperçu — cette dernière étant le piège
 * classique des outils qui retirent les coordonnées et laissent une
 * miniature intacte, elle-même géolocalisée. Ce qui n'est jamais parti n'a
 * pas à être effacé.
 *
 * Un piège propre au mobile, à ne pas oublier côté application :
 * `expo-image-picker` avec `exif: false` ne retire RIEN du fichier — il se
 * contente de ne pas vous montrer les données. Le fichier sur le disque garde
 * ses coordonnées. Seul un réencodage les enlève.
 *
 * Cette route ne nettoie donc pas, elle SUPPOSE — et vérifie ce qu'elle peut :
 * `savePhoto` refuse tout ce dont les octets ne commencent pas par la
 * signature JPEG.
 *
 * ── L'ordre des opérations évite les photos orphelines ───────────────────
 *
 * Les champs sont validés AVANT que la photo ne soit écrite sur le disque, et
 * la photo est effacée si l'enregistrement de la prise échoue ensuite. Sans
 * cela, une saisie refusée laisserait un fichier que plus aucune ligne ne
 * référence, sur un hébergement où l'espace est compté et où personne ne
 * viendrait jamais le chercher.
 */
export async function POST(requete: Request): Promise<Response> {
  const garde = await exigerAuteur(requete);
  if (!garde.ok) return garde.reponse;

  const taille = Number(requete.headers.get('content-length') ?? 0);
  if (Number.isFinite(taille) && taille > MAX_STORED_BYTES * 2) {
    // Refus AVANT lecture du corps : lire six mégaoctets pour les rejeter
    // ensuite offrirait un moyen simple de faire travailler le serveur.
    return refus(
      413,
      'saisie-invalide',
      'Photo trop lourde. Réduisez-la sur l’appareil avant l’envoi : l’application le fait normalement toute seule.',
    );
  }

  let formulaire: FormData;
  try {
    formulaire = await requete.formData();
  } catch {
    return refus(
      400,
      'saisie-invalide',
      'L’envoi n’a pas pu être lu — il est incomplet ou mal formé. Vérifiez votre connexion et recommencez.',
    );
  }

  const analyse = catchInputSchema.safeParse({
    spotSlug: formulaire.get('spotSlug'),
    species: formulaire.get('species'),
    lengthCm: formulaire.get('lengthCm'),
    weightG: formulaire.get('weightG'),
    released: formulaire.get('released') === 'true',
    caughtAt: formulaire.get('caughtAt'),
    note: formulaire.get('note'),
    visibility: formulaire.get('visibility') ?? undefined,
  });
  if (!analyse.success) return saisieInvalide(analyse.error);

  /* ── La photo, si elle est là ─────────────────────────────────────────── */

  let chemin: string | null = null;
  const fichier = formulaire.get('photo');

  if (fichier instanceof File && fichier.size > 0) {
    /*
      Budget propre aux photos, plus bas que celui des contributions : chaque
      dépôt occupe du disque de façon durable. Il s'ajoute au budget déjà
      consommé par `exigerAuteur` — les deux protègent des choses
      différentes, l'un le nombre d'écritures, l'autre l'espace.
    */
    const budget = await consommer(BUDGETS.photo, garde.porteur.id);
    if (!budget.allowed) {
      return tropDeDemandes(
        `Trop de photos envoyées d’affilée. Réessayez dans ${delaiLisible(budget.resetAt)}, ou déclarez la prise sans photo.`,
        budget.resetAt,
      );
    }

    const enregistree = await savePhoto(
      garde.porteur.id,
      new Uint8Array(await fichier.arrayBuffer()),
      fichier.type,
    );

    if (!enregistree.ok) {
      return refus(422, 'saisie-invalide', enregistree.message, 'photo');
    }

    chemin = enregistree.path;
  }

  /* ── La prise ─────────────────────────────────────────────────────────── */

  const resultat = await contributions.addCatch(
    { ...analyse.data, photoPath: chemin },
    garde.auteur,
  );

  if (!resultat.ok) {
    if (chemin !== null) await deletePhoto(chemin);
    return refusDeContribution(resultat);
  }

  return succes({ catch: priseDuCarnetEnJson(resultat.data) });
}
