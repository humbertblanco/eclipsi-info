import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../i18n';
import { GuideView } from './GuideView';

function renderGuide(locale: 'ca' | 'fr' = 'ca') {
  return render(
    <LocaleProvider initialLocale={locale}>
      <GuideView eclipseId="2026-08-12" sunAltitudeDeg={4.3} />
    </LocaleProvider>,
  );
}

describe('GuideView accordions', () => {
  it('opens and closes every section without leaving mixed states', () => {
    const { container } = renderGuide();

    fireEvent.click(screen.getByRole('button', { name: 'Obre-ho tot' }));
    expect([...container.querySelectorAll('details')].every((item) => item.open)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Tanca-ho tot' }));
    expect([...container.querySelectorAll('details')].every((item) => !item.open)).toBe(true);
  });

  it('keeps native individual toggles working after a global toggle', () => {
    const { container } = renderGuide();
    fireEvent.click(screen.getByRole('button', { name: 'Obre-ho tot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tanca-ho tot' }));

    const first = container.querySelector('details');
    const summary = first?.querySelector('summary');
    expect(first?.open).toBe(false);
    expect(summary).not.toBeNull();

    fireEvent.click(summary!);
    expect(first?.open).toBe(true);
  });

  it('renders the long French labels through the same accordion structure', () => {
    const { container } = renderGuide('fr');
    expect(screen.getByRole('button', { name: /tout/i })).toBeTruthy();
    expect(container.querySelectorAll('details').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.guide__summaryhead').length).toBe(
      container.querySelectorAll('details').length,
    );
  });
});
