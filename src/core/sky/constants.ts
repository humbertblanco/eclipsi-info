/**
 * Constants fotomètriques del model de llum.
 *
 * Cada xifra porta la seva font. Si algun dia un número d'aquest fitxer es
 * mou, ha de ser perquè s'ha trobat una mesura millor, no perquè el render
 * quedava més bonic: tot el mòdul existeix precisament per no tornar a tenir
 * corbes inventades a ull.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en
 * Node.
 *
 * FONTS
 *  [1] Kopp, G. & Lean, J. (2011), "A new, lower value of total solar
 *      irradiance", Geophys. Res. Lett. 38, L01706 → 1361 W/m².
 *  [2] Eficàcia lluminosa de l'espectre solar extraterrestre ponderat per
 *      V(λ): ~98 lm/W (valor estàndard en il·luminació natural; ISO 15469 /
 *      CIE S 011 i els manuals de daylighting el fan servir per obtenir la
 *      "constant solar lluminosa" de ~133 klx).
 *  [3] Kasten, F. & Young, A. T. (1989), "Revised optical air mass tables and
 *      approximation formula", Applied Optics 28, 4735-4738.
 *  [4] Taula canònica d'il·luminàncies (llum de dia, posta, crepuscles, lluna
 *      plena, nit) reproduïda a l'IESNA Lighting Handbook i popularitzada per
 *      P. Schlyter, "Radiometry and photometry in astronomy", que al seu torn
 *      cita Allen, "Astrophysical Quantities".
 *  [5] Möllmann, K.-P. & Vollmer, M. (2006), "Measurements and predictions of
 *      the illuminance during a solar eclipse", Eur. J. Phys. 27, 1299-1314.
 *      D'aquí ve la idea central del mòdul: la il·luminància NO és
 *      proporcional a l'àrea descoberta, perquè el limbe solar és més fosc que
 *      el centre.
 *  [6] Krisciunas, K. & Schaefer, B. E. (1991), "A model of the brightness of
 *      moonlight", PASP 103, 1033 → la lluna plena al zenit dona ~0,25 lux.
 *  [7] Cox, A. N. (ed.), "Allen's Astrophysical Quantities", 4a ed. →
 *      coeficient d'enfosquiment del limbe i brillantor integrada de la corona.
 *  [8] CIE 191:2010, "Recommended System for Mesopic Photometry" → límits del
 *      règim mesòpic.
 *  [9] De Groot, S. G. & Gebhard, J. W. (1952), "Pupil size as determined by
 *      adapting luminance", J. Opt. Soc. Am. 42, 492-495.
 * [10] Hecht, S. & Shlaer, S. (1937), "An adaptometer for measuring human dark
 *      adaptation", J. Opt. Soc. Am. 28, 269 → les dues branques (cons i
 *      bastons) de l'adaptació a la foscor i les seves constants de temps.
 */

/** Irradiància solar total a 1 UA, en W/m². Font [1]. */
export const SOLAR_CONSTANT_W_M2 = 1361;

/** Eficàcia lluminosa de l'espectre solar fora de l'atmosfera, en lm/W. Font [2]. */
export const SOLAR_LUMINOUS_EFFICACY_LM_W = 97.8;

/**
 * Il·luminància solar a incidència normal FORA de l'atmosfera, en lux.
 * 1361 W/m² × 97,8 lm/W ≈ 133.100 lx. És el punt de partida de tot el model.
 */
export const EXTRATERRESTRIAL_ILLUMINANCE_LUX =
  SOLAR_CONSTANT_W_M2 * SOLAR_LUMINOUS_EFFICACY_LM_W;

/**
 * Gruix òptic de l'atmosfera per al feix directe, ponderat per V(λ), a nivell
 * del mar i amb aire net. El desglossem perquè només la part de Rayleigh
 * escala amb la pressió.
 *
 * Rayleigh: τ(550 nm) = 0,094; ponderat per la banda fotòpica (que s'estén de
 * 450 a 650 nm, on τ va de 0,21 a 0,05) surt ~0,10.
 * Aerosols: Ångström amb β ≈ 0,08 i α ≈ 1,3 → ~0,12 a 550 nm. És el terme més
 * variable de tots: en un dia de calitja pot triplicar-se.
 * Ozó: banda de Chappuis al visible → ~0,03.
 * Vapor d'aigua i altres: ~0,01 dins de la banda fotòpica.
 *
 * Suma: 0,26. Amb aquest valor el feix directe al zenit dona ~102.600 lx, que
 * és la xifra clàssica de "llum solar directa ≈ 100.000 lux" de la font [4].
 */
export const TAU_RAYLEIGH = 0.10;
export const TAU_AEROSOL = 0.12;
export const TAU_OZONE = 0.03;
export const TAU_OTHER = 0.01;

/** Pressió de referència del gruix òptic, en mb (la de `STANDARD_ATMOSPHERE`). */
export const REFERENCE_PRESSURE_MB = 1010;

