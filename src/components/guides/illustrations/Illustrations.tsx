import type { ReactNode } from 'react';

/**
 * Les illustrations des guides : des planches dessinées, pas des photos.
 *
 * ─── Pourquoi du SVG dessiné ici, et pas des images ───────────────────────
 *
 * Une planche de montage doit être lisible en plein soleil et de nuit sous
 * une frontale rouge : elle prend donc les COULEURS DU THÈME (`var(--fg)`,
 * `var(--accent)`, `var(--water)`) et se retourne avec lui, ce qu'aucune
 * image ne ferait. Elle se redimensionne sans flou, pèse quelques
 * kilo-octets, et ne charge rien depuis un tiers — la page de
 * confidentialité le promet.
 *
 * ─── Repères numérotés, légende en HTML ───────────────────────────────────
 *
 * Le texte dans un SVG se réduit avec lui : sur un téléphone, une planche de
 * 600 unités affichée en 360 pixels rend un libellé de 13 unités en 8 pixels,
 * illisible. Le dessin ne porte donc que des pastilles numérotées et deux ou
 * trois mots d'orientation ; les explications vivent dans une liste HTML à
 * côté, qui se lit à sa taille de texte, se replie sous le dessin sur mobile,
 * et passe par un lecteur d'écran comme n'importe quel texte.
 *
 * Chaque planche porte un `<title>` (UNE chaîne, exigence de React 19) et une
 * légende sous la figure : ce qu'elle montre se lit aussi sans la voir.
 *
 * Les proportions sont schématiques, et le disent : un montage n'est pas à
 * l'échelle, la règle des douzièmes est un principe, pas une table.
 */

const TRAIT = 'var(--fg)';
const DOUX = 'var(--fg-muted)';
const ACCENT = 'var(--accent)';
const SUR_ACCENT = 'var(--fg-on-accent)';
const EAU = 'var(--water)';
const SABLE = 'var(--surface-2)';
const ROCHE = 'var(--edge-strong)';
const CARTE = 'var(--card)';
const DANGER = 'var(--danger)';

/* ─── Le cadre et les motifs ────────────────────────────────────────────── */

function Cadre({ titre, viewBox, children }: { titre: string; viewBox: string; children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      className="block h-auto w-full"
      role="img"
      aria-label={titre}
      fontFamily="var(--font-archivo), Archivo, system-ui, sans-serif"
      fontSize={14}
      fill={TRAIT}
    >
      <title>{titre}</title>
      {children}
    </svg>
  );
}

/**
 * Les motifs d'une planche. Chaque SVG a les siens, préfixés par son nom :
 * deux planches sur une même page ne partagent pas un identifiant.
 */
function Motifs({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}-sable`} width={22} height={22} patternUnits="userSpaceOnUse">
        <g fill={DOUX} opacity={0.32}>
          <circle cx={3} cy={4} r={1.1} />
          <circle cx={14} cy={2} r={0.9} />
          <circle cx={9} cy={12} r={1.2} />
          <circle cx={19} cy={15} r={1} />
          <circle cx={4} cy={18} r={0.9} />
        </g>
      </pattern>
      <pattern id={`${p}-eau`} width={56} height={18} patternUnits="userSpaceOnUse">
        <path d="M0,9 q14,-7 28,0 t28,0" fill="none" stroke={CARTE} strokeWidth={1.4} opacity={0.45} />
      </pattern>
      <pattern id={`${p}-roche`} width={14} height={14} patternUnits="userSpaceOnUse">
        <path d="M0,14 L14,0" stroke={TRAIT} strokeWidth={1} opacity={0.22} />
      </pattern>
      <pattern id={`${p}-danger`} width={10} height={10} patternUnits="userSpaceOnUse">
        <path d="M0,10 L10,0" stroke={DANGER} strokeWidth={2} opacity={0.6} />
      </pattern>
      <linearGradient id={`${p}-profondeur`} x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor={EAU} stopOpacity={0.35} />
        <stop offset={1} stopColor={EAU} stopOpacity={0.8} />
      </linearGradient>
      <linearGradient id={`${p}-large`} x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor={EAU} stopOpacity={0.8} />
        <stop offset={1} stopColor={EAU} stopOpacity={0.35} />
      </linearGradient>
      <linearGradient id={`${p}-metal`} x1={0} y1={0} x2={1} y2={0}>
        <stop offset={0} stopColor={DOUX} />
        <stop offset={0.45} stopColor={TRAIT} stopOpacity={0.55} />
        <stop offset={1} stopColor={DOUX} />
      </linearGradient>
    </defs>
  );
}

/* ─── Les pastilles ─────────────────────────────────────────────────────── */

function Repere({ n, x, y, vers }: { n: number; x: number; y: number; vers?: [number, number] }) {
  return (
    <g>
      {vers && <line x1={x} y1={y} x2={vers[0]} y2={vers[1]} stroke={TRAIT} strokeWidth={1.2} opacity={0.7} />}
      <circle cx={x} cy={y} r={11} fill={ACCENT} stroke={CARTE} strokeWidth={2} />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={SUR_ACCENT}>
        {n}
      </text>
    </g>
  );
}

function Mot({ x, y, ancre = 'start', taille = 13, children }: { x: number; y: number; ancre?: 'start' | 'middle' | 'end'; taille?: number; children: string }) {
  return (
    <text x={x} y={y} textAnchor={ancre} fill={DOUX} fontSize={taille} letterSpacing={0.4}>
      {children}
    </text>
  );
}

/* ─── Les pièces ────────────────────────────────────────────────────────── */

/**
 * Un hameçon : œillet, hampe, courbure, pointe rentrante et ardillon. Ancré
 * par l'œillet en (x, y), hampe vers le bas ; `angle` le tourne autour de
 * l'œillet, et l'esche tourne avec lui.
 */
function Hamecon({ x, y, angle = 0, esche, taille = 1 }: { x: number; y: number; angle?: number; esche?: 'ver' | 'crabe'; taille?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${taille})`} fill="none" stroke={TRAIT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={0} r={3.5} />
      <path d="M0,3.5 V30 A12,12 0 0 0 24,30 V19 L21,14" />
      <path d="M24,22 l-5,3" />
      {esche === 'ver' && (
        <path d="M-1,7 c-7,6 8,11 2,18 c-5,6 4,10 10,9 c5,-1 8,-6 12,-4" stroke={ACCENT} strokeWidth={4.5} opacity={0.9} />
      )}
      {esche === 'crabe' && (
        <g transform="translate(12 24)">
          <ellipse cx={0} cy={0} rx={12} ry={8} fill={ACCENT} stroke="none" />
          <g stroke={ACCENT} strokeWidth={2}>
            <path d="M-10,-3 l-7,-5 M-12,1 l-8,1 M-10,5 l-7,5 M10,-3 l7,-5 M12,1 l8,1 M10,5 l7,5" />
            <path d="M-6,-7 c-4,-6 -12,-6 -12,-1 M6,-7 c4,-6 12,-6 12,-1" />
          </g>
        </g>
      )}
    </g>
  );
}

