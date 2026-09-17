import { ProfileForm } from '@/components/account/ProfileForm';
import { AvatarForm, ProfilForm } from '@/components/account/ProfilForms';
import type { Profile } from '@/data/schemas';
import { photoUrl } from '@/lib/photo/url';

/**
 * Identité : la photo, le nom public, et les champs privés.
 *
 * La séparation compte plus que la mise en page : à gauche ce que les autres
 * voient, à droite ce qui ne sert qu'à soi. Une personne doit pouvoir dire, en
 * un coup d'œil, ce qu'elle publie en remplissant un champ.
 */
export function PanneauProfil({ profil }: { profil: Profile }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="fiche">
          <h3 className="fiche-titre">Photo</h3>
          <div className="mt-4">
            <AvatarForm
              avatarUrl={photoUrl(profil.avatarPath)}
              initiale={profil.displayName.slice(0, 1).toUpperCase()}
            />
          </div>
        </section>

        <section className="fiche">
          <h3 className="fiche-titre">Nom affiché</h3>
          <p className="fiche-note">
            La seule chose que les autres voient. Votre adresse e-mail n’est jamais affichée.
          </p>
          <div className="mt-4">
            <ProfileForm mode="rename" currentName={profil.displayName} />
          </div>
        </section>
      </div>

      <section className="fiche lg:p-6">
        <h3 className="fiche-titre">Informations et localisation</h3>
        <p className="fiche-note max-w-prose">
          Rien n’est obligatoire ici, et rien n’est public : ces champs ne servent qu’à vous. La
          ville sert à retrouver vos spots proches ; elle n’est pas une position, et nous ne
          demandons jamais la vôtre.
        </p>
        <div className="mt-4">
          <ProfilForm profil={profil} />
        </div>
      </section>
    </div>
  );
}
