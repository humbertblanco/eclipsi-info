# Estat del projecte

Document de traspàs. Diu **on som, què s'ha comprovat, què queda obert i què
no s'ha de tornar a trencar**. Actualitzat l'1 d'agost de 2026.

---

## 1. Com es desplega

**EL DOMINI PRINCIPAL ÉS eclipsi.info** (vhost propi al mateix servidor,
subscripció `eclipsi.info` del client cosesdelhumbert, creat el 2-8-2026;
usuari de sistema `eclipsiinfo`). El build per defecte ja surt amb base `/` i
canònica `https://eclipsi.info/`:

```bash
npm run build                     # SI AIXÒ FALLA, PARA. Vegeu l'avís de sota.
rsync -az --delete dist/ root@server.estic.online:/var/www/vhosts/eclipsi.info/httpdocs/
ssh root@server.estic.online 'chown -R eclipsiinfo:psaserv /var/www/vhosts/eclipsi.info/httpdocs/'
```

Després **verifica per checksum**, no per vista:

```bash
BUNDLE=$(ls -t dist/assets/index-*.js | head -1 | xargs basename)
shasum -a 256 dist/assets/$BUNDLE
curl -s "https://eclipsi.info/assets/$BUNDLE" | shasum -a 256
```

El desplegament de LLEGAT al camí antic (lacuinade.estic.online/eclipsi/), si
mai cal refer-lo, necessita les dues variables:

```bash
ECLIPSI_BASE=/eclipsi/ ECLIPSI_SITE_URL=https://lacuinade.estic.online/eclipsi/ npm run build
rsync -az --delete dist/ root@server.estic.online:/var/www/vhosts/lacuinade.estic.online/httpdocs/eclipsi/
```

**AVÍS QUE JA HA COSTAT DUES VEGADES:** `npm run build` pot fallar per un error
de tipus i deixar el `dist/` anterior intacte. Si després corres el `rsync`, el
que puges és la versió vella i sembla que el desplegament ha anat bé. Encadena
les dues comandes amb `&&` o mira la sortida del build abans de pujar.

**El servidor és compartit.** `lacuinade.estic.online` allotja desenes de
vhosts. Toca NOMÉS `httpdocs/eclipsi/`. Res de reiniciar serveis, tocar
configuració global ni res que surti d'aquella carpeta.

### Saber quina versió corres

El peu de l'app diu la data i hora de compilació (`2026-08-01 16:42`). Amb el
service worker registrat, això no és una curiositat: és l'única manera de
distingir el que acabes de pujar del que el navegador et serveix de memòria.

---

## 2. On són les coses

`src/core` és el motor i **no depèn del DOM** — corre a Node i és on viu el
gruix de les proves. `src/features` són les vistes. `src/ui` és el sistema de
disseny. `src/screens` són les quatre pantalles.

| Carpeta | Què decideix |
|---|---|
| `core/astro` | Contactes, obscuració, incertesa del caire, gradient, moviment de l'ombra |
| `core/eclipses` | Elements besselians i trajectòria de la franja |
| `core/horizon` | Tessel·les de terreny i perfil d'horitzó de 360° |
| `core/visibility` | El veredicte: quants segons sobreviuen al relleu |
| `core/timer` | Compte enrere, veu i **comporta de seguretat ocular** |
| `core/places` | Topònims (Photon/OSM) |
| `core/spots` | Cercador de llocs millors a prop |
| `features/ar` | Càmera, fusió de sensors, **ancoratge al terreny** |
| `offline` | Service worker i precàrrega per anar sense cobertura |

---

## 3. Coses que no s'han de tornar a trencar

Cadascuna va costar trobar-la i cadascuna té un test que la vigila. Si un
d'aquests tests es posa vermell, **no el toquis: has trencat alguna cosa**.

