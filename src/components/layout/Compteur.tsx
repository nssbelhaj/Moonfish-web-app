'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Le compteur de pages vues, côté navigateur : un chemin, envoyé à NOTRE
 * serveur, et rien d'autre.
 *
 * ─── Pourquoi un composant client sur un site statique ────────────────────
 *
 * Les pages sont pré-rendues et servies depuis un cache : le serveur ne
 * voit pas chaque visite, il voit une régénération par heure. Le seul
 * endroit qui sait qu'une page a été vue est le navigateur qui la voit.
 *
 * ─── Ce qui part, et ce qui ne part pas ───────────────────────────────────
 *
 * Le chemin de la page, sans paramètres. Pas d'identifiant, pas de cookie —
 * `sendBeacon` en enverrait un s'il existait, et le seul cookie du site est
 * celui de la session, qui ne sert à rien ici : la route ne le lit pas. Pas
 * de provenance, pas de taille d'écran, pas de durée.
 *
 * Si le navigateur porte le signal Global Privacy Control, ou l'ancien Do
 * Not Track, rien ne part du tout.
 */
export function Compteur() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null };
    if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return;

    const chemin = pathname.split('?')[0] ?? pathname;
    try {
      if (typeof nav.sendBeacon === 'function') {
        nav.sendBeacon('/api/visite', chemin);
      } else {
        void fetch('/api/visite', { method: 'POST', body: chemin, keepalive: true }).catch(() => undefined);
      }
    } catch {
      // Un compteur qui échoue n'a rien à dire à la personne.
    }
  }, [pathname]);

  return null;
}
