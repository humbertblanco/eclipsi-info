# Arquitectura de les pàgines SEO d’eclipsi.info

Aquest document és la font de continuïtat per a futurs agents i models que modifiquin les landings estàtiques. Explica les decisions de producte, disseny, contingut i SEO que no són evidents només llegint el generador.

## Principi principal

Les landings no són un segon web ni una versió simplificada de l’app. Són lectures editorials de les mateixes dades i eines. Han de reutilitzar els components reals sempre que aportin interacció o una lectura que el HTML estàtic no pugui reproduir amb la mateixa fidelitat.

Fitxers principals:

- `scripts/build-seo-pages.ts`: genera rutes, HTML estàtic, metadades, schema i directoris.
- `src/seo-widgets.tsx`: hidrata els widgets interactius dins les pàgines generades.
- `src/seo-widgets.css`: composició responsive exclusiva dels widgets hidratats.
- `src/content/editorial-guides.ts`: contingut i FAQs pròpies de cada guia SEO.
- `src/content/guide.ts`: contingut tècnic compartit amb la guia de l’app.
- `src/content/seo/`: ciutats, strings i convencions de ruta.

## Regles que no s’han de trencar

1. No incrustar l’app amb `iframe`. Cal muntar components concrets o generar HTML semàntic.
2. No inventar substituts visuals inferiors si ja existeix un widget real a l’app.
3. El simulador és el component principal de les pàgines locals.
4. Un mapa interactiu no pot anar dins una columna lateral estreta. Ha d’ocupar tota l’amplada útil i tenir una alçada controlada.
5. No posar dues peces d’alçades molt diferents a la mateixa fila CSS si això bloqueja el contingut següent i crea espai buit.
6. `Mira el cel` és una acció mòbil. A escriptori s’han de prioritzar mapa, simulador i compte enrere.
7. Un punt oficial s’ha de distingir d’una ubicació normal amb organisme, tipus de punt, precisió, font i identitat visual pròpia.
8. No presentar durades teòriques com a durades visibles si encara no s’ha calculat el relleu.
9. No anomenar “previsió” una climatologia ni “climatologia” una previsió meteorològica real.
10. Si WebGL falla, el mapa pot mostrar un fallback, però mai no ha de fer caure el simulador o la previsió.

## Ordre de les pàgines locals

Ordre de valor recomanat:

1. H1, resum local i data.
2. Simulador real amb càmera i trajectòria respecte del relleu.
3. Previsió meteorològica real quan sigui dins l’horitzó disponible.
4. Mapa local a amplada completa amb punt seleccionat i punts oficials pròxims.
5. Cronologia i dades dels contactes.
6. Context específic del lloc, seguretat i accions.
7. Punts oficials pròxims amb distància i font.
8. Enllaços contextuals, no una llista genèrica sense explicació.

El mapa ha de començar centrat en el lloc i amb zoom local. Els marcadors numerats corresponen a la llegenda i enllacen a les landings dels punts oficials.

## Guies SEO

Les tres guies responen a intencions diferents i no poden compartir el mateix cos:

- Seguretat: filtre conforme a ISO 12312-2, instruments, regla C2–C3, anular/parcial i exposició accidental.
- Fotografia: equip, filtre davant l’objectiu, enfocament, enquadrament, exposició, bracketing, mòbil i seqüència C2/C3.
- Sol baix: altura, azimut, horitzó real, reconeixement del lloc, refracció, boirina, núvol baix, accessos i pla B.

`editorial-guides.ts` és el cos principal. Les seccions de `guide.ts` només s’afegeixen com a aprofundiment específic; no s’ha de tornar a reutilitzar el mateix conjunt genèric per a totes les guies.

Cada guia necessita:

- resposta visual immediata;
- una eina contextual de l’app;
- cos propi visible i indexable;
- índex lateral només quan hi ha amplada real;
- índex de xips horitzontal a iPad i mòbil;
- FAQs visibles idèntiques al `FAQPage` emès;
- fonts visibles i data de revisió;
- enllaços contextuals a les altres guies i a les eines.

