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

export default function JobAllocationReportPage() {
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

    if (!isNemSection) {
      toast.showError('Job Allocation Report is available for NEM only.');
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

      const response = await fetch(
        `${getApiBaseUrl()}/reports/job-allocation-report?${qs.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          toast.showError('Unauthorized. Please log in again.');
          return;
        }
        if (response.status === 403) {
          toast.showError('Access denied.');
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
      a.download =
        filenameMatch?.[1] ||
        `JobAllocationReport_${fromDate}_to_${toDate}.xlsx`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.showSuccess('Job allocation report generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.showError('Error generating job allocation report');
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
          <h1 className="text-3xl font-bold text-gray-900">Job Allocation Report</h1>
          <p className="mt-2 text-gray-600">
            Weekly NEM work report for the selected date range.
          </p>
        </div>

        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Report Parameters</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SuperadminSectionFilter
                value={sectionFilter}
                onChange={setSectionFilter}
                className="md:col-span-2"
              />

              {!isNemSection && (
                <div className="md:col-span-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-900 text-sm">
                  Job Allocation Report is NEM only. Select <strong>NEM</strong> from the section filter.
                </div>
              )}

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
                disabled={isGenerating || !fromDate || !toDate || !isNemSection}
                className="w-full md:w-auto"
              >
                {isGenerating ? 'Generating Report...' : 'Generate Job Allocation Report'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

