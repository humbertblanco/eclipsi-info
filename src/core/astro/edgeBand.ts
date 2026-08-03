/**
 * L'amplada de la zona on ningú honest no et pot dir sí o no.
 *
 * EL PROBLEMA. Tots els mapes d'eclipsi del món pinten el límit de la franja
 * com una ratlla d'un píxel. Aquella ratlla és una mentida de quilòmetres: la
 * sabem situar amb un error que a Espanya és de l'ordre de deu quilòmetres, i
 * qui es planta cinc quilòmetres a dins d'una ratlla d'un píxel es pensa que hi
 * és a dins quan la resposta honesta és «no ho sabem». `computeUncertainty` ja
 * calcula aquest número (`limitUncertaintyKm`) i la interfície ja el DIU amb
 * lletres; aquest mòdul és el que fa falta per DIBUIXAR-LO: quina semiamplada
 * ha de tenir la banda de dubte i com s'ha d'esvair.
 *
 * D'ON SURT LA SEMIAMPLADA. De `limitUncertaintyKm`, que és σ dividit pel
 * gradient del marge umbral al punt de l'usuari: els quilòmetres que t'has de
 * moure perquè el marge canviï una desviació típica. La banda va d'un σ endins
 * a un σ enfora del límit dibuixat, que és exactament el tram on la
 * probabilitat de fase central passa d'un 16 % a un 84 %.
 *
 * ELS 2,9 KM DELS DOS MOTORS SÓN UN TERRA, NO UN SUMAND. L'ESTAT §5 diu que la
 * franja dibuixada (elements besselians) i el motor de punts discrepen 2,9 km i
 * que la discrepància NO es toca, perquè unificar-la separaria el nostre dibuix
 * de les taules publicades de la NASA i de l'IGN. Aquells 2,9 km no se sumen a
 * σ perquè no en són independents: al gradient mesurat a la costa catalana
 * equivalen a uns 0,6 segons d'arc, o sigui una mostra de la MATEIXA
 * distribució d'error de 2″ que σ ja descriu. Però sí que són un terra: no
 * podem pintar mai una banda de dubte més estreta que la distància entre les
 * respostes dels nostres dos motors, perquè aquella distància ja l'hem
 * mesurada i no la sabem resoldre.
 *
 * I UN SOSTRE. El gradient es mesura EN UN PUNT i la banda es pinta al llarg de
 * tot el límit; a prop de les tangències dels extrems el gradient s'acosta a
 * zero i σ/gradient se'n va a centenars de quilòmetres o a infinit. Passat el
 * sostre, el que falla ja no és la ratlla sinó l'extrapolació: pintar-ho seria
 * inventar-se una precisió a l'inrevés.
 */

/**
 * Distància mesurada entre la franja que dibuixem i la que calcula el motor de
 * punts, en km. Vegeu ESTAT §5: 2,9 km, dels quals la ΔT n'explica 0,41.
 */
export const ENGINE_PATH_DISCREPANCY_KM = 2.9;

/** Sostre de la semiamplada dibuixable, en km. Vegeu la capçalera. */
export const MAX_EDGE_BAND_HALF_WIDTH_KM = 40;

/** Trams a cada banda del límit. Cinc ja no fan escala visible a la pantalla. */
export const EDGE_BAND_STEPS = 5;

/**
 * Semiamplada de la banda de dubte al voltant del límit dibuixat, en km.
 *
 * `limitUncertaintyKm` ve d'`EclipseUncertainty`. Amb un valor no finit —cap
 * punt encara, o gradient nul— es respon el sostre: allà on no sabem quant no
 * sabem, el dubte és tot el que en podem dir.
 */
export function edgeBandHalfWidthKm(limitUncertaintyKm: number | null | undefined): number {
  if (limitUncertaintyKm === null || limitUncertaintyKm === undefined) {
    return MAX_EDGE_BAND_HALF_WIDTH_KM;
  }
  if (!Number.isFinite(limitUncertaintyKm)) return MAX_EDGE_BAND_HALF_WIDTH_KM;

  const sigmaKm = Math.abs(limitUncertaintyKm);
  return Math.min(
    MAX_EDGE_BAND_HALF_WIDTH_KM,
    Math.max(ENGINE_PATH_DISCREPANCY_KM, sigmaKm),
  );
}

/** Un tram de la banda: de quina distància a quina, i amb quina opacitat. */
export interface EdgeBandStep {
  /** Distància al límit on comença el tram, en km. Negatiu = cap a un costat. */
  fromKm: number;
  /** Distància al límit on acaba el tram, en km. */
  toKm: number;
  /** Opacitat del tram, de 0 a `peakOpacity`. */
  opacity: number;
}

/**
 * Perfil del dubte a distància `u` del límit, amb `u` normalitzat a la
 * semiamplada (0 al límit, 1 a la vora de la banda).
 *
 * Cosinus alçat: val 1 al límit i s'esvaeix suaument fins a zero, sense cap
 * canvi brusc que es pugui llegir com una segona ratlla. Un perfil lineal
 * deixava una vora visible allà on la banda s'acaba, i aquella vora tornava a
 * dir «aquí hi ha un límit» — que és justament el que la capa desmenteix.
 */
export function edgeBandProfile(u: number): number {
  const x = Math.min(1, Math.max(0, Math.abs(u)));
  return 0.5 * (1 + Math.cos(Math.PI * x));
}

/**
 * Els trams de la banda, ordenats de fora endins i fins a fora altre cop: de
 * −semiamplada a +semiamplada, contigus i sense forats.
 *
 * L'opacitat de cada tram s'avalua al seu punt mitjà, que és el valor honest
 * per a una tira de color pla.
 */
export function edgeBandSteps(
  halfWidthKm: number,
  peakOpacity: number,
  steps: number = EDGE_BAND_STEPS,
): EdgeBandStep[] {
  const half = Math.abs(halfWidthKm);
  const n = Math.max(1, Math.round(steps));
  if (!Number.isFinite(half) || half <= 0) return [];

  const width = half / n;
  const out: EdgeBandStep[] = [];
  for (let i = -n; i < n; i++) {
    const fromKm = i * width;
    const toKm = (i + 1) * width;
    const mid = (fromKm + toKm) / 2;
    out.push({ fromKm, toKm, opacity: peakOpacity * edgeBandProfile(mid / half) });
  }
  return out;
}
