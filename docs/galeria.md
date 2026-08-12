# La galeria de fotos geolocalitzades

Document de decisió. El que hi ha escrit és el que s'ha de fer; no hi ha
opcions. Mana `ESTAT.md` i, per damunt d'aquest fitxer, també `CLAUDE.md`.

Els números d'aquest document estan mesurats contra el codi el 12-8-2026. Quan
un comentari del repositori en diu un altre, aquí hi ha el mesurat i s'hi diu
quin comentari ha quedat vell.

---

## 1. Què és, i què no és

1. És **la primera peça d'aquesta app que la realitat pot desmentir**: una foto
   feta des d'un punt, mirant cap on el motor diu que hi haurà el Sol.
2. Hi ha **dues menes i no es barregen mai**: `kind: 'place'` (com és l'horitzó
   d'allà) i `kind: 'totality'` (què s'hi va veure). Els codis són del nucli; les
   paraules, de la vista (regla 6).
3. La de LLOC serveix per **decidir**: és la prova humana del perfil de terreny
   que dona la xifra.
4. La d'ECLIPSI serveix per **tancar**: és l'arxiu del que va passar.
5. **No és** xarxa social, ni àlbum personal, ni rànquing, ni directe. Cap foto
   no ordena res: la xifra segueix decidint sola.

---

## 2. La pantalla

**Destí de ruta propi, sense ranura de pestanya**, exactament com `'about'` a
`src/App.tsx:117`. Codi nou: `src/core/photos/` (pur, corre a Node: filtre,
criteri de proximitat, inferència de mena) i `src/features/gallery/` (vista),
amb `src/screens/GalleryScreen.tsx` sota `React.lazy`.

### Mana la graella. El mapa de la galeria no existeix

Qui obre la galeria ja té un mapa: `MapScreen`. Una segona superfície de mapa és
el que `CLAUDE.md` prohibeix al plafó de capes — *«tenir-ne dos comandaments és
demanar que un dia discrepin»*: acabaria amb dues càmeres, dos estats de
selecció i dues idees de què vol dir «aquí».

Al mòbil la primera pantalla és **una foto gran** (lloc, topònim, segons) i
després 2 columnes. Sis quadrats petits són un catàleg, no una galeria.

El pont entre vistes és geogràfic i explícit, no una pestanya:

- Xip d'àmbit a dalt amb `Tag`: `A prop teu · A la franja · Tot`. **`A prop teu`
  no és el valor per defecte si no hi ha ubicació concedida** (regla 4), i mai
  demana el GPS des d'aquí.
- **Galeria → mapa**: «Veure-ho al mapa» navega a `MapScreen` amb el punt
  seleccionat. Una sola càmera a tota l'app.
- **Mapa → galeria**: des de `SpotCard`, «Fotos (7)» obre la graella filtrada.
  En tornar, `EclipseMap` conserva la càmera als seus refs: no es reenquadra res.

### Les dues menes es distingeixen per forma, no per filtre

- **LLOC** → tira panoràmica **16:9** amb desplaçament horitzontal. Un horitzó és
  ample; retallar-lo a quadrat destrueix la dada (què tapa el terreny).
- **ECLIPSI** → graella **3:4**, fons fosc, corona centrada.

Relació d'aspecte i direcció de desplaçament es llegeixen abans que cap
etiqueta. A sobre, `Badge tone="neutral" icon="map-pin"` i
`Badge tone="info" icon="sun"` (`src/ui/core/Badge.tsx`). **`Badge tone="partial"`
queda prohibit**: `statusPartial` és `#FFA51F`, el **mateix hexadecimal** que
`--accent` (`src/styles/palette.ts:91` i `:99`). Seria un segon ambre per la
porta del darrere. `danger` tampoc: és seguretat ocular.

