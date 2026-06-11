export type Section = 'workshops' | 'nem';

export const SECTIONS: Section[] = ['workshops', 'nem'];

export const DEFAULT_SECTION: Section = 'workshops';

export const SECTION_LABELS: Record<Section, string> = {
  workshops: 'Workshops Section',
  nem: 'NEM Section',
};

export function normalizeSection(value: unknown): Section | null {
  if (value === 'workshops' || value === 'nem') return value;
  return null;
}

export function sectionLabel(section: Section | undefined | null): string {
  if (!section) return SECTION_LABELS.workshops;
  return SECTION_LABELS[section] ?? SECTION_LABELS.workshops;
}
