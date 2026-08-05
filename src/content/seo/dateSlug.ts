/**
 * Data llegible per a URL pública. El motor conserva sempre l'identificador
 * ISO; només la presentació del camí canvia a dia-mes-any.
 */
export function eclipseDateSlug(eclipseId: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eclipseId);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : eclipseId;
}

/** Accepta el format públic europeu i, temporalment, l'ISO antic. */
export function eclipseIdFromSlug(slug: string): string | null {
  const european = /^(\d{2})-(\d{2})-(\d{4})$/.exec(slug);
  if (european) return `${european[3]}-${european[2]}-${european[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(slug) ? slug : null;
}
