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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchLensChange, watchTrackLoss } from './camera';

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

describe('watchLensChange', () => {
  afterEach(() => vi.useRealTimers());

  function settingsTrack(initial: MediaTrackSettings & { zoom?: number }) {
    let settings = initial;
    return {
      getSettings: () => settings,
      change: (next: MediaTrackSettings & { zoom?: number }) => { settings = next; },
    };
  }

  it('detecta un canvi de zoom encara que la resolució no canviï', () => {
    vi.useFakeTimers();
    const track = settingsTrack({ width: 1920, height: 1080, deviceId: 'rear', zoom: 1 });
    const changes: Array<{ looksUltraWide: boolean; suggestedFovDeg: number }> = [];
    const stop = watchLensChange(
      fakeStream([track as unknown as EventTarget]),
      (info) => changes.push(info),
    );

    track.change({ width: 1920, height: 1080, deviceId: 'rear', zoom: 0.5 });
    vi.advanceTimersByTime(1000);

    expect(changes).toHaveLength(1);
    expect(changes[0].looksUltraWide).toBe(true);
    expect(changes[0].suggestedFovDeg).toBeGreaterThan(100);
    stop();
  });

  it('no avisa si els paràmetres observables continuen iguals', () => {
    vi.useFakeTimers();
    const track = settingsTrack({ width: 1280, height: 720, deviceId: 'rear', zoom: 1 });
    const changed = vi.fn();
    const stop = watchLensChange(fakeStream([track as unknown as EventTarget]), changed);
    vi.advanceTimersByTime(3000);
    expect(changed).not.toHaveBeenCalled();
    stop();
  });

  it('no confon una pèrdua transitòria del zoom amb un retorn a la lent principal', () => {
    vi.useFakeTimers();
    const track = settingsTrack({ width: 1920, height: 1080, deviceId: 'rear', zoom: 0.5 });
    const changes: Array<{ zoom: number | null; looksUltraWide: boolean }> = [];
    const stop = watchLensChange(
      fakeStream([track as unknown as EventTarget]),
      (info) => changes.push(info),
    );

    track.change({ width: 1280, height: 720, deviceId: 'rear' });
    vi.advanceTimersByTime(1000);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      zoom: 0.5,
      looksUltraWide: true,
      resolutionChanged: true,
      zoomChanged: true,
    });
    stop();
  });

  it('redueix el camp visual provisional quan entra zoom digital', () => {
    vi.useFakeTimers();
    const track = settingsTrack({ width: 1920, height: 1080, zoom: 1 });
    const changes: Array<{ suggestedFovDeg: number; zoomChanged: boolean }> = [];
    const stop = watchLensChange(
      fakeStream([track as unknown as EventTarget]),
      (info) => changes.push(info),
    );
    track.change({ width: 1920, height: 1080, zoom: 2 });
    vi.advanceTimersByTime(1000);

    expect(changes).toHaveLength(1);
    expect(changes[0].zoomChanged).toBe(true);
    expect(changes[0].suggestedFovDeg).toBeGreaterThan(30);
    expect(changes[0].suggestedFovDeg).toBeLessThan(40);
    stop();
  });

  it('la neteja atura el sondeig de canvis', () => {
    vi.useFakeTimers();
    const track = settingsTrack({ width: 1280, height: 720, zoom: 1 });
    const changed = vi.fn();
    const stop = watchLensChange(fakeStream([track as unknown as EventTarget]), changed);
    stop();
    track.change({ width: 1280, height: 720, zoom: 0.5 });
    vi.advanceTimersByTime(2000);
    expect(changed).not.toHaveBeenCalled();
  });
});
