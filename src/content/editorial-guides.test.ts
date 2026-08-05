import { describe, expect, it } from 'vitest';
import { LOCALES } from '../i18n';
import {
  EDITORIAL_GUIDE_IDS,
  EDITORIAL_GUIDES,
  findEditorialGuideBySlug,
} from './editorial-guides';

describe('editorial guides', () => {
  it('keeps structural parity across locales', () => {
    for (const id of EDITORIAL_GUIDE_IDS) {
      const reference = EDITORIAL_GUIDES[id].ca;
      for (const locale of LOCALES) {
        const guide = EDITORIAL_GUIDES[id][locale];
        expect(guide.id).toBe(id);
        expect(guide.sections.map((section) => section.id)).toEqual(
          reference.sections.map((section) => section.id),
        );
        expect(guide.faq).toHaveLength(reference.faq.length);
        expect(findEditorialGuideBySlug(guide.slug, locale)).toBe(guide);
      }
    }
  });

  it('has unique, useful slugs and complete visible FAQ copy', () => {
    for (const locale of LOCALES) {
      const slugs = EDITORIAL_GUIDE_IDS.map((id) => EDITORIAL_GUIDES[id][locale].slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const id of EDITORIAL_GUIDE_IDS) {
        const guide = EDITORIAL_GUIDES[id][locale];
        expect(guide.title.length).toBeGreaterThan(20);
        expect(guide.description.length).toBeGreaterThan(70);
        expect(guide.sections.length).toBeGreaterThanOrEqual(4);
        for (const item of guide.faq) {
          expect(item.question.length).toBeGreaterThan(15);
          expect(item.answer.length).toBeGreaterThan(50);
        }
      }
    }
  });
});