/** Un émerillon à barillet, vertical ; `angle` 90 le couche. */
function Emerillon({ x, y, angle = 0, p }: { x: number; y: number; angle?: number; p: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} stroke={TRAIT} strokeWidth={2}>
      <circle cx={0} cy={-13} r={3.5} fill="none" />
      <circle cx={0} cy={13} r={3.5} fill="none" />
      <ellipse cx={0} cy={0} rx={4.5} ry={8} fill={`url(#${p}-metal)`} />
    </g>
  );
}

/** Une agrafe. */
function Agrafe({ x, y, angle = 0 }: { x: number; y: number; angle?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round">
      <path d="M-4,-9 v18 a4,4 0 0 0 8,0 v-18 a4,4 0 0 0 -8,0 z" fill={CARTE} />
      <path d="M0,-9 v7" />
    </g>
  );
}

function Perle({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5.5} fill={ACCENT} />
      <circle cx={x - 1.8} cy={y - 1.8} r={1.6} fill={CARTE} opacity={0.85} />
    </g>
  );
}

/** Une boucle nouée sur le corps de ligne, d'où part une empile. */
function Boucle({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5} fill={CARTE} stroke={TRAIT} strokeWidth={2} />
      <circle cx={x} cy={y} r={1.6} fill={TRAIT} />
    </g>
  );
}

/** Un plomb grappin : corps fuselé, anneau, quatre branches recourbées. */
function PlombGrappin({ x, y, p }: { x: number; y: number; p: string }) {
  return (
    <g>
      <g fill="none" stroke={TRAIT} strokeWidth={1.8} strokeLinecap="round">
        <path d={`M${x - 6},${y + 14} C${x - 16},${y + 2} ${x - 30},${y - 8} ${x - 27},${y - 30} L${x - 34},${y - 26}`} />
        <path d={`M${x + 6},${y + 14} C${x + 16},${y + 2} ${x + 30},${y - 8} ${x + 27},${y - 30} L${x + 34},${y - 26}`} />
        <path d={`M${x - 3},${y + 12} C${x - 8},${y - 4} ${x - 15},${y - 16} ${x - 12},${y - 36} L${x - 18},${y - 33}`} />
        <path d={`M${x + 3},${y + 12} C${x + 8},${y - 4} ${x + 15},${y - 16} ${x + 12},${y - 36} L${x + 18},${y - 33}`} />
      </g>
      <circle cx={x} cy={y - 4} r={4} fill="none" stroke={TRAIT} strokeWidth={2} />
      <path d={`M${x},${y} C${x - 17},${y + 10} ${x - 17},${y + 54} ${x},${y + 66} C${x + 17},${y + 54} ${x + 17},${y + 10} ${x},${y} Z`} fill={`url(#${p}-metal)`} stroke={TRAIT} strokeWidth={1.2} />
    </g>
  );
}

/** Un plomb poire avec son anneau. */
function PlombPoire({ x, y, p }: { x: number; y: number; p: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={3.5} fill="none" stroke={TRAIT} strokeWidth={2} />
      <path d={`M${x},${y + 3} c-8,7 -14,17 -14,27 a14,14 0 0 0 28,0 c0,-10 -6,-20 -14,-27 z`} fill={`url(#${p}-metal)`} stroke={TRAIT} strokeWidth={1.2} />
    </g>
  );
}