**`Tag` no serveix per triar la mena**: és un `<button aria-pressed>` de filtre
multiselecció i permet l'estat «cap dels dos», que aquí no vol dir res.
**`Tabs` tampoc**: la seva capçalera diu que navega DINS d'una pantalla. Quan cal
triar, `src/ui/forms/SegmentedControl.tsx` amb `fullWidth` i **sense `wrap`**
(dues opcions caben sempre), amb el recompte dins de l'etiqueta:

```
El lloc · 12   |   Amb l'eclipsi · 4
```

El recompte fa honest el buit: veus que un mirador no té cap foto d'eclipsi
**abans** de tocar-hi.

### Al mapa no hi ha res nou. Ni capa, ni to, ni pestanya

Les fotos pengen dels punts que ja hi ha. **No hi ha cap senyal de «aquí hi ha
fotos» sobre el disc**, i el motiu és mesurat: a `src/features/map/layers/pois.ts`
els tres canals del punt ja estan ocupats — l'halo (250-252) diu
`precision: 'estimated'`, el disc (277) ja és `statusInfo` ple, i la vora (311)
és la separació del fons. No queda cap canal lliure sense inventar un quart
significat sobre el mateix cercle. Qui hi ha de saber que hi ha fotos ho llegeix
a la fitxa, amb lletres.

**Una xinxeta és un LLOC, mai una foto.** Cent fotos del mateix mirador com a
cent features són cent punts a la mateixa coordenada: `getClusterExpansionZoom`
retorna el zoom màxim, l'`easeTo` de `viewpoints.ts:400-412` t'hi porta i **el
grup segueix sent-hi**. Grup infinit. S'agrupa per lloc (`pointId` o coordenada
arrodonida) abans d'arribar a MapLibre. **Tocar un grup fa zoom**, com els
miradors: un grup no és un contenidor de contingut, és «aquí n'hi ha». Sense
números dins del cercle — l'estil base no declara `glyphs` (`pois.ts`, decisió 4):
un `text-field` no pintaria res i ompliria la consola.

### L'estat buit és un encàrrec, no un forat

Mai «encara no hi ha fotos». Dues caselles, sempre presents (també amb la
galeria plena, on fan de botó de pujada):

1. **«El lloc»** — dins del marc, la **silueta de l'horitzó de 360° que ja
   calculem** (`src/core/horizon/profile.ts`), traçada en `--text-muted` sobre
   `--bg-inset`. Peu: *«Aquesta silueta l'hem calculada del terreny. Falta la
   foto que la confirmi.»* La casella no és un buit: és la peça que falta d'una
   comparació.
2. **«El lloc amb l'eclipsi»** — tancada, amb el compte enrere viu fins al
   12-8-2026, i ho diu. Una casella que s'obre sola crea espera; una que ja hi és
   buida crea culpa.

A sota, el comptador honest: **«0 publicades · 0 en revisió»**. El zero s'escriu,
no s'amaga (regla 2). **No es sembra amb estoc**: les imatges d'Unsplash de
`brand-photography.card.html` són referència de marca. Una foto genèrica en una
galeria geolocalitzada és una mentida sobre un lloc — el mateix error que
«Galícia».

### El vel

Foto a sang, `object-fit: cover`, i el text només sobre un degradat inferior:
`linear-gradient(180deg, transparent 0 55%, var(--bg-scrim) 100%)`. Tapa el terç
de baix i no toca el cel. `--bg-scrim` pla i sencer **només** quan la foto fa de
fons d'un plafó, mai quan la foto és el contingut. Res de filtres, res de duoto,
**cap tint càlid**.

### Components, pel seu nom

`TopBar`/`BackTopBar`, `SegmentedControl`, `Tag`, `Badge`, `Button`,
`IconButton`, `Card` (`tone="inset"` per a les caselles buides, cap `glass` nou),
`Stat` per als segons del visor, `Dialog` per al visor, `Checkbox` al
consentiment, `Toast` per a la confirmació, `ErrorBoundary` al voltant de tot el
que carrega imatges. Icones del vocabulari de `src/ui/core/Icon.tsx`: `map-pin`,
`sun`, `camera`, `aperture`, `upload` (**`mountain` no existeix**). Mides amb
`ICON_SM`/`ICON_MD`/`ICON_LG` de `src/ui/sizes.ts`. Colors només per
`readPalette()` i `withAlpha()`.

