# eclipsi.info

**Des del punt exacte on seràs: quants segons d'eclipsi veuràs de debò, a quina
hora, cap a on has de mirar, i si hi ha una muntanya al mig.**

Simulador dels tres eclipsis solars que es veuran des d'Espanya aquesta dècada.
No és un compte enrere: la pregunta que respon és una altra.

→ **[Prova'l](https://lacuinade.estic.online/eclipsi/)**

| Data | Què és | Des d'Espanya |
|---|---|---|
| **12 d'agost de 2026** | Total | La franja creua de Galícia i Astúries fins a les Balears. El Sol, entre 12° i 1° sobre l'horitzó: gairebé a la posta |
| **2 d'agost de 2027** | Total al nord d'Àfrica | Parcial, i molt profund al sud |
| **26 de gener de 2028** | Anular | L'anell passa per la península |

El del 2026 és la primera totalitat a l'Europa continental des del 1999.

## Què el fa diferent

- **Càlcul topocèntric, no de catàleg.** Les hores de contacte, la magnitud i la
  durada es calculen per a les teves coordenades i la teva altitud, amb
  paral·laxi lunar i refracció. Validat contra l'IGN i la NASA: durades a la
  dècima de segon, línia central a 10-99 m.
- **El terreny compta.** Es baixa el model digital del terreny del teu voltant i
  es traça l'horitzó real en 360°, amb curvatura terrestre i refracció
  atmosfèrica. Amb el Sol a 5° —que és on serà el 2026— una carena a set graus
  no és un detall: et menja la meitat de la totalitat. L'app t'ho diu en segons.
- **Realitat augmentada ancorada al paisatge.** Apunta el mòbil al cel i hi
  veuràs el recorregut del Sol superposat. No es queda quiet per força bruta:
  la silueta de la muntanya que tens al davant s'aparella amb la que el model
  del terreny diu que hi ha d'haver, i d'aquí surt una mesura absoluta d'on
  apuntes. Corregeix la brúixola de passada.
- **Seguretat ocular amb comporta.** L'app només diu «pots treure't el filtre»
  quan ho pot demostrar: mai en un anular, mai en fase parcial, mai amb la
  totalitat per sota de 40 s, mai si el terreny la tapa, i mai si ets tan a prop
  del límit de la franja que el motor honestament no ho pot decidir.
- **Honestedat amb les xifres.** El 99,7 % no s'arrodoneix mai a 100. La
  diferència entre un 99 % i un 100 % no és de grau: és una altra cosa, i
  confondre-les és el que fa que la gent es tregui les ulleres quan no toca.

## Estat

En desenvolupament, i ja es pot fer servir. El que queda obert, el que s'ha
mesurat i el que **no s'ha de tornar a trencar** són a **[ESTAT.md](ESTAT.md)**,
que és el document de traspàs real del projecte.

## Com córrer-ho

```bash
npm install
npm run dev        # servidor de desenvolupament, amb HTTPS: sense context
                   # segur, iOS no dona ni càmera ni sensors d'orientació
npm run build      # compilació de producció
npm test           # bateria de proves
npm run lint
```

## Com està fet

React 19 + TypeScript + Vite, **sense servidor**: tot el càlcul es fa al
dispositiu i la ubicació no en surt. `src/core` és el motor i no depèn del
DOM —es pot córrer a Node i és on viu el gruix de les proves—; `src/features`
són les vistes; `src/ui` és el sistema de disseny.

| Carpeta | Què hi ha |
|---|---|
| `src/core/astro` | Efemèrides, contactes, obscuració, incertesa |
| `src/core/eclipses` | Elements besselians i trajectòria de l'ombra |
| `src/core/horizon` | Tessel·les de terreny i perfil d'horitzó |
| `src/core/visibility` | Veredicte: què veuràs de debò |
| `src/core/timer` | Compte enrere, avisos de veu i comporta de seguretat |
| `src/core/spots` | Cercador de llocs millors a prop teu |
| `src/features/ar` | Càmera, fusió de sensors i ancoratge al terreny |

**El codi i els comentaris són en català.** Els comentaris expliquen **per què**
cada cosa és com és, sovint amb la mesura que ho va decidir. És a posta: en un
projecte on un error de quatre segons desplaça una franja d'ombra cinquanta-cinc
quilòmetres, saber d'on surt una constant importa més que saber què fa.

## Fonts

Efemèrides amb [astronomy-engine](https://github.com/cosinekitty/astronomy).
Elements besselians i trajectòries de Fred Espenak (NASA/GSFC). Dades
d'observació de l'IGN. Model del terreny d'[AWS Terrain
Tiles](https://registry.opendata.aws/terrain-tiles/). Cartografia i topònims
d'OpenStreetMap (noms via Photon, komoot; tessel·les de CARTO). Meteorologia
d'Open-Meteo. Seguretat ocular segons l'IGN, l'AAS i la norma ISO 12312-2.

## Qui l'ha fet

[Humbert Blanco](https://x.com/humbertblanco) i
[Damos en el Blanco](https://damosenelblanco.com).

## Llicència

Encara sense decidir. Mentre no ho estigui, el codi es publica per poder-lo
llegir i comprovar —que en una app que diu si et pots treure una protecció
ocular no és un detall menor—, no per reutilitzar-lo.
