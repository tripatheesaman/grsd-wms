'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/app/components/AuthProvider';
import { apiClient } from '@/app/utils/api';
import { TechnicianPerformance } from '@/app/types';
import Link from 'next/link';
export default function PerformanceReportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TechnicianPerformance[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const canView = user && (user.role === 'admin' || user.role === 'superadmin');
  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('date_from', dateFrom);
      if (dateTo) qs.set('date_to', dateTo);
      const res = await apiClient.get<TechnicianPerformance[]>(`/reports/technician-performance${qs.toString() ? `?${qs.toString()}` : ''}`);
      if (res.success && Array.isArray(res.data)) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load data');
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [canView, dateFrom, dateTo]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const maxCompleted = useMemo(() => Math.max(1, ...data.map(d => d.completed_actions)), [data]);
  const maxHours = useMemo(() => Math.max(1, ...data.map(d => Math.round((d.total_minutes / 60) * 100) / 100)), [data]);
  const onExport = async () => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set('date_from', dateFrom);
    if (dateTo) qs.set('date_to', dateTo);
    qs.set('export', 'excel');
    const endpoint = `/reports/technician-performance?${qs.toString()}`;
    const res = await apiClient.getBlob(endpoint);
    if (!res.ok || !res.blob) {
      setError('Unauthorized or failed to export');
      return;
    }
    const blobUrl = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = res.filename || 'technician-performance.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };
  if (!canView) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
          You do not have access to this page. <Link href="/dashboard" className="underline">Go back</Link>.
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700">From</label>
          <input type="date" className="mt-1 block border rounded px-3 py-2" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">To</label>
          <input type="date" className="mt-1 block border rounded px-3 py-2" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button
          onClick={fetchData}
          className="bg-[#08398F] text-white px-4 py-2 rounded hover:opacity-90"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Apply'}
        </button>
        <button
          onClick={onExport}
          className="bg-green-600 text-white px-4 py-2 rounded hover:opacity-90"
        >
          Export Excel
        </button>
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Completed Actions</h3>
          <div className="space-y-3">
            {data.map((t) => (
              <div key={`${t.staff_id}-${t.name}`} className="min-w-0">
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span className="truncate mr-2">{t.name} ({t.staff_id})</span>
                  <span>{t.completed_actions}</span>
                </div>
                <div className="w-full bg-gray-100 rounded h-3">
                  <div
                    className="h-3 rounded bg-[#08398F]"
                    style={{ width: `${(t.completed_actions / maxCompleted) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <div className="text-sm text-gray-500">No data</div>
            )}
          </div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Total Hours Worked</h3>
          <div className="space-y-3">
            {data.map((t) => {
              const hours = Math.round((t.total_minutes / 60) * 100) / 100;
              return (
                <div key={`${t.staff_id}-${t.name}`} className="min-w-0">
                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span className="truncate mr-2">{t.name} ({t.staff_id})</span>
                    <span>{hours} h</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded h-3">
                    <div
                      className="h-3 rounded bg-green-600"
                      style={{ width: `${(hours / maxHours) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.length === 0 && (
              <div className="text-sm text-gray-500">No data</div>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white rounded shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Tabular Data</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-4">Staff ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Actions Worked</th>
                <th className="py-2 pr-4">Completed Actions</th>
                <th className="py-2 pr-4">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => {
                const hours = Math.round((t.total_minutes / 60) * 100) / 100;
                return (
                  <tr key={`${t.staff_id}-${t.name}`} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{t.staff_id}</td>
                    <td className="py-2 pr-4">{t.name}</td>
                    <td className="py-2 pr-4">{t.actions_worked}</td>
                    <td className="py-2 pr-4">{t.completed_actions}</td>
                    <td className="py-2 pr-4">{hours}</td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-500">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