---

## 3. El moment de pujar

### La foto AMB L'ECLIPSI: `phase === 'after'`

**No es demana durant l'eclipsi. Es demana quan la portada es queda sense feina.**
`resolveCountdown()` retorna `{ phase: 'after', remainingMs: 0, label: LABELS.done }`
a `src/core/timer/countdown.ts:85`. A partir d'aquell instant la portada no
respon cap pregunta: el compte enrere és mort, el veredicte és història, i el
`cameraCta` convida a apuntar el mòbil a un Sol sencer.

Punt exacte: `src/screens/CountdownScreen.tsx`, **entre la línia 394 (`</section>`
del `home__hero`) i la 398 (`{!desktop && cameraCta}`)**, amb el CTA de càmera
**substituït**, no acompanyat.

**No passis `phase` amunt des de `HeroCountdown`**: la seva capçalera existeix
precisament perquè un tic per segon no repinti `SimulationView`, `MiniMap` ni
`EclipseFingerprint`. Component **fulla** nou,
`src/features/gallery/PostEclipseInvite.tsx`, que es subscriu ell mateix a
`useNow()` (`src/state/useNow.ts:47`), crida `resolveCountdown()` i **retorna
`null` fins que `phase === 'after'`**.

**No hi posis un tercer botó.** `captureView()` (`src/screens/SkyScreen.tsx:153`)
ja compon el JPEG amb `captureCaption` i el passa a `shareFileOrDownload()`.
Guarda el blob a una cua local (IndexedDB) dins de `captureView()`, just després
d'aquell `await`, i que la invitació digui «tens 3 fotos d'avui». El consentiment
es demana **després**, en fred, amb la foto ja a la mà.

### La foto del LLOC: quan el terreny acaba de robar

No va a l'`after`: el 12-8-2026 a les 21.30 ja no serveix per decidir on
plantar-se. El seu moment és `terrainRobsCentral`
(`src/screens/CountdownScreen.tsx:294-297`), **just sota el botó `home.findSpot`
(línies 431-435)**: allà l'usuari acaba de descobrir que l'horitzó importa.
Segona porta: la fitxa d'un lloc del cercador.

### Dues portes, i una frase

- **L'entrada són dos `Button`**, no un: `icon="map-pin"` «Foto del mirador» i
  `icon="sun"` «Foto de l'eclipsi». Qui tria la porta ja ha contestat. **Res de
  desplegable «Tipus de foto».**
- **Des de la galeria de la càmera**, on no hi ha porta: llegeix l'instant EXIF,
  compara'l amb la finestra C1–C4 que menja `resolveCountdown()` i **ensenya la
  conclusió amb l'excusa**, no un camp:
  > *Aquesta va a **Amb l'eclipsi**: és de les 20.31, dins la totalitat.* · Canvia

  «Canvia» obre el **mateix `SegmentedControl`** de la galeria.