/** Une olive percée, couchée sur une ligne horizontale, qui coulisse. */
function PlombOlive({ x, y, p }: { x: number; y: number; p: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={27} ry={13} fill={`url(#${p}-metal)`} stroke={TRAIT} strokeWidth={1.2} />
      <line x1={x - 27} y1={y} x2={x + 27} y2={y} stroke={CARTE} strokeWidth={1.6} opacity={0.75} />
      <g fill="none" stroke={DOUX} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${x - 30},${y + 28} H${x + 30}`} />
        <path d={`M${x - 24},${y + 23} l-6,5 6,5 M${x + 24},${y + 23} l6,5 -6,5`} />
      </g>
    </g>
  );
}

/** Une tête plombée et son leurre souple à queue en palette. */
function LeurreSouple({ x, y, p }: { x: number; y: number; p: string }) {
  return (
    <g>
      {/* La hampe traverse le corps ; la courbure ressort sur le dos. */}
      <path d={`M${x + 8},${y - 1} H${x + 50} A9,9 0 0 0 ${x + 50},${y - 19} L${x + 47},${y - 23}`} fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round" />
      <path d={`M${x + 6},${y - 9} C${x + 30},${y - 15} ${x + 62},${y - 13} ${x + 84},${y - 4} L${x + 92},${y} L${x + 84},${y + 4} C${x + 62},${y + 13} ${x + 30},${y + 15} ${x + 6},${y + 9} Z`} fill={ACCENT} opacity={0.9} />
      <path d={`M${x + 90},${y} c8,-14 22,-13 24,-2 c0,10 -14,14 -24,2 z`} fill={ACCENT} opacity={0.9} />
      <g fill="none" stroke={CARTE} strokeWidth={1.2} opacity={0.5}>
        <path d={`M${x + 28},${y - 11} q3,11 0,22 M${x + 44},${y - 12} q3,12 0,24 M${x + 60},${y - 11} q3,11 0,22`} />
      </g>
      <circle cx={x} cy={y} r={11} fill={`url(#${p}-metal)`} stroke={TRAIT} strokeWidth={1.2} />
      <circle cx={x - 2} cy={y - 3} r={3.2} fill={CARTE} />
      <circle cx={x - 1.5} cy={y - 3} r={1.6} fill={TRAIT} />
    </g>
  );
}

/** Un poisson vu de profil, nageant vers la gauche ; `angle` l'oriente. */
function Poisson({ x, y, angle = 0, taille = 1 }: { x: number; y: number; angle?: number; taille?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${taille})`} fill={TRAIT} opacity={0.75}>
      <path d="M0,0 c9,-9 24,-9 32,0 c-8,9 -23,9 -32,0 z M31,0 l9,-7 v14 z" />
      <circle cx={7} cy={-1.5} r={1.4} fill={CARTE} />
    </g>
  );
}

/** Un pêcheur, pieds en (x, y), canne vers la droite. */
function Pecheur({ x, y, taille = 1 }: { x: number; y: number; taille?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${taille})`} stroke={TRAIT} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx={0} cy={-44} r={6} fill={TRAIT} stroke="none" />
      <path d="M0,-36 V-16 M0,-16 l-7,16 M0,-16 l7,16" strokeWidth={4} />
      <path d="M0,-32 l10,-4 l6,-8" strokeWidth={3.5} />
      <path d="M0,-30 l-8,6" strokeWidth={3.5} />
      <path d="M12,-38 l34,-40" strokeWidth={1.8} />
    </g>
  );
}

/** Une pointe de flèche posée en (x, y), tournée de `angle` degrés (0 = vers la droite). */
function Pointe({ x, y, angle, couleur = TRAIT, epaisseur = 3 }: { x: number; y: number; angle: number; couleur?: string; epaisseur?: number }) {
  return (
    <path d="M-12,-9 L0,0 L-12,9" transform={`translate(${x} ${y}) rotate(${angle})`} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" />
  );
}

/* ─── Les planches ──────────────────────────────────────────────────────── */

export function MontageDeuxEmpiles() {
  const p = 'empiles';
  const X = 210;
  return (
    <Cadre titre="Montage à deux empiles, dessiné de haut en bas : arraché épais, émerillon à barillet, corps de ligne portant deux boucles d'où partent deux empiles décalées avec chacune un hameçon esché d'un ver, agrafe et plomb grappin à quatre branches" viewBox="36 0 350 620">
      <Motifs p={p} />
      {/* Arraché, corps, agrafe et plomb sur un même axe */}
      <line x1={X} y1={16} x2={X} y2={112} stroke={TRAIT} strokeWidth={5} strokeLinecap="round" />
      <line x1={X} y1={112} x2={X} y2={478} stroke={TRAIT} strokeWidth={2.5} />
      <Emerillon x={X} y={130} p={p} />
      {/* Cote du corps de ligne */}
      <g stroke={DOUX} strokeWidth={1}>
        <line x1={262} y1={150} x2={262} y2={468} />
        <line x1={256} y1={150} x2={268} y2={150} />
        <line x1={256} y1={468} x2={268} y2={468} />
      </g>
      <Mot x={270} y={314} taille={17}>1,20 m</Mot>
      {/* Première empile, vers la gauche */}
      <path d={`M${X},220 Q150,232 100,250`} fill="none" stroke={TRAIT} strokeWidth={1.5} />
      <Boucle x={X} y={220} />
      <Hamecon x={100} y={250} esche="ver" taille={1.25} />
      {/* Seconde empile, décalée, vers la droite */}
      <path d={`M${X},360 Q270,372 320,392`} fill="none" stroke={TRAIT} strokeWidth={1.5} />
      <Boucle x={X} y={360} />
      <Hamecon x={320} y={392} esche="ver" taille={1.25} />
      {/* Agrafe et plomb */}
      <Agrafe x={X} y={488} />
      <line x1={X} y1={497} x2={X} y2={528} stroke={TRAIT} strokeWidth={2.5} />
      <PlombGrappin x={X} y={536} p={p} />

      <Repere n={1} x={150} y={62} vers={[X - 4, 62]} />
      <Repere n={2} x={272} y={130} vers={[X + 8, 130]} />
      <Repere n={3} x={150} y={300} vers={[X - 3, 300]} />
      <Repere n={4} x={60} y={300} vers={[100, 270]} />
      <Repere n={5} x={372} y={440} vers={[340, 418]} />
      <Repere n={6} x={300} y={578} vers={[X + 16, 578]} />
    </Cadre>
  );
}

export function MontageCoulissant() {
  const p = 'coulissant';
  return (
    <Cadre titre="Montage coulissant, dessiné à l'horizontale : le corps de ligne vient de la canne, traverse une olive percée qui coulisse, puis une perle et un émerillon l'arrêtent ; une empile longue et fine porte l'hameçon esché" viewBox="0 0 600 200">
      <Motifs p={p} />
      <line x1={44} y1={100} x2={300} y2={100} stroke={TRAIT} strokeWidth={2.5} />
      <Pointe x={40} y={100} angle={180} epaisseur={2.5} />
      <Mot x={58} y={84}>vers la canne</Mot>
      <PlombOlive x={170} y={100} p={p} />
      <Perle x={262} y={100} />
      <Emerillon x={296} y={100} angle={90} p={p} />
      <path d="M309,100 Q420,109 520,100" fill="none" stroke={TRAIT} strokeWidth={1.2} />
      <Hamecon x={520} y={100} angle={-90} esche="ver" />

      <Repere n={1} x={100} y={150} vers={[100, 106]} />
      <Repere n={2} x={210} y={160} vers={[192, 118]} />
      <Repere n={3} x={250} y={50} vers={[260, 92]} />
      <Repere n={4} x={330} y={150} vers={[302, 110]} />
      <Repere n={5} x={420} y={60} vers={[420, 100]} />
      <Repere n={6} x={565} y={150} vers={[540, 110]} />
    </Cadre>
  );
}

