/**
 * La primera pregunta de l'app: on seràs.
 *
 * PER QUÈ NO ES DISPARA EL DIÀLEG DEL NAVEGADOR I JA ESTÀ. Un permís que
 * apareix sol, abans que hagis vist res, es denega. I una denegació de
 * geolocalització al navegador no es desfà tornant a preguntar: s'ha d'anar a
 * buscar als ajustos, cosa que gairebé ningú no fa. O sigui que demanar-ho
 * malament una sola vegada et deixa sense la peça central del producte per
 * sempre. Per això primer s'explica QUÈ HI GUANYES, amb la xifra que ho fa
 * evident —cinc quilòmetres poden ser tota la diferència—, i el diàleg del
 * navegador només surt si prems el botó.
 *
 * PER QUÈ HI HA TRES SORTIDES I NO UNA. Perquè «on seràs» i «on ets» no són la
 * mateixa pregunta, i la resposta bona depèn de quan obris l'app:
 *
 *   · EL DIA DE L'ECLIPSI, ja hi ets: el GPS és exacte i immediat.
 *   · PLANIFICANT, que és gairebé sempre, el GPS respon on ets al sofà, que és
 *     una xifra falsa amb aparença de bona. Llavors la sortida bona és triar
 *     el lloc.
 *   · MIRANT-LA PER SOBRE, sense pla i sense ganes de donar res: el punt
 *     d'exemple. Queda marcat com a tal a totes les pantalles, i per això es
 *     pot oferir sense fer trampa.
 *
 * Cap de les tres és el camí «correcte» i per això cap de les tres no és el
 * botó ambre. L'accent d'aquesta fulla no existeix: no hi ha cap xifra a
 * defensar, només una tria.
 */

import { Button, Dialog } from '../../ui';
import type { Locale } from '../../i18n';
import { ls } from './strings';
import './location.css';

export interface LocationGateProps {
  locale: Locale;
  /** Demana el GPS. Aquí és on surt el diàleg del navegador, i no abans. */
  onUseGps: () => void;
  /** Obre la fulla de tria. */
  onPickPlace: () => void;
  /** Segueix amb el punt d'exemple, dit pel seu nom. */
  onSkip: () => void;
  onClose: () => void;
}

export function LocationGate({
  locale,
  onUseGps,
  onPickPlace,
  onSkip,
  onClose,
}: LocationGateProps) {
  return (
    <Dialog
      title={ls('intro.title', locale)}
      onClose={onClose}
      closeLabel={ls('sheet.close', locale)}
    >
      <div className="loc-gate">
        <p className="loc-gate__body">{ls('intro.body', locale)}</p>
        {/*
          La privacitat es diu aquí i no en un enllaç: és la pregunta que et
          fas just abans de prémer, i respondre-la en una altra pàgina és no
          respondre-la.
        */}
        <p className="loc__note">{ls('intro.privacy', locale)}</p>

        <div className="loc-gate__actions">
          <Button variant="secondary" icon="crosshair" fullWidth onClick={onUseGps}>
            {ls('intro.accept', locale)}
          </Button>
          <Button variant="secondary" icon="search" fullWidth onClick={onPickPlace}>
            {ls('intro.pick', locale)}
          </Button>
          <Button variant="ghost" fullWidth onClick={onSkip}>
            {ls('intro.skip', locale)}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