- **El consentiment és pantalla pròpia abans d'obrir el selector**, amb
  `Checkbox` i la promesa escrita, com fa `src/features/consent/` (regla 4: la
  càmera no s'obre mai sola). Hi diu què viatja, què no, la mida del fitxer i que
  la revisió és a mà.
- **L'EXIF amb GPS es treu al client**, reescrivint la imatge per canvas abans
  que el fitxer surti de l'aparell, i es diu **amb quina precisió** es publicarà
  el punt. Sense això la promesa de `SiteFooter` queda desmentida per la funció
  nova.
- **Cap punt d'escriptura al servidor.** El vhost viu en una màquina compartida
  amb desenes de vhosts de tercers i historial de compromís. La publicació és una
  passa de construcció, com tots els catàlegs d'aquesta app, i **es verifica per
  checksum DESPRÉS del `rsync`**: demanar la URL d'una foto que encara no hi és
  la deixa 404 quatre hores a Cloudflare.

---

## 4. La fitxa del lloc: quin criteri de proximitat

**Una foto és d'aquest punt si l'autor ho ha dit o si la geometria ho pot
sostenir. Mai per radi sol.**

**1. Punts amb `precision: 'estimated'`: cap radi.** Mesurat avui a
`src/data/observation-points/2026-08-12.json`: **280 punts, 172 exactes i 108
estimats**. (La capçalera de `catalog.ts:38` encara diu «274 punts, 162 exactes i
112 estimats» i `pois.ts:25` diu «222 punts, 60»: tots dos comentaris són vells.
No els copiïs; corregeix-los el dia que toquis el fitxer.) La regla 2 de
`catalog.ts` diu que aquella coordenada pot ballar «un quilòmetre llarg» —la
vintena de Navarra, un quilòmetre i mig de mitjana. Un radi hi enganxaria fotos
d'un altre poble en silenci. Per a aquests, `pointId` **triat per qui la puja**
d'una llista curta dels punts propers. Amb `precision: 'exact'`, radi sí.

**2. Dos radis, perquè hi ha dues menes de foto.**

- **LLOC (horitzó): 300 m.** El que la fitxa promet és `clearanceDeg`, i
  `src/core/spots/alignment.ts` el calcula amb camp proper (`nearFieldM`,
  línia 573) i pas de desenes de metres: a 300 m d'una carena a 3 km el marge ja
  no és el mateix número. També és una distància que es camina i que qui puja la
  foto pot jutjar a ull.
- **ECLIPSI: 2 km.** És `DEFAULT_SPACING_KM` (`src/core/spots/search.ts:163`): la
  distància a la qual el nostre propi motor considera que ja és un altre lloc. La
  corona no canvia en 2 km; el primer pla sí, i per això no s'estira més.

**3. El rumb, i només per a les fotos d'horitzó: ±30° de `sunAzimuthDeg`** del
punt (ja és a la fitxa, `SpotCard.tsx` al `dl` de metadades). Un objectiu de
mòbil fa uns 65° horitzontals: dins de ±30° l'azimut del Sol cau dins de
l'enquadrament amb marge per a l'error de brúixola. Fora d'això la foto mira cap
a un altre cantó.

**Dues regles d'honestedat:** un rumb desconegut **no s'inventa mai** (la foto
surt, però sense l'etiqueta «aquest és l'horitzó del punt»), i el criteri **no
amaga cap foto**: només decideix quina ocupa la ranura d'horitzó. **Els segons
d'una foto els calcula el nostre motor** des de la seva coordenada, mai qui la
va enviar. **Si una foto contradiu el motor no s'amaga**: es publica i la
discrepància va a `ESTAT.md` amb la mesura.

**On hi cap:**

- **`MapScreen.tsx`**: **no** dins de `PlaceCard` (1407+). `PlaceCard` va damunt
  del trio i el primer cop d'ull ha de ser distintiu + tres xifres + línia de
  temps. La tira va **després** de `mapscreen__timeline` (línia 924), dins de la
  vista `spots`, com un `mapscreen__block` propi amb `screen__overline` («Com és
  el lloc»), `overflow-x: auto` amb scroll-snap i miniatures de ~88 px.
- **`SpotCard.tsx`**: **just sota `spotcard__blocking` (línia 277)** i abans del
  bloc `spotcard__gain` (279+). La frase de bloqueig és l'afirmació («una carena
  a 3 km et menja 2°») i la foto n'és la prova: van enganxades. Queda per sota de
  `spotcard__figures` (262-275): la xifra gran no es mou. Dues miniatures 16:9 i
  «+N».