export function MontageSoutenirRoche() {
  const p = 'roche';
  const X = 210;
  return (
    <Cadre titre="Montage à soutenir sur la roche, dessiné de haut en bas sous la surface : émerillon, corps de ligne, une empile courte portant un hameçon fort esché d'un crabe, puis un fil plus faible jusqu'à un plomb poire coincé dans une fissure de la roche couverte d'algues" viewBox="36 0 350 560">
      <Motifs p={p} />
      {/* L'eau, de la surface au fond */}
      <rect x={0} y={40} width={420} height={520} fill={`url(#${p}-profondeur)`} />
      <rect x={0} y={34} width={420} height={18} fill={`url(#${p}-eau)`} />
      <path d="M0,40 q20,-6 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t20,0" fill="none" stroke={EAU} strokeWidth={2} />
      {/* La roche et ses algues */}
      <path d="M0,560 V430 C40,410 70,455 120,438 C160,424 185,470 220,472 C260,474 280,432 330,446 C370,456 395,440 420,428 V560 Z" fill={ROCHE} />
      <path d="M0,560 V430 C40,410 70,455 120,438 C160,424 185,470 220,472 C260,474 280,432 330,446 C370,456 395,440 420,428 V560 Z" fill={`url(#${p}-roche)`} />
      <g fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round" opacity={0.55}>
        <path d="M60,428 c-6,-14 2,-26 8,-34 M70,432 c2,-16 12,-22 14,-34 M300,442 c-8,-12 -2,-24 4,-32 M312,444 c4,-14 12,-18 10,-30 M370,446 c-4,-12 2,-20 8,-26" />
      </g>
      {/* La ligne */}
      <line x1={X} y1={0} x2={X} y2={352} stroke={TRAIT} strokeWidth={2.5} />
      <Emerillon x={X} y={90} p={p} />
      <path d={`M${X},190 Q260,197 300,212`} fill="none" stroke={TRAIT} strokeWidth={1.6} />
      <Boucle x={X} y={190} />
      <Hamecon x={300} y={212} esche="crabe" taille={1.25} />
      <line x1={X} y1={352} x2={X} y2={422} stroke={DOUX} strokeWidth={1.2} strokeDasharray="4 3" />
      <PlombPoire x={X} y={426} p={p} />

      <Repere n={1} x={150} y={140} vers={[X - 4, 140]} />
      <Repere n={2} x={272} y={90} vers={[X + 8, 90]} />
      <Repere n={3} x={330} y={168} vers={[290, 202]} />
      <Repere n={4} x={366} y={258} vers={[334, 240]} />
      <Repere n={5} x={150} y={386} vers={[X - 4, 386]} />
      <Repere n={6} x={300} y={440} vers={[X + 16, 440]} />
      <Repere n={7} x={70} y={512} />
    </Cadre>
  );
}

export function MontageLeurre() {
  const p = 'leurre';
  return (
    <Cadre titre="Ligne de lancer-ramener, dessinée à l'horizontale : tresse fine, nœud de raccord conique, bas de ligne en fluorocarbone, agrafe, puis une tête plombée portant un leurre souple à queue en palette" viewBox="0 0 600 190">
      <Motifs p={p} />
      {/* La tresse : deux brins de couleurs alternées */}
      <line x1={30} y1={100} x2={222} y2={100} stroke={TRAIT} strokeWidth={2.4} strokeDasharray="5 4" />
      <line x1={30} y1={100} x2={222} y2={100} stroke={ACCENT} strokeWidth={2.4} strokeDasharray="5 4" strokeDashoffset={4.5} />
      {/* Le nœud de raccord, conique */}
      <line x1={222} y1={100} x2={252} y2={100} stroke={TRAIT} strokeWidth={3} />
      <g stroke={TRAIT} strokeWidth={1.4} strokeLinecap="round">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const h = 6 - i * 0.6;
          return <line key={i} x1={224 + i * 4} y1={100 - h} x2={224 + i * 4} y2={100 + h} />;
        })}
      </g>
      {/* Le fluorocarbone, fin */}
      <line x1={252} y1={100} x2={432} y2={100} stroke={TRAIT} strokeWidth={1.4} />
      <Agrafe x={441} y={100} angle={90} />
      <LeurreSouple x={464} y={100} p={p} />

      <Repere n={1} x={120} y={55} vers={[120, 96]} />
      <Repere n={2} x={236} y={148} vers={[236, 108]} />
      <Repere n={3} x={340} y={55} vers={[340, 97]} />
      <Repere n={4} x={441} y={150} vers={[441, 112]} />
      <Repere n={5} x={470} y={48} vers={[466, 88]} />
      <Repere n={6} x={548} y={150} vers={[535, 112]} />
    </Cadre>
  );
}

