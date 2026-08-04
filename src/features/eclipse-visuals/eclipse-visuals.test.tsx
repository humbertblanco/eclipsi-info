/** Proves de la informació accessible que acompanya els tres dibuixos. */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { computeShadowMotion } from '../../core/astro/shadow';
import { EclipseFingerprint } from './EclipseFingerprint';
import { ShadowApproach } from './ShadowApproach';
import { vs } from './strings';

const TAFALLA = { lat: 42.531, lon: -1.675, elevation: 426 };

describe('empremta accessible', () => {
  it('diu que el relleu és provisional i no inventa un percentatge', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', TAFALLA);
    render(
      <EclipseFingerprint
        circumstances={circumstances}
        horizon={null}
        verdict={null}
        locale="ca"
      />,
    );
    expect(screen.getByText(vs('fingerprint.assumed', 'ca'))).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(vs('fingerprint.shape.assumed', 'ca'))).toBeTruthy();
    expect(screen.getByText(vs('fingerprint.arc.pending', 'ca'))).toBeTruthy();
  });
});

describe('ombra accessible', () => {
  it('la velocitat divergent es descriu sense publicar el número', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', TAFALLA);
    const motion = computeShadowMotion('2026-08-12', circumstances)!;
    render(
      <ShadowApproach
        motion={{ ...motion, speedDiverging: true }}
        circumstances={circumstances}
        nowMs={motion.watchFromUtc.getTime()}
        locale="es"
      />,
    );
    expect(screen.getByText(vs('shadow.fast', 'es'))).toBeTruthy();
    expect(screen.queryByText(/km\/h/)).toBeNull();
    expect(screen.getByText(vs('shadow.explain.total', 'es'))).toBeTruthy();
    expect(screen.getByText(vs('shadow.explain.approaching', 'es'))).toBeTruthy();
    expect(screen.getByText(vs('shadow.explain.diverging', 'es'))).toBeTruthy();
  });
});