1. **La comporta de seguretat ocular** (`core/timer/safety.ts`). Ha estat codi
   mort DUES vegades, cada cop una capa més enfora: primer perquè
   `ScheduleInput` no tenia el camp, després perquè `useEclipseTimer` muntava
   la llista a mà i s'oblidava de passar-l'hi. Qualsevol camí nou que parli de
   treure's el filtre ha de passar per `canRemoveFilter`. Tests:
   `core/timer/edge-gate.test.ts`, `features/countdown/timer-gate.test.ts`,
   `features/ar/naked-eye.test.ts`.
2. **El 99,7 % no és 100 %.** La regla viu a `core/astro/obscuration.ts` i s'ha
   escrit per separat a nou llocs diferents al llarg del projecte, mentint a
   set. Si necessites formatar una obscuració, importa-la.
3. **La franja ha de ser DIBUIXABLE, no només correcta.** La trajectòria del
   2026 passa pel pol i Web Mercator no ho pot projectar: el mapa sortia sense
   franja amb la geometria perfecta. Test: `core/eclipses/path.test.ts`.
4. **El mapa i la precàrrega han de demanar la mateixa URL de tessel·la.** Les
   memòries cau es claven a la URL sencera. Test:
   `offline/basemap-agreement.test.ts`.
5. **Un horitzó a mitges no es publica.** Amb una tessel·la de cent cinquanta,
   el perfil surt pla i optimista i l'app diu «102,1 s de 102,1» on la realitat
   és zero. El llindar és el 95 % a `core/horizon/raycast.ts`.
6. **El calibratge de la focal es reinicia en aplicar-se.** Si no, el guany es
   mesura contra una focal i s'aplica a una altra, i el camp de visió cau de 50°
   a 25° en tres segons — i es desa.

---

## 4. Què queda obert

Ordenat per gravetat. Tot això surt de sis revisions independents del codi i
**cada punt es va verificar corrent el codi**, no llegint-lo.

### Greu

