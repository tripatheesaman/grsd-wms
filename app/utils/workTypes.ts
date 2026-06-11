
import type { Section } from '@/app/lib/sections';

export const WORKSHOP_WORK_TYPES = [
  'Maintenance',
  'Repair',
  'Paint',
  'Dent',
  'Wheel',
  'Tyre',
  'Mechanical',
  'Fabrication',
  'Electrical',
  'Battery',
  'ULD Containers',
  'Others',
] as const;

export const NEM_WORK_TYPES = [
  'Electrical',
  'Hydraulics',
  'Mechanical',
  'Schedule Check',
  'Cargo Baggage',
  'Fabrication',
  'Painting',
  'Others',
] as const;

export const NEM_WORK_TYPE_SYMBOLS: Record<(typeof NEM_WORK_TYPES)[number], string> = {
  Electrical: 'E',
  Hydraulics: 'H',
  Mechanical: 'M',
  'Schedule Check': 'SC',
  'Cargo Baggage': 'CB',
  Fabrication: 'F',
  Painting: 'P',
  Others: 'O',
};

export const WORK_TYPES = WORKSHOP_WORK_TYPES;

export type WorkType = (typeof WORKSHOP_WORK_TYPES)[number] | (typeof NEM_WORK_TYPES)[number];

export function getWorkTypesForSection(section?: Section): readonly WorkType[] {
  return section === 'nem' ? NEM_WORK_TYPES : WORKSHOP_WORK_TYPES;
}

export function isWorkType(value: string, section?: Section): value is WorkType {
  return getWorkTypesForSection(section).includes(value as WorkType);
}

export function getNemTaskSymbol(workType: string): string {
  const normalized = workType.trim().toLowerCase();
  const entry = Object.entries(NEM_WORK_TYPE_SYMBOLS).find(
    ([key]) => key.toLowerCase() === normalized,
  );
  return entry?.[1] ?? 'O';
}

export const NEM_WEEKLY_CATEGORIES = [
  'electrical',
  'hydraulic',
  'mechanical',
  'schedule_checks',
  'cargo_baggage',
  'fabrication',
  'paint',
  'miscellaneous',
] as const;

export type NemWeeklyCategory = (typeof NEM_WEEKLY_CATEGORIES)[number];

export function categorizeNemWorkType(workType: string): NemWeeklyCategory {
  const type = workType.toLowerCase().trim();
  if (type === 'electrical') return 'electrical';
  if (type === 'hydraulics' || type === 'hydraulic') return 'hydraulic';
  if (type === 'mechanical') return 'mechanical';
  if (type === 'schedule check' || type === 'schedule checks') return 'schedule_checks';
  if (type === 'cargo baggage') return 'cargo_baggage';
  if (type === 'fabrication') return 'fabrication';
  if (type === 'painting' || type === 'paint') return 'paint';
  if (type === 'others' || type === 'other') return 'miscellaneous';
  if (type.includes('electrical')) return 'electrical';
  if (type.includes('hydraulic')) return 'hydraulic';
  if (type.includes('mechanical')) return 'mechanical';
  if (type.includes('schedule')) return 'schedule_checks';
  if (type.includes('cargo') || type.includes('baggage')) return 'cargo_baggage';
  if (type.includes('fabrication')) return 'fabrication';
  if (type.includes('paint')) return 'paint';
  return 'miscellaneous';
}
