/**
 * Valeurs de thème qui NE PEUVENT PAS être des variables CSS.
 *
 * Une balise `<meta name="theme-color">` est lue par le navigateur avant tout
 * rendu, pour teinter sa propre interface : elle n'a pas accès à la cascade et
 * exige donc une couleur littérale. C'est la seule valeur de la palette qui
 * échappe aux deux fichiers de tokens, d'où ce module — pour qu'elle soit
 * trouvable au lieu d'être oubliée dans un coin de `layout.tsx` le jour d'un
 * changement de direction artistique.
 *
 * Doit toujours refléter `--page` du thème CLAIR, qui est le défaut du v3.
 * Sa synchronisation avec tokens.css est vérifiée par `og-palette.test.ts` :
 * elle valait encore `#0A0B0D` alors que le thème sombre du v2 était passé à
 * `#0b0d0f`, sans que rien ne le signale.
 */
export const BROWSER_THEME_COLOR = '#f7f4ed';

/** Clé de mémorisation du thème, par appareil. */
export const THEME_STORAGE_KEY = 'lunamarea-theme';

export type Theme = 'clair' | 'nuit';

/**
 * Script posé AVANT le premier rendu.
 *
 * Sans lui, la page peint d'abord le thème clair par défaut, puis bascule à
 * l'hydratation : un flash blanc en pleine nuit, sur une plage, exactement ce
 * que D19 interdit. Il doit donc rester synchrone et inline dans le <head> —
 * un module différé arriverait trop tard.
 *
 * L'ordre de décision est celui de D18 : le choix explicite gagne s'il existe,
 * sinon on suit le système.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var n=s?s==='nuit':window.matchMedia('(prefers-color-scheme: dark)').matches;
if(n)document.documentElement.setAttribute('data-theme','night');
}catch(e){}})();`;