export function RegleDesDouziemes() {
  const p = 'douziemes';
  const x0 = 110;
  const largeur = 440;
  const yBas = 250;
  const yHaut = 70;
  const heure = largeur / 6;
  /* Une montante de six heures suit une demi-sinusoïde : l'aire sous la courbe,
     découpée par heure, donne les douzièmes 1, 2, 3, 3, 2, 1. */
  const echantillons = Array.from({ length: 49 }, (_, i) => {
    const t = (i / 48) * 6;
    const h = (1 - Math.cos((Math.PI * t) / 6)) / 2;
    return [x0 + (t / 6) * largeur, yBas - h * (yBas - yHaut)] as const;
  });
  const courbe = echantillons.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const cumuls = [0, 1, 3, 6, 9, 11, 12];
  const increments = ['+1/12', '+2/12', '+3/12', '+3/12', '+2/12', '+1/12'];
  const heures = ['1ʳᵉ h', '2ᵉ h', '3ᵉ h', '4ᵉ h', '5ᵉ h', '6ᵉ h'];
  const yDe = (douziemes: number) => yBas - (douziemes / 12) * (yBas - yHaut);

  return (
    <Cadre titre="La règle des douzièmes : sur six heures de montante, la hauteur d'eau suit une courbe en S ; elle monte d'un douzième la première heure, deux la deuxième, trois la troisième et la quatrième, puis deux et un — la moitié du marnage se joue dans les deux heures centrales" viewBox="0 0 600 320">
      <Motifs p={p} />
      {/* Les bandes horaires, les deux centrales soulignées */}
      {increments.map((_, i) => (
        <rect key={i} x={x0 + i * heure} y={yHaut - 10} width={heure} height={yBas - yHaut + 10} fill={i === 2 || i === 3 ? ACCENT : DOUX} opacity={i === 2 || i === 3 ? 0.14 : i % 2 ? 0.05 : 0} />
      ))}
      {/* L'eau sous la courbe */}
      <path d={`${courbe} L${x0 + largeur},${yBas} L${x0},${yBas} Z`} fill={`url(#${p}-profondeur)`} />
      <path d={`${courbe} L${x0 + largeur},${yBas} L${x0},${yBas} Z`} fill={`url(#${p}-eau)`} />
      {/* Niveaux de basse et pleine mer */}
      <g stroke={DOUX} strokeWidth={1} strokeDasharray="3 4">
        <line x1={x0} y1={yHaut} x2={x0 + largeur} y2={yHaut} />
        <line x1={x0} y1={yBas} x2={x0 + largeur} y2={yBas} />
      </g>
      <Mot x={x0 - 10} y={yHaut + 5} ancre="end">Pleine mer</Mot>
      <Mot x={x0 - 10} y={yBas + 5} ancre="end">Basse mer</Mot>
      {/* La courbe et ses points horaires */}
      <path d={courbe} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinejoin="round" />
      {cumuls.map((c, i) => (
        <g key={i}>
          <circle cx={x0 + i * heure} cy={yDe(c)} r={4.5} fill={ACCENT} stroke={CARTE} strokeWidth={1.5} />
          {i > 0 && i < 6 && (
            <text x={x0 + i * heure} y={yDe(c) - 12} textAnchor="middle" fontSize={12} fill={TRAIT} fontWeight={600}>
              {`${c}/12`}
            </text>
          )}
        </g>
      ))}
      {/* Les heures et leurs douzièmes */}
      {increments.map((inc, i) => (
        <g key={inc + i}>
          <text x={x0 + i * heure + heure / 2} y={yBas + 24} textAnchor="middle" fontSize={13} fill={DOUX}>
            {heures[i]}
          </text>
          <text x={x0 + i * heure + heure / 2} y={yBas + 44} textAnchor="middle" fontSize={14} fontWeight={700} fill={i === 2 || i === 3 ? ACCENT : TRAIT}>
            {inc}
          </text>
        </g>
      ))}
      {/* L'accolade de la moitié du marnage, sur la droite des heures centrales */}
      <g stroke={TRAIT} strokeWidth={1.5} fill="none">
        <path d={`M${x0 + 4 * heure + 8},${yDe(3)} h8 V${yDe(9)} h-8`} />
      </g>
      <text x={x0 + 4 * heure + 24} y={(yDe(3) + yDe(9)) / 2 + 5} fontSize={14} fontWeight={600} fill={TRAIT}>
        ½ du marnage
      </text>
      <Mot x={x0 + largeur} y={yBas + 66} ancre="end">La descendante suit la même règle, à l’envers</Mot>

      <Repere n={1} x={x0 + heure / 2} y={yBas - 44} vers={[x0 + heure / 2, yDe(0.5) - 4]} />
      <Repere n={2} x={x0 + 3 * heure} y={yHaut - 30} />
      <Repere n={3} x={x0 + 5.5 * heure} y={yHaut + 40} vers={[x0 + 5.5 * heure, yDe(11.5) + 6]} />
    </Cadre>
  );
}

export function BaineMontanteDescendante() {
  const p = 'baine';
  return (
    <Cadre titre="Une baïne vue du ciel, à la descendante : la mer en haut, la plage en bas, un banc de sable en croissant où les vagues déferlent, le bassin derrière lui, une passe à droite par laquelle le bassin se vide ; le courant de sortie file au large, du poisson chasse dans ce courant, un pêcheur se tient sur la plage à côté de la passe, et la zone de la passe est hachurée en danger" viewBox="0 0 600 400">
      <Motifs p={p} />
      {/* La mer, plus sombre au large, et sa houle */}
      <rect x={0} y={0} width={600} height={310} fill={`url(#${p}-large)`} />
      <rect x={0} y={0} width={600} height={170} fill={`url(#${p}-eau)`} />
      {/* La plage */}
      <path d="M0,400 V292 C100,280 200,300 300,290 C400,280 500,304 600,290 V400 Z" fill={SABLE} />
      <path d="M0,400 V292 C100,280 200,300 300,290 C400,280 500,304 600,290 V400 Z" fill={`url(#${p}-sable)`} />
      {/* Le banc de sable, et l'écume qui déferle sur sa face au large */}
      <path d="M110,236 C200,192 330,188 440,216 L440,242 C330,214 200,218 110,256 Z" fill={SABLE} />
      <path d="M110,236 C200,192 330,188 440,216 L440,242 C330,214 200,218 110,256 Z" fill={`url(#${p}-sable)`} />
      <path d="M112,232 C200,188 330,184 440,212" fill="none" stroke={CARTE} strokeWidth={3.5} strokeDasharray="12 9" strokeLinecap="round" opacity={0.85} />
      <path d="M490,224 C520,214 550,222 585,236 L585,256 C550,244 520,238 490,248 Z" fill={SABLE} />
      <path d="M490,224 C520,214 550,222 585,236 L585,256 C550,244 520,238 490,248 Z" fill={`url(#${p}-sable)`} />
      <path d="M492,220 C520,210 550,218 585,232" fill="none" stroke={CARTE} strokeWidth={3.5} strokeDasharray="12 9" strokeLinecap="round" opacity={0.85} />
      {/* Le courant de sortie : un filet principal, deux filets d'accompagnement */}
      <g fill="none" strokeLinecap="round">
        <path d="M200,266 C320,270 410,256 458,230 C480,214 490,184 494,150" stroke={ACCENT} strokeWidth={3.5} />
        <path d="M250,280 C360,286 430,268 470,242 C486,226 496,196 500,168" stroke={ACCENT} strokeWidth={1.6} opacity={0.7} />
        <path d="M300,256 C380,250 430,236 452,214 C468,196 478,170 484,142" stroke={ACCENT} strokeWidth={1.6} opacity={0.7} />
      </g>
      <Pointe x={494} y={148} angle={-80} couleur={ACCENT} epaisseur={3.5} />
      {/* Le poisson dans le courant, au-delà de la passe */}
      <Poisson x={520} y={120} angle={20} taille={0.8} />
      <Poisson x={545} y={92} angle={10} taille={0.7} />
      <Poisson x={505} y={80} angle={30} taille={0.6} />
      {/* La zone à ne jamais traverser */}
      <rect x={432} y={214} width={66} height={78} fill={`url(#${p}-danger)`} />
      <rect x={432} y={214} width={66} height={78} fill="none" stroke={DANGER} strokeWidth={2} strokeDasharray="6 4" />
      {/* Le pêcheur, à côté de la passe, sur le sable */}
      <Pecheur x={556} y={330} taille={0.9} />
      <Mot x={16} y={26}>Le large</Mot>
      <Mot x={16} y={384}>La plage</Mot>

      <Repere n={1} x={200} y={176} vers={[215, 208]} />
      <Repere n={2} x={150} y={274} />
      <Repere n={3} x={465} y={310} vers={[465, 294]} />
      <Repere n={4} x={440} y={110} vers={[482, 138]} />
      <Repere n={5} x={520} y={360} vers={[548, 332]} />
      <Repere n={6} x={380} y={340} vers={[430, 290]} />
    </Cadre>
  );
}

