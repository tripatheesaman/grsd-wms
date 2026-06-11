'use client';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastContext';
import { getApiBaseUrl } from '../../utils/api';
import { isStaffRole } from '@/app/lib/roles';
import {
  SuperadminSectionFilter,
  useSuperadminSectionFilter,
} from '../../components/SuperadminSectionFilter';
export default function ProgressReportPage() {
  const { user } = useAuth();
  const { filter: sectionFilter, setFilter: setSectionFilter, applySectionParam } =
    useSuperadminSectionFilter();
  const toast = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const effectiveSection = user?.role === 'superadmin' ? sectionFilter : user?.section;
  const isNemSection = effectiveSection === 'nem';
  const handleGenerateReport = async () => {
    if (!fromDate || !toDate) {
      toast.showError('Please select both from and to dates');
      return;
    }
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    if (fromDateObj > toDateObj) {
      toast.showError('From date cannot be after to date');
      return;
    }
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.showError('No authentication token found. Please log in again.');
        return;
      }
      const qs = new URLSearchParams({ fromDate, toDate });
      applySectionParam(qs);
      const reportRoute = isNemSection ? 'weekly-summary-report' : 'progress-report';
      const response = await fetch(`${getApiBaseUrl()}/reports/${reportRoute}?${qs.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          toast.showError('Unauthorized. Please log in again.');
          return;
        }
        if (response.status === 403) {
          toast.showError('Access denied. Only administrators can generate progress reports.');
          return;
        }
        throw new Error('Failed to generate report');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      a.download = filenameMatch?.[1] || (
        isNemSection
          ? `WeeklySummaryReport_${fromDate}_to_${toDate}.xlsx`
          : `ProgressReport_${fromDate}_to_${toDate}.xlsx`
      );
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.showSuccess(isNemSection ? 'Weekly summary report generated successfully' : 'Progress report generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.showError(isNemSection ? 'Error generating weekly summary report' : 'Error generating progress report');
    } finally {
      setIsGenerating(false);
    }
  };
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }
  if (!isStaffRole(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only incharge/admin users can access this report.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{isNemSection ? 'Weekly Summary Report' : 'Progress Report'}</h1>
          <p className="mt-2 text-gray-600">
            {isNemSection
              ? 'Generate weekly summary report for NEM tasks by date range.'
              : 'Generate a progress report showing work order statistics by type and date range.'}
          </p>
        </div>
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Report Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SuperadminSectionFilter value={sectionFilter} onChange={setSectionFilter} className="md:col-span-2" />
              <div>
                <Input
                  label="From Date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="To Date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-6">
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating || !fromDate || !toDate}
                className="w-full md:w-auto"
              >
                {isGenerating
                  ? 'Generating Report...'
                  : isNemSection
                    ? 'Generate Weekly Summary Report'
                    : 'Generate Progress Report'}
              </Button>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Report Categories:</h3>
              {isNemSection ? (
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Electrical:</strong> E</li>
                  <li>• <strong>Hydraulics:</strong> H</li>
                  <li>• <strong>Mechanical:</strong> M</li>
                  <li>• <strong>Schedule Check:</strong> SC</li>
                  <li>• <strong>Cargo Baggage:</strong> CB</li>
                  <li>• <strong>Fabrication:</strong> F</li>
                  <li>• <strong>Painting:</strong> P</li>
                  <li>• <strong>Others:</strong> O</li>
                </ul>
              ) : (
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Fabrication:</strong> All fabrication work</li>
                  <li>• <strong>Wheel & Tyre:</strong> Wheel and tyre related work combined</li>
                  <li>• <strong>Dent & Paint:</strong> Dent and paint work combined</li>
                  <li>• <strong>Battery & Electrical:</strong> Battery and electrical work combined</li>
                  <li>• <strong>ULD Containers:</strong> ULD container related work</li>
                  <li>• <strong>Mechanical:</strong> Mechanical work</li>
                  <li>• <strong>Miscellaneous:</strong> All other work types</li>
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
