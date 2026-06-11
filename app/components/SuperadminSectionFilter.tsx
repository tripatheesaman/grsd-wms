'use client';

import { useCallback, useEffect, useState } from 'react';
import { Section, SECTIONS, sectionLabel } from '@/app/lib/sections';
import { useAuth } from './AuthProvider';

export type SectionFilterValue = 'all' | Section;

const STORAGE_KEY = 'wms_superadmin_section_filter';

function readStoredFilter(): SectionFilterValue {
  if (typeof window === 'undefined') return 'all';
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored === 'workshops' || stored === 'nem') return stored;
  return 'all';
}

export function useSuperadminSectionFilter() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const [filter, setFilterState] = useState<SectionFilterValue>('all');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilterState(readStoredFilter());
    setHydrated(true);
  }, []);

  const setFilter = useCallback((value: SectionFilterValue) => {
    setFilterState(value);
    if (value === 'all') sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, value);
  }, []);

  const applySectionParam = useCallback(
    (params: URLSearchParams) => {
      if (isSuperadmin && filter !== 'all') {
        params.set('section', filter);
      }
    },
    [isSuperadmin, filter],
  );

  return { filter, setFilter, isSuperadmin, applySectionParam, hydrated };
}

export function SuperadminSectionFilter({
  value,
  onChange,
  className = '',
}: {
  value: SectionFilterValue;
  onChange: (value: SectionFilterValue) => void;
  className?: string;
}) {
  const { user } = useAuth();
  if (user?.role !== 'superadmin') return null;

  return (
    <div className={className}>
      <label htmlFor="superadmin-section-filter" className="block text-sm font-medium text-gray-700 mb-1">
        Section
      </label>
      <select
        id="superadmin-section-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as SectionFilterValue)}
        className="min-w-[180px] px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#08398F] focus:border-[#08398F] bg-white text-sm"
      >
        <option value="all">All Sections</option>
        {SECTIONS.map((s) => (
          <option key={s} value={s}>
            {sectionLabel(s)}
          </option>
        ))}
      </select>
    </div>
  );
}
