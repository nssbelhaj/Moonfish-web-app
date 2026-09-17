import type { ReactNode } from 'react';

import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';

/**
 * Export et effacement, côte à côte et non l'un sous l'autre.
 *
 * « Pensez à exporter avant » n'est utile que si le bouton d'export est
 * visible en même temps que celui qui efface.
 */
export function PanneauDonnees({ exploitation }: { exploitation: ReactNode }) {
  return (
    <>
      <h2 id="donnees" className="panneau-titre">
        Vos données
      </h2>
      <p className="panneau-chapo">
        Tout ce que nous détenons sur vous — profil, avis, prises, favoris, sorties — tient dans un
        fichier que vous pouvez télécharger maintenant, sans nous le demander et sans délai.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="fiche">
          <h3 className="fiche-titre">Exporter</h3>
          <p className="fiche-note">
            Un fichier JSON, lisible et complet. Rien n’est retenu, rien n’est différé.
          </p>
          <p className="mt-4">
            <a
              href="/api/compte/export"
              className="inline-flex min-h-tap items-center rounded-ctl border border-edge-strong px-5 font-600 text-fg hover:bg-surface-2"
              download
            >
              Télécharger mes données (JSON)
            </a>
          </p>
        </section>

        <section className="fiche">
          <h3 className="fiche-titre">Effacer le compte</h3>
          <p className="fiche-note">
            La suppression emporte le profil, les avis, les prises, les photos, les favoris et les
            sorties. Elle est immédiate et sans retour possible. Nous ne gardons pas de copie « au
            cas où » : ce serait exactement ce que l’effacement interdit. Pensez à exporter avant,
            si vous voulez les garder.
          </p>
          <div className="mt-4">
            <DeleteAccountForm />
          </div>
        </section>
      </div>

      {exploitation}
    </>
  );
}
