
export const WORK_TYPES = [
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
  'Others'
] as const;
export type WorkType = typeof WORK_TYPES[number];
export function isWorkType(value: string): value is WorkType {
  return WORK_TYPES.includes(value as WorkType);
}
