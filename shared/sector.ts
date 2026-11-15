// Secteurs de navigation : la carte est découpée en carrés de 200 m.
// Colonnes numérotées d'ouest en est (1, 2, 3…), rangées lettrées du nord au sud (A…Z, AA, AB… comme un tableur).
export const SECTOR = 200;

export function rowLabel(i: number) {
  let s = '';
  let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export const colIndex = (x: number, half: number) => Math.floor((x + half) / SECTOR);
export const rowIndex = (z: number, half: number) => Math.floor((z + half) / SECTOR);

/** Ex. « 10 BG » : colonne puis rangée. */
export function sectorName(x: number, z: number, half: number) {
  return `${colIndex(x, half) + 1} ${rowLabel(rowIndex(z, half))}`;
}
