import { PreferencesForm } from '@/components/account/ProfilForms';
import type { Profile } from '@/data/schemas';

/** Deux cases, et rien qui parte sans elles. */
export function PanneauPreferences({ profil }: { profil: Profile }) {
  return (
    <>
      <h2 id="preferences" className="panneau-titre">
        Préférences de communication
      </h2>
      <p className="panneau-chapo">
        Deux cases, et elles partent décochées sauf celle que vous avez déjà demandée en
        programmant une sortie. Nous n’envoyons rien que vous n’ayez coché, et chaque message porte
        son lien de désabonnement.
      </p>

      <section className="fiche mt-6 max-w-prose">
        <PreferencesForm profil={profil} />
      </section>
    </>
  );
}