- **Les fotos no entren a `src/data/observation-points/*.json`** (regla 1: allà
  no hi ha res nostre). Índex a part, per `pointId` i coordenada, servit des de
  R2 i **mai empaquetat**.
- Miniatures **≤20 kB**, càrrega mandrosa i només quan el bloc és a pantalla; la
  foto sencera només en tocar-la, i el botó ho diu (regla 4).

---

## 5. Mòbil primer

Punts de tall reals de `src/screens/screens.css` — **no se n'afegeix cap de nou**:

| Consulta | Què fa |
|---|---|
| `max-width: 360` (l.1870) | Logotip a 88 px, gutter a 8 px |
| `max-width: 390` (l.2396) | `.home__planninglinks` passa a 1 columna |
| `max-width: 400` (l.1895) | S'amaga `.shell__locate` |
| `max-width: 480` (l.1829) | Selectors de capçalera a ample fix |
| `max-width: 899` (l.786) | Llegenda del mapa en una fila que llisca |
| `min-width: 900` + `min-height: 500` (l.1433) | Carril lateral 168 px + franja editorial 40 px |
| `min-width: 1180` + `min-height: 500` (l.1557) | `.screen--split` → graella `1.35fr 1fr` |
| `min-width: 720` (`ui.css` l.1206) | El `Dialog` deixa de pujar de baix i se centra |

Graella: **2 columnes per sota de 900 px, 3 fins a 1179, 4 a partir de 1180.** A
390 px cada columna fa `(390 − 40 gutter − 12 gap) / 2 = 169 px`; retrat 3:4 →
225 px d'alt. Una columna malgasta l'única pantalla on una foto ven; tres fa
miniatures il·legibles. Per sota de 400 px s'encongeix la **canal**, mai la
miniatura: el blanc de toc mínim és 44 px i la miniatura *és* el blanc.

**Les trampes ja pagades, que no es tornen a pagar:**

1. **Apaisat**: la regla lateral és `max(gutter, inset)`, **mai** `gutter + inset`
   — sumar-los regalava 79 px per banda (l.15-21).
2. **L'osca**: `viewport-fit=cover`; tot el que és fix suma
   `env(safe-area-inset-*)`. I dins d'un `calc()`, **zero ha de portar unitat**
   (`0px`): un `0` pelat invalida la declaració sencera (l.42-45,
   `--bar-dateline`).
3. **Pantalles baixes**: iPhone 16 Pro Max apaisat és **932×440** i passava el
   tall dels 900. La guarda és `min-height: 500px` a **les dues** consultes, mai
   `orientation` ni `pointer` (l.1418-1431).
4. **Retall del mapa**: mesurat a 390×844, la fitxa deixava el mapa en 257 px
   (29 %) amb 169 px de crom mut. **El sostre real de `.mapscreen__sheet` és
   `36dvh` (l.971)**; dos comentaris veïns encara diuen 45dvh i són vells. En
   36dvh (~304 px a 844) ja hi ha distintiu, tres xifres i línia de contactes:
   **la galeria d'un lloc no hi entra com a secció apilada**, és una fila que
   llisca dins la vista `Llocs`, sota el primer cop d'ull.
5. **Cap `<select>` natiu, cap `Tooltip` amb informació necessària** (al mòbil no
   hi ha hover), **cap vidre nou amb `blur(18px)`**, i els `@import` dels tokens
   **abans** de qualsevol regla o el navegador els descarta en silenci.
6. Les imatges porten `width`/`height`, `loading="lazy"` i `decoding="async"`:
   una graella que salta et fa tocar el que no volies. **Res de desplaçament
   infinit**: 24 fotos i un botó.