export function LireUnePlage() {
  const p = 'plage';
  const sable = 'M0,110 C70,120 140,175 200,185 C240,192 260,165 285,165 C320,165 350,225 400,240 C440,252 470,215 495,215 C530,215 570,245 600,262';
  return (
    <Cadre titre="Une plage de sable vue en coupe, à basse mer : le haut de plage où se tient un pêcheur, la pente vers un chenal, une première barre émergée, la fosse derrière elle, une seconde barre sous l'eau où déferle la houle, puis le large ; le lancer part du pêcheur et retombe dans la fosse, où deux poissons chassent ; un trait pointillé marque le niveau de pleine mer, haut sur la plage" viewBox="0 0 600 320">
      <Motifs p={p} />
      {/* L'eau à basse mer, puis le sable par-dessus */}
      <path d="M600,205 V262 C570,245 530,215 495,215 C470,215 440,252 400,240 C350,225 320,165 285,165 L285,205 Z" fill={`url(#${p}-profondeur)`} />
      <path d="M300,205 H600 V214 H300 Z" fill={`url(#${p}-eau)`} />
      <path d="M150,178 C170,182 190,186 215,184 L215,175 Z" fill={EAU} opacity={0.55} />
      <path d={`${sable} V320 H0 Z`} fill={SABLE} />
      <path d={`${sable} V320 H0 Z`} fill={`url(#${p}-sable)`} />
      {/* La houle qui déferle sur la seconde barre, et le clapot au large */}
      <path d="M462,206 C480,196 505,198 520,206" fill="none" stroke={CARTE} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <path d="M540,205 q10,-6 20,0 t20,0" fill="none" stroke={EAU} strokeWidth={2} />
      <line x1={300} y1={205} x2={600} y2={205} stroke={EAU} strokeWidth={1.5} />
      {/* Le niveau de pleine mer */}
      <line x1={30} y1={125} x2={600} y2={125} stroke={DOUX} strokeWidth={1.2} strokeDasharray="6 5" />
      <Mot x={596} y={120} ancre="end">Pleine mer</Mot>
      <Mot x={596} y={200} ancre="end">Basse mer</Mot>
      {/* Le poisson dans la fosse */}
      <Poisson x={372} y={224} taille={0.7} />
      <Poisson x={410} y={232} angle={-8} taille={0.6} />
      {/* Le pêcheur et son lancer */}
      <Pecheur x={60} y={119} taille={0.85} />
      <path d="M99,74 C200,-12 330,60 393,212" fill="none" stroke={TRAIT} strokeWidth={1.5} strokeDasharray="6 5" />
      <Pointe x={394} y={214} angle={68} epaisseur={2} />

      <Repere n={1} x={40} y={175} />
      <Repere n={2} x={285} y={132} vers={[285, 158]} />
      <Repere n={3} x={200} y={232} vers={[200, 192]} />
      <Repere n={4} x={400} y={286} vers={[400, 246]} />
      <Repere n={5} x={495} y={180} vers={[495, 210]} />
      <Repere n={6} x={560} y={150} vers={[560, 128]} />
      <Repere n={7} x={300} y={30} vers={[262, 52]} />
    </Cadre>
  );
}