- **Els dos motors d'ombra discrepen 2,9 km.** `core/eclipses/besselian.ts`
  fa servir un ΔT (71,4-71,9 s) que el mateix projecte declara incorrecte a
  `core/astro/deltaT.ts` (69,19-69,32 s segons l'IERS). La franja dibuixada al
  mapa és una translació de la que calcula el motor de punts: planta't al límit
  sud del mapa i el motor et dona 22 s de totalitat; al límit nord, cap. 0,41 km
  són el ΔT i ~2,5 km el residu entre `astronomy-engine` i DE441.
  `core/astro/uncertainty.ts:161` atribueix aquest residu al desplaçament per
  cota, i és fals: amb cota zero la discrepància hi és igual.
- **La `k` mitjana s'escola a tot el que no és un contacte.** `ephemeris.ts:112`
  construeix el radi lunar amb `MOON_RADIUS_RATIO_MEAN` mentre `kind` i les
  durades surten de la umbral. Els 0,77″ de diferència són 3,66 km: hi ha una
  franja d'aquest gruix a cada caire on l'app diu «parcial, 0 s» i «total,
  100,0 %» alhora.
- **El paquet fa 1,52 MB en un sol tros**, amb MapLibre (856 kB) i la vista de
  RA carregats a la primera pintada encara que visquin darrere de pestanyes.
  El dia de l'eclipsi, desenes de milers de persones en una cel·la saturada.
  `React.lazy` a les pantalles de mapa, cel i guia en treu ~900 kB.

### Mitjà

- **`verdict.summary` és català per construcció.** `buildSummary` a
  `core/visibility/verdict.ts` escriu la frase en català i prou, i la pinten
  tres pantalles: qui té l'app en castellà rep una frase catalana per pantalla.
  Arreglar-ho vol un paràmetre d'idioma a través de `computeVisibility`.
- **`formatDegrees` encara escriu el punt decimal** (`screens/format.ts`),
  mentre la resta ja escriu la coma. A la pantalla del compte enrere es veuen
  totes dues alhora.
- **La pantalla de la guia té vuit elements ambre**, no un. Arreglar-ho vol
  decidir el vocabulari de tons a `GuideView.tsx` i `content/guide.ts`, no
  només tocar la fulla d'estils.
- **Encara hi ha vores esquerres de color** a `features/weather/weather.css` i
  `features/spots/spots.css`, els dos components que no es munten enlloc.
- **El rellotge del dispositiu no es qüestiona mai.** `driftMs()` existeix i no
  el crida ningú. Amb el rellotge trenta segons endarrerit, els avisos de
  «posa't el filtre» sonen vint-i-cinc segons DESPRÉS de C3, amb el Sol ja
  tornat i l'ull adaptat a la foscor.
- **La guia i el guió de la totalitat es contradiuen en diverses xifres**: el
  rang d'altura del Sol (tres valors diferents per al mateix fet), «al
  capvespre» per a un eclipsi que és a les 9:45, i les xifres de lux del cas
  espanyol calculades amb fracció lluminosa però etiquetades com a obscuració.
- **`src/content/totality-script.ts`** (1.657 línies, ben fet i ben provat) **no
  el crida ningú.** El guió segon a segon de la totalitat no s'ha connectat mai.
- **El cercador de llocs** (`core/spots`, tot provat, amb el seu worker) tampoc
  és accessible des de la interfície.
- **`prepare.ts` / `storage.ts` / `store.ts` d'`offline` no tenen cap test**, i
  `store.ts` fa servir `${lat.toFixed(3)},${lon.toFixed(3)}` com a clau primària
  d'IndexedDB — el bug del `-0` que `core/places/cache.ts` ja va haver
  d'arreglar.
- **Cap component de React té cap test.** `vitest.config.ts` només inclou
  `*.test.ts` amb entorn `node`, i no hi ha ni un `*.test.tsx`.

### Baix

- `tsconfig.app.json` **no té `strict`**. `tsconfig.test.json` sí. Verificat:
  afegir-lo passa amb zero errors avui — és una barana que falta, no un deute.
- Els `.woff` (336 kB) es publiquen i no els demanarà mai cap navegador que
  pugui córrer aquesta app; els `.woff2` no estan subconjuntats.
- Diversos tests asserteixen damunt dels seus propis simulacres o dins de
  bucles que poden no córrer cap vegada (`geocoder.test.ts` sencer,
  `search.test.ts:328,338,356,411,468`, `schedule.test.ts:180-187`).
- `gate-invariant.test.ts` diu que envolta el llindar dels 20 s i el llindar ara
  són 40: la graella no en prova cap valor a la vora.

---

## 5. Decisions que s'han pres i per què

Perquè no es desfacin per accident.

- **Català per defecte**, castellà al selector de la capçalera. Res de detectar
  l'idioma del navegador: es va treure a posta.
- **L'altitud MAI del GPS.** L'error vertical d'un GPS de mòbil és de ±10 a
  ±30 m i trenta metres canvien el veredicte de si una muntanya et tapa el Sol.
  La posició horitzontal sí que és bona, i amb ella el model del terreny dona
  l'altitud molt millor que el propi GPS.
- **Un sol ambre per pantalla**, i és de la xifra que decideix. `--status-partial`
  és el mateix hexadecimal que `--accent`: fer-lo servir compta com un segon
  ambre.
- **No es demana res sense explicar-ho abans.** La ubicació té una pantalla
  d'introducció pròpia; la càmera no s'obre mai sola.
- **La càmera no es calibra tocant el Sol.** Ho feia i es va treure: demanava
  apuntar el dit a un Sol que encara no hi és, o mirar-lo per encertar-lo.
- **`src/core` no toca el DOM.** L'única excepció que queda és el
  `document.createElement('canvas')` de reserva a `horizon/elevation.ts`, que
  dins d'un Worker peta i es reporta com un problema de connexió.

---

## 6. La part de la càmera, que és la que costa

És el que l'usuari considera la funció diferencial. Tres capes que se sumen:

1. **Sensors** (`useDeviceOrientation` → `smoothing`): quaternions i filtre d'un
   euro amb terra de soroll. Sol, tremola 0,20° amb una brúixola normal. A iOS,
   el quaternió es construeix amb l'alpha RELATIVA més un offset de guinyada
   après del compass (`iosHeading`), pesat per la postura i congelat apuntant
   amunt: el compass ja no entra disfressat d'alpha, que era el que feia lliscar
   l'azimut en inclinar.
2. **Seguiment visual** (`visualTracker`): compara fotogrames. És RELATIU i
   necessita textura — apuntant a cel serè no en troba i retorna `null`. Graella
   de 3×5 (el costat llarg, el vertical en mà, té cinc files: el cel es menja
   les de dalt), pista de roll del sensor, comptador de fotogrames fosos,
   igualació d'exposició, i `pitchDegraded` quan el braç de palanca vertical
   col·lapsa — llavors la fusió fa recular NOMÉS l'altura cap al sensor.
3. **Ancoratge al terreny** (`skyline`): detecta la silueta de la muntanya i
   l'aparella amb la que el model del terreny diu que hi ha d'haver. És
   ABSOLUT: no deriva, i corregeix la brúixola de passada. Mesurat al banc,
   recupera un error de brúixola de 10° fins a menys de 0,5°. Endurit: la
   predicció per columna es llavora i comprova convergència (NaN si no), la
   silueta ha de cobrir el 35% de l'amplada, un horitzó pla dona un fix
   `altitudeOnly` (altura sí, azimut no — i no toca el biaix d'azimut), un fix
   que afirmi més de 3° d'error d'altura es descarta (l'acceleròmetre no pot
   anar tan errat: allò és una teulada), i corre a ~10 Hz.
4. **Àncora de Sol** (`sunAnchor`): la taca que satura el sensor contra les
   efemèrides DE L'INSTANT REAL (mai el del simulador). És el calibratge
   automàtic cap on apuntava la decisió del §5: no demana res a ningú. Detecta
   per components connexes del sostre del rang (autonormalitzat), poda per
   compacitat, rebutja fantasmes de lent per col·linearitat amb el centre
   òptic, refina el centroide a resolució plena (~0,05°), corregeix el
   centroide del CREIXENT durant la parcialitat (integració d'anells de
   `solarDisc`, validada contra 2D al banc) i s'apaga amb el flux a tocar de
   la totalitat. Portes: ±25° az, ±3° alt, mai sota la carena del model. De
   nit, la Lluna (assajos). Els fixos de Sol i terreny es FUSIONEN
   (`mergeAnchors`): fallen al revés l'un de l'altre, i als eclipsis d'aquest
   catàleg — Sol arran d'horitzó — el cas normal és tenir tots dos al quadre.

La FUSIÓ (`poseFusion`) té dues regles amb física pròpia:

- **El biaix és asimètric.** El d'azimut corregeix el magnetòmetre: fins a
  ±40°, no caduca mai, i s'aprèn de l'error del fix MESURAT A LA CAPTURA
  (`anchorBias`), que és independent de la postura i per això segueix
  aprenent a mig gest. El d'altura corregeix una referència, no el sensor
  (l'acceleròmetre va fi a dècimes): es capa a ±1,5° i caduca (τ 12 s) quan
  no hi ha terreny a la vista. Abans un skyline fals podia ensenyar 40° de
  biaix vertical per sempre — el «queda tort i no es recupera» del camp.
- **Quiet vol dir quiet.** Les correccions (estirada + àncora, com a suma) es
  retallen a 0,3°/s amb el mòbil parat: per sota del que l'ull distingeix
  d'estar clavat. El límit s'obre amb la velocitat, la seva cua (1,5 s) i
  l'excés de desalineació (>1° — l'arrencada amb la brúixola fora va igual de
  ràpida que sempre). El sostre dur de 8° queda fora del retall. I la
  discrepància imatge−sensor es limita a 1,5° per fotograma: cap
  correspondència falsa no es pot injectar sencera.

La tercera capa és la que fa que es quedi quiet, i és la que cap altra app pot
fer perquè cap altra té el perfil d'horitzó del punt de l'usuari. El banc
sintètic ara també sap fer obturador rodant (`renderFrameRS`), rampes
d'exposició i ancoratge dins de `runSequence`: el gest d'inclinar amb àncora
queda a ~1° pic a pic durant el gest i recollit a <0,3° als dos segons.

DUES MILLORES TRANSVERSALS DE TEMPS: cada fotograma de càmera es compara amb
la postura DE QUAN ES VA CAPTURAR (`poseHistory` + `frameCaptureMs` — exacte
amb `metadata.captureTime` a Chrome, estimat −50 ms a Safari; abans es colaven
40-80 ms de canonada sencers a totes les mesures), i la postura DIBUIXADA
s'empeny ~30 ms endavant amb el giroscopi cru (`motionPredict`,
`devicemotion.rotationRate`, costat de la multiplicació clavat al banc contra
Euler) — el retard percebut en moviment queda a ~zero.

LA SEGONA RONDA DE QUIETUD (després del primer camp): amb el cel ras i el
mòbil quiet, si el sensor no declara moviment (<5°/s) i cap àncora vigila,
NO s'integra res i es rebasa la referència — el soroll de brúixola ja no
passeja la postura; els residus de menys d'una dècima es tanquen a 0,05°/s
(rampa contínua de banda morta). El Sol es mesura ara A CADA FOTOGRAMA (el
camí complet amb totes les portes — l'adquisició ÉS el seguiment, sense
màquina d'estats que pugui seguir un núvol): l'àncora mai té més de 33 ms i
aguanta el gest fins a ~30-40°/s; la silueta es queda al tick i només vota
fresca (≤250 ms). Els blocs del seguidor són ADAPTATIUS (fins a 18, triats
per variància amb punt-més-llunyà; `pitchDegraded` amb l'abast vertical com
a únic àrbitre). I hi ha CAPTURA: composició vídeo+fosc de l'eclipsi
(ctx.filter, amb vel de recanvi a iOS<18)+overlay+peu → share natiu.

LA PANTALLA: `ARView` accepta `chrome/timeMs/onTimeChange/mode/onState`
(l'antic backlog AR_PROPS_NEEDED, saldat — un sol rellotge per pantalla), i
amb la càmera oberta l'app entra en MODE IMMERSIU (`.shell--immersive`:
barres a 0px amb unitat i tot el que en deriva segueix sol; sortida = botó de
tancar de la càmera, i qualsevol camí que la tanqui restaura les barres).
Píndola de lloc al HUD (cap xifra sense el seu lloc), wake lock amb càmera
oberta, fletxa de guia cap al Sol a la vora del marc, coach del vuit quan la
brúixola balla, pols de confirmació quan el Sol queda fixat i insígnia de qui
aguanta l'overlay. Els dos avisos de seguretat ocular, intactes i no
descartables.

**El que encara falta a la càmera**: no gestiona que el sistema li prengui la
càmera (una trucada, canviar d'app: es queda una fotografia congelada amb la
superposició lliscant-hi per sobre — el bucle sí que s'atura amb la pàgina
amagada); el bucle de dibuix corre encara que la càmera no estigui oberta; es
dibuixen 60 fotogrames per segon quan la càmera només en dona 30 (el cost del
cos surt ara al panell de diagnòstic, `ms de dibuix`); i l'offset d'iOS
congelat apuntant amunt deixa la deriva del giroscopi sense correcció si no hi
ha NI terreny a la vista NI estones per sota de 35° — acceptable per als
eclipsis del 2026/2028, que passen arran d'horitzó, però mesurable al camp
amb el panell (`heading` vs pitch) si mai cal el pes mínim residual.