/**
 * Exponent de correcció de Forbes.
 *
 * L'extinció NO és grisa: l'atmosfera es menja el blau molt més que el vermell,
 * de manera que la llum que sobreviu a masses d'aire grans ja és llum poc
 * extingible i el coeficient d'extinció EFECTIU baixa. Aplicar Beer-Lambert
 * amb un coeficient constant donaria 2 lux de Sol directe a l'horitzó, quan la
 * realitat és unes centes de lux.
 *
 * Ho absorbim amb un gruix òptic Θ(m) = τ₀·m^0,80 en comptes de τ₀·m. El 0,80
 * està calibrat perquè el feix directe a l'horitzó valgui ~0,5% del que val al
 * zenit, que és el que donen les mesures de luminància del disc solar a la
 * posta (~6·10⁶ cd/m² contra ~1,6·10⁹ cd/m²).
 *
 * LÍMIT DEL MODEL: és una correcció global d'un sol paràmetre per a un efecte
 * que de debò és espectral. Serveix per a la il·luminància total; no serveix
 * per calcular colors de manera quantitativa.
 */
export const FORBES_EXPONENT = 0.80;

/**
 * Coeficient d'enfosquiment del limbe, llei lineal I(μ)/I(0) = 1 − u(1 − μ).
 *
 * u = 0,6 és el valor de manual per a la banda visual (~550 nm): el limbe
 * brilla el 40% del que brilla el centre del disc. Font [7].
 *
 * Conseqüència pràctica, i és el cor de tot el mòdul: amb el 95% de l'ÀREA
 * tapada no queda el 5% de la llum, sinó un ~3%, perquè el que queda és
 * justament la vora fosca.
 */
export const LIMB_DARKENING_U = 0.6;

/**
 * Flux lluminós de la corona relatiu al de la fotosfera.
 *
 * La corona K+F integrada fins a uns quants radis solars val ~10⁻⁶ de la
 * fotosfera (font [7]). Traduït: uns 0,1 lux amb el Sol alt, o sigui MIG
 * plenilluni. D'aquí ve la frase clàssica que la corona té la brillantor de la
 * lluna plena.
 *
 * Varia amb el cicle solar (mínim ~0,7, màxim ~1,4 vegades aquest valor): és
 * el que controla `coronaFactor`.
 */
export const CORONA_FLUX_RATIO = 1e-6;

/**
 * Fracció de la llum ambiental que s'escola DINS de l'ombra des de fora.
 *
 * Aquest és el terme que fa que la totalitat siguin lux i no micro-lux. Dins
 * de l'ombra el feix directe val zero, però el cel que tens sobre el cap
 * continua rebent llum de l'atmosfera il·luminada de fora del con d'ombra, a
 * centenars de quilòmetres. Sense aquest terme el model donaria una totalitat
 * mil vegades més fosca que la realitat.
 *
 * 6·10⁻⁵ de la il·luminància sense eclipsi reprodueix els 5-7 lux mesurats en
 * totalitats amb el Sol alt (font [5] i mesures publicades del 2017).
 *
 * LÍMIT DEL MODEL: aquest número depèn de l'amplada de l'ombra, de la
 * transparència del dia i de la posició dins de la franja, i les mesures
 * publicades s'escampen entre 1 i 30 lux. Considera'l bo a un factor 3.
 */
export const UMBRAL_LEAKAGE_FRACTION = 6e-5;

/**
 * Amplificació de la fuita amb el Sol baix.
 *
 * Amb el Sol arran d'horitzó el con d'ombra travessa l'atmosfera molt inclinat:
 * la columna d'aire que tens damunt surt de l'ombra a poca altura i, per tant,
 * està il·luminada. La fuita relativa creix. És un argument geomètric de primer
 * ordre, no una mesura.
 */
export const LOW_SUN_LEAKAGE_BOOST = 1.5;

/**
 * Il·luminància horitzontal de la lluna plena al zenit, en lux. Font [6].
 *
 * És la unitat de comparació que fa entendre l'eclipsi: amb el 95% del Sol
 * tapat encara tens milers de plenillunis damunt.
 */
export const FULL_MOON_LUX = 0.25;

/**
 * Il·luminància del cel nocturn sense lluna (estrelles + airglow), en lux.
 * Font [4]. És el terra per sota del qual el model no baixa mai.
 */
export const NIGHT_SKY_LUX = 0.002;

/**
 * Il·luminància de referència d'un dia clar amb el Sol alt, en lux.
 * S'usa com a ancoratge del model d'adaptació de l'ull.
 */
export const REFERENCE_DAYLIGHT_LUX = 100_000;

/**
 * Albedo mitjà d'un paisatge, per passar d'il·luminància a luminància.
 * 0,18 és el gris mitjà fotogràfic; L = ρ·E/π.
 */
export const DEFAULT_GROUND_ALBEDO = 0.18;

/** Límits del règim mesòpic en cd/m². Font [8]. */
export const MESOPIC_LOWER_CD_M2 = 0.005;
export const MESOPIC_UPPER_CD_M2 = 5;
