/**
 * Empreinte de construction, exposée publiquement.
 *
 * ── Pourquoi cela existe ─────────────────────────────────────────────────
 *
 * Trois échanges de suite ont buté sur la même question sans réponse : « le
 * correctif est-il déployé, ou a-t-il échoué ? » Le symptôme est identique
 * dans les deux cas — la page affiche le même message — et chaque
 * vérification coûtait un aller-retour d'une journée.
 *
 * Servie dans un en-tête de réponse sur toutes les pages, elle répond en deux
 * secondes, sans secret et sans compte :
 *
 *     curl -sI https://lunamarea.fr/ | grep -i luna
 *
 * ── Une seule source, et c'est la compilation ────────────────────────────
 *
 * La première version appelait `new Date()` ici. Le résultat était figé au
 * build pour l'en-tête — `headers()` est sérialisée dans le manifeste — mais
 * RECALCULÉ au démarrage du serveur pour tout le reste. Les deux valeurs
 * différaient donc d'une minute, et le diagnostic affirmait leur égalité :
 * mesuré, 07:51:58 dans l'en-tête contre 07:53:04 dans le diagnostic.
 *
 * `next.config.ts` calcule l'horodatage une fois et le pose dans `env`, que
 * Next remplace littéralement à la compilation. Les deux lisent désormais la
 * même constante.
 *
 * ── Ce qu'elle ne dit pas ────────────────────────────────────────────────
 *
 * Ni numéro de version, ni empreinte de commit : un horodatage suffit à
 * répondre à « est-ce la construction d'avant ou celle d'après ? », et il ne
 * révèle rien de l'état du dépôt.
 */
export const BUILD_STAMP = process.env.LUNA_BUILD ?? 'inconnue';
