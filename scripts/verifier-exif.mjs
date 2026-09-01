/**
 * Vérification de bout en bout du retrait des métadonnées, dans un vrai
 * navigateur : on fabrique un JPEG PORTANT DES COORDONNÉES GPS, on le passe
 * dans la fonction réelle du site, et on inspecte les octets de sortie.
 */
/*
  Lancement :  node scripts/verifier-exif.mjs
  Il faut `playwright-core` et un Chromium ; définir CHROMIUM_PATH si le
  binaire n'est pas à l'emplacement par défaut.

  Ce script existe parce qu'une promesse de confidentialité ne se vérifie pas en
  relisant le code : il faut lui donner un fichier qui PORTE des coordonnées
  GPS et regarder ce qui ressort.
*/
import { build } from 'esbuild';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error(
    'playwright-core est absent. Installez-le (npm i -D playwright-core) ou lancez ce script\n' +
      'avec NODE_PATH pointant vers une installation existante.',
  );
  process.exit(2);
}

const CHROMIUM =
  process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const bundle = await build({
  entryPoints: ['src/lib/photo/strip-metadata.ts'],
  bundle: true, write: false, format: 'iife', globalName: 'Strip', target: 'es2022',
});
const code = bundle.outputFiles[0].text;

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: code });

const result = await page.evaluate(async () => {
  // 1. Une vraie photo : dégradé 2400×1800, encodé en JPEG par le navigateur.
  const source = document.createElement('canvas');
  source.width = 2400; source.height = 1800;
  const ctx = source.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 2400, 1800);
  gradient.addColorStop(0, '#1b4a5a'); gradient.addColorStop(1, '#d9c9a3');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2400, 1800);
  const plain = await new Promise((r) => source.toBlob(r, 'image/jpeg', 0.9));
  const plainBytes = new Uint8Array(await plain.arrayBuffer());

  // 2. On y INSÈRE un bloc EXIF avec une position GPS — 48,39 N / 4,49 O, la
  //    pointe de Bretagne. C'est exactement ce que produit un téléphone.
  function exifWithGps() {
    const tiff = [];
    const push16 = (v) => tiff.push((v >> 8) & 0xff, v & 0xff);
    const push32 = (v) => tiff.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    tiff.push(0x4d, 0x4d); push16(42); push32(8);       // en-tête TIFF gros-boutiste
    push16(1);                                           // une entrée
    push16(0x8825); push16(4); push32(1); push32(26);    // pointeur vers l'IFD GPS
    push32(0);
    push16(2);                                           // deux entrées GPS
    push16(1); push16(2); push32(2); tiff.push(0x4e, 0x00, 0x00, 0x00);   // GPSLatitudeRef = N
    push16(3); push16(2); push32(2); tiff.push(0x57, 0x00, 0x00, 0x00);   // GPSLongitudeRef = W
    push32(0);
    const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // « Exif\0\0 »
    return [...header, ...tiff];
  }

  const exif = exifWithGps();
  const length = exif.length + 2;
  const app1 = [0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...exif];
  const withExif = new Uint8Array([...plainBytes.slice(0, 2), ...app1, ...plainBytes.slice(2)]);

  const file = new File([withExif], 'prise.jpg', { type: 'image/jpeg' });
  const before = Strip.metadataMarkers(withExif);

  // 3. La fonction réelle du site.
  const cleaned = await Strip.stripMetadata(file);
  if (!cleaned.ok) return { error: cleaned.message };

  const outBytes = new Uint8Array(await cleaned.blob.arrayBuffer());

  // 4. Le motif « Exif\0\0 » subsiste-t-il quelque part dans le fichier ?
  const needle = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  let foundExifString = false;
  for (let i = 0; i + needle.length <= outBytes.length && !foundExifString; i++) {
    foundExifString = needle.every((b, k) => outBytes[i + k] === b);
  }

  return {
    before,
    after: Strip.metadataMarkers(outBytes),
    foundExifString,
    inputBytes: withExif.length,
    outputBytes: outBytes.length,
    width: cleaned.width,
    height: cleaned.height,
    type: cleaned.blob.type,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();

if (result.error) { console.error('ÉCHEC :', result.error); process.exit(1); }
const ok = result.before.includes('APP1') && result.after.length === 0 && !result.foundExifString && result.width === 1600;
console.log(ok ? '\n✓ EXIF présent à l’entrée, absent à la sortie, image réduite à 1600 px' : '\n✗ ÉCHEC');
process.exit(ok ? 0 : 1);