**El flux de pujada** reutilitza `ui-dialog__sheet`: `max-width: 520px`,
`padding-bottom: calc(--sp-7 + safe-area-inset-bottom)`, cantonades només a dalt
per sota de 720 px. En apaisat el diàleg fa `align-items: flex-end` amb 440 px
d'alçada: **el cos es desplaça, no creix**. El visor a pantalla completa hereta
`.shell--immersive` (`--bar-top`/`--bar-bottom`/`--rail-w: 0px`), que ja existeix.
Obrir una foto **escriu una entrada d'historial**: l'Enrere ha de tancar la foto,
no expulsar-te de l'app.

**Cinquena pestanya: NO.** Ara n'hi ha 4 al mòbil i 3 a l'escriptori
(`sky` només si `camera.supported`, `App.tsx:536`). Els ítems són `flex: 1`: a
390 px fan **97,5 px** i amb cinc en farien **78**. L'etiqueta és mono d'11 px
amb `letter-spacing: 0.14em` ≈ 8,1 px/caràcter; «COMPTE ENRERE» ja va just.
`TabBar.tsx:7` ho diu literalment: *«Hi caben quatre pestanyes a 390 px.»*
**Sisè segment al commutador de la fitxa: tampoc.** Les cinc actuals ja es
parteixen 3+2 sobre sis columnes a l'escriptori i llisquen en una sola fila al
mòbil (`MapScreen.tsx:822-847`, `screens.css` a partir de l.988).

---

## 6. Com es destaca sense un segon ambre

**La galeria no té color. Té lloc i té fotografia.** Sobre `--bg-page` i
`--bg-inset` —que giren amb el tema, cosa que `--ink-950` escrit a pèl no fa—,
una corona real és l'element més cridaner d'una pantalla sense gastar cap to.
Textura en comptes de tint.

- **Cap element de la galeria pot ser ambre.** Al mapa l'ambre és de la franja; a
  la portada, la xifra de `HeroCountdown`; a la fitxa, la durada visible
  (`Stat tone="accent"`). I `--status-partial` és el **mateix hexadecimal** que
  `--accent`: fer-lo servir compta com un segon ambre.
- **Zero vermell.** `statusDanger` vol dir seguretat ocular i no es dilueix.
- **Portada**: tira de fotos a sang **per sota** del titular i de la targeta de
  temps. És l'únic element amb imatge de la pantalla, per tant guanya sol. La
  seva crida és `Button variant="ghost"`, com `home.findSpot`.
- **Una foto destacada es marca amb tres coses que no són color**: va primera,
  ocupa dues columnes, i porta un filet de `corona100` — el to que assenyala
  sense cridar, el mateix de la línia central i del con de visió.
- **Res no es pinta damunt de la imatge** fora del degradat inferior del §2: ni
  insígnia, ni títol sobreimprès. **Res no es mou tot sol**: cap carrusel
  automàtic, cap animació d'entrada.
- **Cel i AR: res.** L'ambre d'allà és el marcador del Sol i el vermell és
  seguretat ocular.

---

## 7. Les proves que ho comparen amb la realitat

La foto és la comparació; el que la publica, no. Això és el que es vigila:

1. `src/core/photos/proximitat.test.ts` — el criteri del §4 **als dos costats de
   cada llindar**: 299 m entra i 301 m no; 29° entra i 31° no; sense rumb no
   ocupa mai la ranura d'horitzó; un punt `estimated` no entra **mai** per radi.
   Casos escrits un per un, mai dins d'un bucle que podria no córrer cap vegada.
2. `src/core/photos/mena.test.ts` — **la mena inferida per EXIF coincideix amb la
   finestra C1–C4 que dona el motor per aquell punt**, i la secció on cau una
   foto coincideix amb el seu `kind` desat. És el patró que faltava a «Galícia»:
   comparar el text amb el motor.
3. `src/core/photos/coherencia-motor.test.ts` — els segons d'una foto d'eclipsi
   són els que dona el nostre motor des de la seva coordenada, i la coordenada cau
   dins de la franja calculada. Una foto que digui «totalitat» des de fora de la
   franja **atura la construcció**. I **el mar no és un lloc**.
