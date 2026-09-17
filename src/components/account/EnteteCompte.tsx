import { Avatar } from '@/components/account/ProfilForms';
import type { Profile } from '@/data/schemas';
import { photoUrl } from '@/lib/photo/url';

/**
 * L'en-tête du compte : qui vous êtes ici, et ce que vous y avez fait.
 *
 * ─── Pourquoi une bande, et pas un titre de plus ──────────────────────────
 *
 * La page s'ouvrait sur « Votre compte » et « Connecté avec
 * adresse@exemple.fr » — deux lignes de texte brut, identiques pour tout le
 * monde. Rien ne disait à qui appartenait cet écran, ni que quatre-vingts
 * prises y étaient consignées. Un compte qui ne montre pas ce qu'il contient
 * ressemble à un formulaire administratif.
 *
 * Les chiffres sont des FAITS, pas des félicitations : « 12 prises » se
 * vérifie, « vous progressez » serait une flatterie qu'aucune donnée ne
 * soutient. Aucun n'est affiché à zéro — un compteur à zéro reproche quelque
 * chose à qui vient d'arriver ; il apparaît quand il a du sens.
 */
export function EnteteCompte({
  profil,
  email,
  prises,
  especes,
  spots,
  favoris,
  sorties,
}: {
  profil: Profile;
  email: string | null;
  prises: number;
  especes: number;
  spots: number;
  favoris: number;
  sorties: number;
}) {
  const chiffres: { valeur: number; singulier: string; pluriel: string }[] = [
    { valeur: prises, singulier: 'prise', pluriel: 'prises' },
    { valeur: especes, singulier: 'espèce', pluriel: 'espèces' },
    { valeur: spots, singulier: 'spot pêché', pluriel: 'spots pêchés' },
    { valeur: favoris, singulier: 'favori', pluriel: 'favoris' },
    { valeur: sorties, singulier: 'sortie à venir', pluriel: 'sorties à venir' },
  ].filter((c) => c.valeur > 0);

  const depuis = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(profil.createdAt));

  return (
    <header className="entete-compte">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          url={photoUrl(profil.avatarPath)}
          taille={72}
          initiale={profil.displayName.slice(0, 1).toUpperCase()}
        />

        <div className="min-w-0">
          <h1 className="font-serif text-h1 font-semibold">{profil.displayName}</h1>
          <p className="mt-1 text-body text-fg-muted">
            {email !== null && <span className="nums">{email}</span>}
            {email !== null && ' · '}
            <span>membre depuis {depuis}</span>
          </p>
        </div>
      </div>

      {chiffres.length > 0 && (
        <dl className="entete-chiffres">
          {chiffres.map((c) => (
            <div key={c.singulier} className="entete-chiffre">
              <dt className="sr-only">{c.valeur > 1 ? c.pluriel : c.singulier}</dt>
              <dd>
                <span className="entete-nombre nums" data-numeric="">
                  {c.valeur}
                </span>{' '}
                <span className="entete-libelle">{c.valeur > 1 ? c.pluriel : c.singulier}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
