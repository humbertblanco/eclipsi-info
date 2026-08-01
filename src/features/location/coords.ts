/**
 * Entendre unes coordenades escrites a mà.
 *
 * PER QUÈ CAL. Sense xarxa no hi ha noms de lloc, i llavors l'única manera
 * d'arribar a un punt concret que no sigui on ets ara és el mapa. El mapa
 * funciona, però a 390 px trobar-hi un punt exacte és imprecís i, sobretot, la
 * gent que planifica arriba amb unes coordenades COPIADES d'un altre lloc —del
 * Google Maps, d'un fil, d'un missatge. Aquest camp és per enganxar-les.
 *
 * QUÈ ACCEPTA, i el primer és el més important:
 *
 *   41.3851° N, 2.1734° E      ← el format que la mateixa app ensenya
 *   41.3851, 2.1734
 *   41.3851 2.1734
 *   41,3851, 2,1734            ← decimals amb coma, com s'escriu aquí
 *   -33.8688, 151.2093
 *
 * L'AMBIGÜITAT DE LA COMA es resol amb una regla i no amb màgia: amb UNA sola
 * coma, la coma separa; amb més d'una, les que van enganxades a un dígit són
 * decimals i la que porta espai al darrere separa. «41,3851,2,1734», sense cap
 * espai, no el sap desfer ningú —ni una persona— i es rebutja.
 */

/** Un punt entès. L'altitud no hi és: la resol el model del terreny. */
export interface ParsedCoords {
  lat: number;
  lon: number;
}

/** Signe segons el punt cardinal. `O` és «oest» en català i castellà. */
function cardinalSign(letter: string): number {
  return letter === 'S' || letter === 'W' || letter === 'O' ? -1 : 1;
}

export function parseCoords(input: string): ParsedCoords | null {
  const raw = input.trim();
  if (raw === '') return null;

  // Els punts cardinals es guarden i es treuen: després només han de quedar
  // números, un separador i signes.
  const cardinals = raw.toUpperCase().match(/[NSEWO](?![A-Z])/g) ?? [];
  let text = raw.toUpperCase().replace(/[NSEWO](?![A-Z])/g, ' ');

  // Graus, minuts i segons no s'accepten: barrejar-los amb decimals fa que
  // «41° 23' 6"» i «41.23» semblin la mateixa cosa i no ho són.
  if (/['"′″]/.test(text)) return null;

  text = text.replace(/[°º]/g, ' ');

  const commas = (text.match(/,/g) ?? []).length;
  if (commas === 1) {
    text = text.replace(',', ' ');
  } else if (commas > 1) {
    // Coma enganxada a un dígit → decimal. La resta, separador.
    text = text.replace(/,(?=\d)/g, '.').replace(/,/g, ' ');
    if ((text.match(/\./g) ?? []).length > 2) return null;
  }

  const numbers = text.match(/-?\d+(?:\.\d+)?/g);
  if (numbers === null || numbers.length !== 2) return null;

  let lat = Number(numbers[0]);
  let lon = Number(numbers[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Els cardinals manen sobre el signe escrit: «41 N» i «41» són el mateix, i
  // «41 S» és −41 encara que el número no porti menys.
  if (cardinals.length === 2) {
    const ns = cardinals[0] === 'N' || cardinals[0] === 'S' ? cardinals[0] : cardinals[1];
    const ew = cardinals[0] === 'N' || cardinals[0] === 'S' ? cardinals[1] : cardinals[0];
    if (ns === undefined || ew === undefined) return null;
    lat = Math.abs(lat) * cardinalSign(ns);
    lon = Math.abs(lon) * cardinalSign(ew);
  } else if (cardinals.length !== 0) {
    // Un sol cardinal és una coordenada a mitges. No s'endevina.
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
