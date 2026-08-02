/**
 * La vigilància de la vida de la pista (`watchTrackLoss`).
 *
 * El sistema pren la càmera sense error: una trucada, la càmera nativa, el
 * segon pla. L'única veu és la pista mateixa — 'ended', 'mute', 'unmute' — i
 * aquí es comprova que l'escoltem, que cada event arriba al seu gestor i que
 * la neteja talla la línia de debò (un gestor que sobreviu la neteja tocaria
 * l'estat d'una vista ja desmuntada).
 *
 * La pista es simula amb un `EventTarget` pelat: `watchTrackLoss` només fa
 * servir add/removeEventListener i dispatch, que és exactament el contracte.
 */

import { describe, expect, it } from 'vitest';
import { watchTrackLoss } from './camera';

function fakeStream(tracks: EventTarget[]): MediaStream {
  return { getVideoTracks: () => tracks } as unknown as MediaStream;
}

function comptadors() {
  const n = { ended: 0, mute: 0, unmute: 0 };
  const handlers = {
    onEnded: () => void (n.ended += 1),
    onMute: () => void (n.mute += 1),
    onUnmute: () => void (n.unmute += 1),
  };
  return { n, handlers };
}

describe('watchTrackLoss', () => {
  it('cada event de la pista arriba al seu gestor, i només al seu', () => {
    const track = new EventTarget();
    const { n, handlers } = comptadors();
    watchTrackLoss(fakeStream([track]), handlers);

    track.dispatchEvent(new Event('mute'));
    expect(n).toEqual({ ended: 0, mute: 1, unmute: 0 });

    track.dispatchEvent(new Event('unmute'));
    track.dispatchEvent(new Event('ended'));
    expect(n).toEqual({ ended: 1, mute: 1, unmute: 1 });
  });

  it('després de la neteja, la pista pot cridar que ningú no la sent', () => {
    const track = new EventTarget();
    const { n, handlers } = comptadors();
    const stop = watchTrackLoss(fakeStream([track]), handlers);

    track.dispatchEvent(new Event('mute'));
    stop();
    track.dispatchEvent(new Event('mute'));
    track.dispatchEvent(new Event('ended'));
    track.dispatchEvent(new Event('unmute'));

    expect(n).toEqual({ ended: 0, mute: 1, unmute: 0 });
  });

  it('un flux sense pista de vídeo no peta: vigilància i neteja buides', () => {
    const { n, handlers } = comptadors();
    const stop = watchTrackLoss(fakeStream([]), handlers);
    expect(() => stop()).not.toThrow();
    expect(n).toEqual({ ended: 0, mute: 0, unmute: 0 });
  });
});