4. `src/core/photos/exif.test.ts` — **cap fitxer publicat porta GPS**: la sortida
   del reescriptor per canvas no té segment APP1. La promesa de privadesa escrita
   com a codi executable, igual que `analytics/sanitize.ts`.
5. `src/core/photos/manifest.test.ts` — **cap fitxer orfe i cap entrada sense
   fitxer**, en tots dos sentits.
6. `tests/fotos-publicades.test.ts` — **s'obren les imatges i se'n miren els
   píxels**: cap totalment transparent, cap d'un sol color pla, mides declarades
   iguals a les reals. El mini-mapa transparent va arribar a producció per no fer
   això.
7. `src/features/gallery/conjunt.test.ts` — **la graella, la tira de la fitxa i el
   recompte del `SegmentedControl` surten de la MATEIXA funció de filtre**. Si es
   calculen a part, un dia el recompte dirà 7 i la graella n'ensenyarà 5: és
   exactament el que feia sortir vores de franja surant al mar.
8. `src/features/gallery/grup.test.ts` — **una xinxeta és un lloc**: amb cent
   fotos a la mateixa coordenada, la font en dona **una** feature i tocar el grup
   canvia el zoom. Font falsa, com `layers/viewpoints.test.ts`.
9. `src/offline/data-agreement.test.ts` i `budget.test.ts`, ampliats — la URL del
   manifest surt de `src/offline/config.ts`, té regla al service worker, i **les
   imatges no entren al precache**.
10. `src/core/analytics/vocabulary.test.ts` — els esdeveniments nous, amb llista
    tancada de paraules i **cap número**:
    `photo_gallery_open: { via, kind }`, `photo_send: { kind, channel, surface }`.
    `via` separa un problema de descobriment d'un de demanda, que es curen al
    revés — i és la mesura que dirà si no ser una pestanya va ser un error.

**El que no es pot automatitzar, i es diu:** comparar la carena d'una foto amb el
perfil del terreny demanaria visió per computador, que aquí no hi és ni hi ha
d'entrar. És un **protocol a mà**: de cada foto de LLOC publicada s'anota
l'elevació de la carena en la direcció del Sol i es compara amb la del perfil;
**tota discrepància de més de 2° va a `ESTAT.md` amb el punt i la data**. Un
protocol amb un número és una comprovació; «ja ho mirarem» no ho és.

---

## 8. El que deixem fora, a posta

- **Cinquena pestanya** i **sisè segment de la fitxa**. Els números són al §5.
- **Un mapa dins de la galeria** i **una capa de fotos a `LayerControl`**. Dos
  comandaments sobre el mateix territori discrepen; i les fotos no descriuen
  territori.
- **Un to nou o un senyal nou sobre les xinxetes.** Els tres canals del disc ja
  estan ocupats (§2) i qualsevol color nou és el segon ambre o el vermell gastat.
- **M'agrada, comentaris, comptes, seguidors i ordenació per «millors».** Una
  ordenació per popularitat competiria amb l'ordenació per segons, que és la
  resposta d'aquesta app. I no tenim cap manera honesta de puntuar una foto.
- **Canal en directe i punt d'escriptura al servidor.** Es publica a mà i es
  revisa a mà (§3).
- **Vídeo.** Megabytes, moderació i pressupost offline per a una cosa que no
  respon res que la foto no respongui.
- **Sembrar amb estoc.** Una foto genèrica en una galeria geolocalitzada és una
  mentida sobre un lloc.
- **Filtres, retocs i correcció de color.** Una carena retocada deixa de poder
  desmentir res, que és l'única cosa per a la qual serveix.
- **Persones com a subjecte.** Això és una galeria de carenes i de cels.
- **Galeries del 2027 i del 2028.** No hi ha fotos, i una secció buida sense
  motiu és pitjor que no tenir-ne.