export function VentDeMerDeTerre() {
  const p = 'vent';
  return (
    <Cadre titre="Un spot vu du ciel, la mer en haut et la plage en bas, avec un pêcheur face au large ; trois vents dessinés en flèches : de mer, qui souffle du large vers la plage ; de terre, qui vient de derrière le pêcheur ; de travers, qui longe la côte" viewBox="0 0 600 360">
      <Motifs p={p} />
      <rect x={0} y={0} width={600} height={210} fill={`url(#${p}-large)`} />
      <rect x={0} y={0} width={600} height={120} fill={`url(#${p}-eau)`} />
      <path d="M0,360 V198 C150,184 450,208 600,192 V360 Z" fill={SABLE} />
      <path d="M0,360 V198 C150,184 450,208 600,192 V360 Z" fill={`url(#${p}-sable)`} />
      <path d="M0,196 C150,182 450,206 600,190" fill="none" stroke={CARTE} strokeWidth={3.5} strokeDasharray="14 9" strokeLinecap="round" opacity={0.85} />
      {/* Le vent de mer, du large vers le bord */}
      <g fill="none" stroke={ACCENT} strokeWidth={3.5} strokeLinecap="round">
        <path d="M278,40 c-7,36 7,66 0,104" />
        <path d="M300,32 c-7,40 7,72 0,114" />
        <path d="M322,40 c-7,36 7,66 0,104" />
      </g>
      <Pointe x={278} y={146} angle={90} couleur={ACCENT} epaisseur={3.5} />
      <Pointe x={300} y={148} angle={90} couleur={ACCENT} epaisseur={3.5} />
      <Pointe x={322} y={146} angle={90} couleur={ACCENT} epaisseur={3.5} />
      {/* Le vent de terre, de derrière le pêcheur vers le large */}
      <g fill="none" stroke={DOUX} strokeWidth={3.5} strokeLinecap="round">
        <path d="M278,340 c7,-32 -7,-56 0,-88" />
        <path d="M300,346 c7,-36 -7,-64 0,-100" />
        <path d="M322,340 c7,-32 -7,-56 0,-88" />
      </g>
      <Pointe x={278} y={250} angle={-90} couleur={DOUX} epaisseur={3.5} />
      <Pointe x={300} y={244} angle={-90} couleur={DOUX} epaisseur={3.5} />
      <Pointe x={322} y={250} angle={-90} couleur={DOUX} epaisseur={3.5} />
      {/* Le vent de travers, le long de la côte */}
      <g fill="none" stroke={TRAIT} strokeWidth={3} strokeLinecap="round">
        <path d="M50,128 c40,-6 80,6 130,0" />
        <path d="M40,148 c44,-6 96,6 150,0" />
        <path d="M50,168 c40,-6 80,6 130,0" />
      </g>
      <Pointe x={182} y={128} angle={0} epaisseur={3} />
      <Pointe x={192} y={148} angle={0} epaisseur={3} />
      <Pointe x={182} y={168} angle={0} epaisseur={3} />
      {/* Le spot : un pêcheur face au large */}
      <Pecheur x={300} y={236} taille={0.9} />
      <Mot x={16} y={26}>Le large</Mot>
      <Mot x={16} y={346}>La terre</Mot>

      <Repere n={1} x={356} y={90} vers={[326, 90]} />
      <Repere n={2} x={356} y={300} vers={[326, 300]} />
      <Repere n={3} x={120} y={100} vers={[120, 124]} />
      <Repere n={4} x={240} y={262} vers={[288, 232]} />
    </Cadre>
  );
}

/* ─── Le registre ───────────────────────────────────────────────────────── */

type Repere = { titre: string; detail?: string };

type Planche = {
  Composant: () => ReactNode;
  /** `cote` : légende à droite du dessin (planches verticales) ; `dessous` : en dessous. */
  disposition: 'cote' | 'dessous';
  reperes: Repere[];
  legende: string;
};

