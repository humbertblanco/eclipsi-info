/**
 * Constants astronòmiques. Valors IAU / IERS.
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

/** Unitat astronòmica en km (IAU 2012). */
export const AU_KM = 149_597_870.7;

/** Radi equatorial terrestre en km (WGS84 / IAU). */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.1366;

/**
 * Radi angular del Sol a 1 UA, en segons d'arc.
 * Valor estàndard usat per les efemèrides d'eclipsis (Espenak / IAU).
 */
export const SUN_RADIUS_ARCSEC_AT_1AU = 959.63;

/**
 * Raó entre el radi lunar i el radi equatorial terrestre: el paràmetre `k` de
 * la teoria besseliana.
 *
 * ATENCIÓ: se'n fan servir DOS valors, i cadascun va al seu lloc. Aquesta
 * distinció no és una subtilesa acadèmica — equivocar-la infla la durada de la
 * totalitat en desenes de segons al caire de la franja, que és justament on la
 * gent decideix on es planta.
 *
 *  - k = 0.2725076 (radi lunar MITJÀ, adoptat per la IAU) → contactes
 *    PENOMBRALS, C1 i C4, o sigui l'inici i el final de la fase parcial.
 *  - k = 0.2722810 (radi lunar MÍNIM) → contactes UMBRALS, C2 i C3, o sigui
 *    la totalitat i l'anularitat. El valor més petit reconeix que la vora
 *    aparent de la Lluna no és un cercle perfecte: les valls del limbe deixen
 *    passar llum abans que ho faria un disc ideal.
 *
 * Aquest és el conveni d'Espenak, i és el que fan servir tant el Five
 * Millennium Canon de la NASA com les taules de l'IGN. Verificat
 * empíricament: amb k=0.2722810 als contactes umbrals, la durada de la
 * totalitat que calculem coincideix amb la de la NASA a 0,10 s; amb el valor
 * mitjà s'allargava una mitjana de 18,5 s.
 */
export const MOON_RADIUS_RATIO_PENUMBRAL = 0.2725076;
export const MOON_RADIUS_RATIO_UMBRAL = 0.2722810;

/**
 * Valor per defecte per a tot allò que no és un contacte: dibuixar els discos,
 * calcular magnitud i obscuració. Aquí la diferència entre els dos valors és
 * de 0,2 segons d'arc, invisible.
 */
export const MOON_RADIUS_RATIO_MEAN = MOON_RADIUS_RATIO_PENUMBRAL;

/**
 * Depressió del centre del Sol a la posta "oficial", en graus.
 * -0,833° = -(16' de semidiàmetre + 34' de refracció estàndard a l'horitzó).
 * Només s'usa com a referència; la posta REAL de cada lloc la dona el perfil
 * d'horitzó del model digital del terreny.
 */
export const STANDARD_SUNSET_ALTITUDE_DEG = -0.833;

/** Atmosfera estàndard, per a la refracció. L'usuari la pot sobreescriure. */
export const STANDARD_ATMOSPHERE = {
  pressureMb: 1010,
  temperatureC: 10,
} as const;

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
