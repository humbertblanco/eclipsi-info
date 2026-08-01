# Estat del projecte

Document de traspàs. Diu **on som, què s'ha comprovat, què queda obert i què
no s'ha de tornar a trencar**. Actualitzat l'1 d'agost de 2026.

---

## 1. Com es desplega

```bash
npm run build                     # SI AIXÒ FALLA, PARA. Vegeu l'avís de sota.
rsync -az --delete dist/ root@server.estic.online:/var/www/vhosts/lacuinade.estic.online/httpdocs/eclipsi/
```

Després **verifica per checksum**, no per vista:

```bash
BUNDLE=$(ls -t dist/assets/index-*.js | head -1 | xargs basename)
shasum -a 256 dist/assets/$BUNDLE
curl -s "https://lacuinade.estic.online/eclipsi/assets/$BUNDLE" | shasum -a 256
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
   euro amb terra de soroll. Sol, tremola 0,20° amb una brúixola normal.
2. **Seguiment visual** (`visualTracker`): compara fotogrames. És RELATIU i
   necessita textura — apuntant a cel serè no en troba i retorna `null`.
3. **Ancoratge al terreny** (`skyline`): detecta la silueta de la muntanya i
   l'aparella amb la que el model del terreny diu que hi ha d'haver. És
   ABSOLUT: no deriva, i corregeix la brúixola de passada. Mesurat al banc,
   recupera un error de brúixola de 10° fins a menys de 0,5°.

La tercera és la que fa que es quedi quiet, i és la que cap altra app pot fer
perquè cap altra té el perfil d'horitzó del punt de l'usuari.

**El que encara falta a la càmera**: no gestiona que l'app passi a segon pla ni
que el sistema li prengui la càmera (una trucada, canviar d'app: es queda una
fotografia congelada amb la superposició lliscant-hi per sobre); el bucle de
dibuix corre encara que la càmera no estigui oberta; i es dibuixen 60 fotogrames
per segon quan la càmera només en dona 30.