/** Le registre : nom dans le markdown → planche, repères et légende. */
export const ILLUSTRATIONS: Record<string, Planche> = {
  'montage-deux-empiles': {
    Composant: MontageDeuxEmpiles,
    disposition: 'cote',
    reperes: [
      { titre: 'Arraché', detail: '60 à 70 centièmes, dix à quinze mètres : il encaisse le lancer.' },
      { titre: 'Émerillon à barillet', detail: 'il tourne, et la ligne ne vrille pas.' },
      { titre: 'Corps de ligne', detail: '50 centièmes, environ 1,20 m, avec deux boucles nouées.' },
      { titre: 'Première empile', detail: '30 à 50 cm, hameçon aberdeen n° 1, un ver enfilé.' },
      { titre: 'Seconde empile', detail: 'décalée sur l’autre côté : les deux ne s’emmêlent pas.' },
      { titre: 'Plomb grappin', detail: '100 à 150 g ; ses branches s’ancrent dans le sable et tiennent dans le courant.' },
    ],
    legende: 'Le montage à deux empiles, schématique et pas à l’échelle. C’est le montage du surfcasting par mer formée : il tient, il lance loin, et il présente deux appâts à deux hauteurs.',
  },
  'montage-coulissant': {
    Composant: MontageCoulissant,
    disposition: 'dessous',
    reperes: [
      { titre: 'Corps de ligne', detail: '30 centièmes, qui vient de la canne.' },
      { titre: 'Olive percée', detail: '60 à 100 g, libre sur la ligne : quand le poisson tire, la ligne file dans le plomb et il ne sent rien.' },
      { titre: 'Perle', detail: 'elle protège le nœud du plomb qui vient buter dessus.' },
      { titre: 'Émerillon', detail: 'il arrête le plomb et évite le vrillage.' },
      { titre: 'Empile', detail: '1 à 1,50 m de fil fin, 25 à 30 centièmes.' },
      { titre: 'Hameçon esché', detail: 'un ver, une lanière de seiche, une bouchée de moule.' },
    ],
    legende: 'Le montage coulissant : le plomb glisse sur la ligne, le poisson prend l’appât sans sentir le poids. C’est le montage de la sole et de la daurade méfiante, par mer plate.',
  },
  'montage-soutenir-roche': {
    Composant: MontageSoutenirRoche,
    disposition: 'cote',
    reperes: [
      { titre: 'Corps de ligne', detail: '40 centièmes, tenu tendu depuis la canne : on pêche « à soutenir ».' },
      { titre: 'Émerillon', detail: 'au-dessus de l’empile.' },
      { titre: 'Empile courte', detail: '40 à 60 cm, hameçon fort, à un mètre au-dessus du fond.' },
      { titre: 'Crabe mou', detail: 'ou une moule ficelée : ce que le sar et le loup trouvent dans la roche.' },
      { titre: 'Fil plus faible', detail: 'que le reste du montage, entre la ligne et le plomb.' },
      { titre: 'Plomb poire', detail: '60 à 100 g — ou un boulon, ou un galet ficelé : il va se coincer.' },
      { titre: 'La roche', detail: 'quand le plomb s’y coince, seul le fil faible casse : l’hameçon et le poisson restent.' },
    ],
    legende: 'Le montage à soutenir sur la roche : le plomb est attaché par un fil plus faible que le reste. Quand il se coince — et il se coince —, on ne perd que lui.',
  },
  'regle-des-douziemes': {
    Composant: RegleDesDouziemes,
    disposition: 'dessous',
    reperes: [
      { titre: 'Première heure', detail: 'un douzième seulement : l’eau semble ne pas bouger, et c’est un piège.' },
      { titre: 'Troisième et quatrième heures', detail: 'trois douzièmes chacune, la moitié du marnage : l’estran se couvre à vue d’œil.' },
      { titre: 'Sixième heure', detail: 'un douzième, puis l’étale de pleine mer.' },
    ],
    legende: 'La règle des douzièmes : la montée n’est pas régulière. Les deux heures centrales font la moitié du marnage — c’est là qu’on se fait surprendre sur un estran.',
  },
  'baine-montante-descendante': {
    Composant: BaineMontanteDescendante,
    disposition: 'dessous',
    reperes: [
      { titre: 'Le banc de sable', detail: 'la barre, où les vagues déferlent.' },
      { titre: 'Le bassin', detail: 'l’eau retenue derrière le banc, calme en apparence.' },
      { titre: 'La passe', detail: 'la brèche par laquelle le bassin se vide à la descendante.' },
      { titre: 'Le courant de sortie', detail: 'il file au large et entraîne tout ce que le bassin contenait ; le poisson chasse dedans.' },
      { titre: 'Le poste', detail: 'sur le sable, à côté de la passe, en lançant dans le courant.' },
      { titre: 'La zone à ne jamais traverser', detail: 'à la descendante, de l’eau au-dessus du genou près de la passe emporte un adulte.' },
    ],
    legende: 'Une baïne vue du ciel. À la descendante, le bassin se vide par la passe ; le courant de sortie concentre le poisson en aval — et emporte quiconque a de l’eau au-dessus du genou.',
  },
  'lire-une-plage': {
    Composant: LireUnePlage,
    disposition: 'dessous',
    reperes: [
      { titre: 'Le haut de plage', detail: 'd’où l’on regarde, à basse mer, ce que la mer va couvrir.' },
      { titre: 'La première barre', detail: 'émergée à basse mer ; à pleine mer, la houle y déferle.' },
      { titre: 'Le chenal', detail: 'entre la plage et la barre : une flaque à basse mer, un couloir de courant à pleine mer.' },
      { titre: 'La fosse', detail: 'derrière la barre : c’est ici que le poisson chasse.' },
      { titre: 'La seconde barre', detail: 'où la houle déferle à basse mer.' },
      { titre: 'Le niveau de pleine mer', detail: 'tout ce qui est sous ce trait sera sous l’eau.' },
      { titre: 'Le lancer', detail: 'dans la fosse, à vingt ou trente mètres — pas par-dessus.' },
    ],
    legende: 'Une plage de sable en coupe, à basse mer : barres, chenal, fosse. À pleine mer tout est sous l’eau et le poisson chasse dans la fosse, à vingt mètres — pas au large.',
  },
  'vent-de-mer-de-terre': {
    Composant: VentDeMerDeTerre,
    disposition: 'dessous',
    reperes: [
      { titre: 'Vent de mer', detail: 'il souffle du large vers la plage : il brasse le bord, trouble l’eau, et le score aime.' },
      { titre: 'Vent de terre', detail: 'il vient de derrière : mer plate, eau claire, lancer facile, mais le poisson est au large.' },
      { titre: 'Vent de travers', detail: 'il longe la côte et fait dériver la ligne : on lance en biais, contre lui.' },
      { titre: 'Le spot', detail: 'face au large ; le même vent change de sens avec l’orientation de la plage.' },
    ],
    legende: 'Le même vent n’a pas le même sens selon l’orientation du spot : de mer, il brasse le bord ; de terre, il aplatit ; de travers, il dérive la ligne.',
  },
  'montage-leurre': {
    Composant: MontageLeurre,
    disposition: 'dessous',
    reperes: [
      { titre: 'Tresse', detail: '12 à 15 centièmes : elle lance loin et transmet la moindre touche.' },
      { titre: 'Nœud de raccord', detail: 'FG ou Albright, conique pour passer dans les anneaux.' },
      { titre: 'Fluorocarbone', detail: '30 à 40 centièmes, un à deux mètres : invisible, et il résiste à la roche.' },
      { titre: 'Agrafe', detail: 'pour changer de leurre sans refaire le nœud.' },
      { titre: 'Tête plombée', detail: '7 à 14 g, avec l’hameçon qui ressort sur le dos.' },
      { titre: 'Leurre souple', detail: '10 à 12 cm, queue en palette : il nage bas et lentement, là où le bar chasse.' },
    ],
    legende: 'La ligne de lancer-ramener : tresse pour la distance et la sensibilité, fluorocarbone pour la discrétion et la roche, et un leurre souple qui nage bas.',
  },
};

export function Illustration({ nom }: { nom: string }) {
  const planche = ILLUSTRATIONS[nom];
  if (!planche) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[guides] illustration inconnue : ${nom}`);
    }
    return null;
  }
  const { Composant, disposition, reperes, legende } = planche;
  const cote = disposition === 'cote';
  return (
    <figure className="surface my-8 p-4 font-sans md:p-5">
      <div className={cote ? 'grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center' : ''}>
        <Composant />
        <ol className={`grid gap-x-6 gap-y-2 text-[14px] leading-snug text-fg ${cote ? 'mt-4 md:mt-0' : 'mt-5 sm:grid-cols-2'}`}>
          {reperes.map((repere, index) => (
            <li key={repere.titre} className="flex gap-2.5">
              <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-700 text-fg-on-accent nums">
                {index + 1}
              </span>
              <span>
                <span className="font-600">{repere.titre}</span>
                {repere.detail && <span className="text-fg-muted"> — {repere.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-4 border-t border-edge pt-3 text-meta text-fg-muted">{legende}</figcaption>
    </figure>
  );
}