No s’ha de prometre que `FAQPage` generarà un rich result: Google el limita, però l’estructura continua sent útil si coincideix amb el contingut visible.

## Rutes i multidioma

Les dates públiques utilitzen `DD-MM-YYYY`:

- CA: `/ciutat/.../12-08-2026/`, `/punt-oficial/.../12-08-2026/`, `/guia/.../`
- ES: `/es/ciudad/.../12-08-2026/`, `/es/punto-oficial/.../`, `/es/guia/.../`
- EN: `/en/city/.../`, `/en/official-site/.../`, `/en/guide/.../`
- FR: `/fr/ville/.../`, `/fr/site-officiel/.../`, `/fr/guide/.../`

Cada ruta ha de tenir canonical propi, alternates recíprocs CA/ES/EN/FR i `x-default` català. Els paràmetres interns de l’app conserven ISO (`e=2026-08-12`) perquè són dades de màquina, no slugs editorials.

## Directoris i enllaçat intern

Un directori ha d’ajudar a decidir, no només repartir PageRank.

- Guies: agrupar per necessitat i explicar l’ordre recomanat.
- Ciutats: agrupar per territori o resultat; mostrar fase/durada, hora i altura abans de clicar.
- Punts oficials: agrupar per territori i organisme; prioritzar proximitat quan hi ha una ubicació de referència.
- Pàgina d’eclipsi: és el hub de ciutats, punts, mapa, guies i eines d’aquell eclipsi.

No deixar enllaços “tirats”. Cada bloc necessita títol, una frase que expliqui què compara i targetes o files coherents amb el design system.

## Disseny i responsive

Cal utilitzar els tokens i components existents. No introduir una paleta, tipografia, radi o sistema d’espaiat paral·lel.

Amplades mínimes que s’han de revisar visualment:

- 390 px: mòbil petit.
- 768 px: iPad vertical; és un cas crític perquè no ha de reservar una columna lateral invisible.
- 1024 px: tauleta horitzontal/escriptori estret.
- 1440 px: escriptori.

Comprovar especialment:

- cap desbordament horitzontal;
- cap títol o botó retallat;
- índex de guia visible i usable;
- mapa no deformat;
- espai vertical sense buits artificials;
- objectius tàctils de 44 px;
- fallback sense WebGL;
- taules amb scroll propi.

## Build i verificació

El build és multi-entry: `app` i `seoWidgets`. Després de Vite, `scripts/run-build-seo.ts` genera les landings fora del precache de la PWA.

Abans de publicar:

1. `npm run lint`
2. `npm test -- --run`
3. `npm run build`
4. comprovar tres tipus representatius: ciutat, punt oficial i guia;
5. comprovar CA/ES/EN/FR;
6. fer captures a 390, 768 i 1440 px;
7. inspeccionar canonical, hreflang, title, description, OG i JSON-LD;
8. revisar que no s’hagi regenerat cap dashboard duplicat o inferior;
9. presentar localhost abans de fer commit, push o deploy.

## Errors ja detectats

- Un `EclipseMap` sense frontera d’error feia desaparèixer també simulador i previsió quan WebGL fallava.
- Fotografia i Sol baix arribaren a compartir un 86,7% del vocabulari perquè el generador ignorava `guide.sections`.
- L’índex reutilitzat de `GuideScreen` quedava ocult al mòbil i reservava una columna buida a iPad.
- El mapa local es va posar en una columna dreta massa estreta i deformava la composició.
- Un embed de tota l’app es va fer passar per mapa; aquesta solució està prohibida.
- Es van crear visuals simplificats malgrat existir simulador, trajectòria i widgets reals millors.

Quan una nova solució contradigui una regla d’aquest document, primer cal justificar i documentar el canvi; no s’ha de derivar silenciosament.
