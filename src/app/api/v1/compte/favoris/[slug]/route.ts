import { spotSlugSchema } from '@/data/schemas';
import { contributions, spots } from '@/lib/providers';
import { INTROUVABLE, refusDeContribution, saisieInvalide, succes } from '@/lib/api/reponse';
import { exigerPorteur } from '@/lib/api/garde';

export const dynamic = 'force-dynamic';

/**
 * Ajouter ou retirer un favori.
 *
 * ── PUT plutôt que POST, parce que c'est idempotent ──────────────────────
 *
 * Ajouter deux fois le même favori ne fait rien et ne s'en plaint pas. C'est
 * la propriété qui compte pour une application qu'on utilise sans réseau :
 * elle peut rejouer sa file d'actions en attente au retour du signal sans
 * avoir à se souvenir de ce qui est déjà passé. Un POST aurait laissé croire
 * qu'un second appel crée quelque chose.
 *
 * ── Le spot est vérifié avant d'écrire ───────────────────────────────────
 *
 * La table des favoris ne porte qu'un slug, sans clé étrangère vers un
 * catalogue qui vit encore dans un fichier. Sans ce contrôle, une faute de
 * frappe créerait un favori vers un spot inexistant, que l'écran d'accueil
 * afficherait comme une ligne vide sans savoir dire pourquoi.
 */
async function spotExiste(slug: string): Promise<boolean> {
  return (await spots.findBySlug(slug)) !== null;
}

export async function PUT(
  requete: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  const analyse = spotSlugSchema.safeParse((await params).slug);
  if (!analyse.success) return saisieInvalide(analyse.error);
  const slug = analyse.data;

  if (!(await spotExiste(slug))) return INTROUVABLE(`Le spot « ${slug} »`);

  const resultat = await contributions.addFavorite(garde.porteur.id, slug);
  if (!resultat.ok) return refusDeContribution(resultat);

  return succes({ spotSlug: slug, favorite: true });
}

/**
 * Retirer un favori.
 *
 * Aucun contrôle d'existence du spot ici : retirer un favori dont le spot a
 * disparu du catalogue doit rester possible, sans quoi la ligne serait
 * inamovible. C'est l'asymétrie normale entre créer et supprimer.
 */
export async function DELETE(
  requete: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const garde = await exigerPorteur(requete);
  if (!garde.ok) return garde.reponse;

  /*
    Le slug est validé ici aussi, alors que la suppression ne vérifie pas
    l'existence du spot. La raison n'est pas la même : ce n'est plus de savoir
    si le spot existe, c'est d'éviter qu'une chaîne arbitraire descende
    jusqu'à la base. Un garde-fou dont on ne voit pas l'usage est celui qu'on
    retire, puis qu'on regrette.
  */
  const analyse = spotSlugSchema.safeParse((await params).slug);
  if (!analyse.success) return saisieInvalide(analyse.error);
  const slug = analyse.data;

  const resultat = await contributions.removeFavorite(garde.porteur.id, slug);
  if (!resultat.ok) return refusDeContribution(resultat);

  return succes({ spotSlug: slug, favorite: false });
}
