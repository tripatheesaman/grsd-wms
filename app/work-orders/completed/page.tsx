'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { WorkOrder, WorkOrderFilters } from '@/app/types';
import { apiClient, getApiBaseUrl } from '@/app/utils/api';
import { useToast } from '@/app/components/ToastContext';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useAuth } from '@/app/components/AuthProvider';

interface CompletedWorkOrdersResponse {
  workOrders: WorkOrder[];
  total: number;
  page: number;
  totalPages: number;
}
export default function CompletedWorkOrdersPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<WorkOrderFilters>({
    page: 1,
    limit: 20
  });
  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await apiClient.get<CompletedWorkOrdersResponse>(`/work-orders/completed?${queryParams}`);
      if (response.success && response.data) {
        setWorkOrders(response.data.workOrders);
        setTotal(response.data.total);
        setCurrentPage(response.data.page);
        setTotalPages(response.data.totalPages);
      } else {
        toast.showError('Error', response.error || 'Failed to fetch completed work orders');
      }
    } catch {
      toast.showError('Error', 'An error occurred while fetching completed work orders');
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);
  useEffect(() => {
    fetchWorkOrders();
  }, [filters, fetchWorkOrders]);
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
      page: 1 
    }));
  };
  const handlePageChange = (page: number) => {
    setFilters(prev => ({
      ...prev,
      page
    }));
  };
  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20
    });
    setSearchQuery('');
  };
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-GB');
  };
  const generateReport = async (workOrderId: number) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/reports/work-order-sheet?workOrderId=${workOrderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `work-order-${workOrderId}-report.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.showSuccess('Success', 'Report generated successfully');
      } else {
        const errorData = await response.json();
        toast.showError('Error', errorData.error || 'Failed to generate report');
      }
         } catch {
       toast.showError('Error', 'Failed to generate report');
     }
  };
  const canGenerateReport = (workOrder: WorkOrder) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'superadmin') {
      return workOrder.status === 'completed';
    }
    return workOrder.status === 'completed' && workOrder.completion_approved_by;
  };
  const filteredWorkOrders = useMemo(() => {
    if (!searchQuery.trim()) return workOrders;
    const query = searchQuery.toLowerCase();
    return workOrders.filter(workOrder => 
      workOrder.work_order_no.toLowerCase().includes(query) ||
      workOrder.equipment_number.toLowerCase().includes(query) ||
      workOrder.work_type.toLowerCase().includes(query) ||
      workOrder.requested_by.toLowerCase().includes(query) ||
      (workOrder.description || '').toLowerCase().includes(query)
    );
  }, [workOrders, searchQuery]);
  if (loading && workOrders.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Completed Work Orders</h1>
            <p className="text-gray-600">Generate reports and manage completed tasks</p>
            {user && (user.role === 'user') && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">📊 Report Generation:</span> You can generate reports for work orders once their completion has been approved by an administrator.
                </p>
              </div>
            )}
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <span>🔍</span>
              <span>Filters</span>
              <span>{showFilters ? '▲' : '▼'}</span>
            </Button>
            <Button onClick={() => router.push('/work-orders/create')}>
              Create New Task
            </Button>
          </div>
        </div>
      </div>
      {}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <Input
            type="text"
            placeholder="Search by work order number, equipment, work type, requester, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-3 w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>
      {}
      {showFilters && (
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Equipment Number"
              name="equipment_number"
              type="text"
              value={filters.equipment_number || ''}
              onChange={handleFilterChange}
              placeholder="Filter by equipment"
            />
            <Input
              label="Work Type"
              name="work_type"
              type="text"
              value={filters.work_type || ''}
              onChange={handleFilterChange}
              placeholder="Filter by work type"
            />
            <Input
              label="Requested By"
              name="requested_by"
              type="text"
              value={filters.requested_by || ''}
              onChange={handleFilterChange}
              placeholder="Filter by requester"
            />
            <Input
              label="Date From"
              name="date_from"
              type="date"
              value={filters.date_from || ''}
              onChange={handleFilterChange}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <Input
              label="Date To"
              name="date_to"
              type="date"
              value={filters.date_to || ''}
              onChange={handleFilterChange}
            />
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear All Filters
              </Button>
            </div>
          </div>
        </Card>
      )}
      {}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <p className="text-gray-600">
              Showing <span className="font-medium">{filteredWorkOrders.length}</span> of <span className="font-medium">{total}</span> completed work orders
            </p>
            {searchQuery && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>
          {loading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Loading...</span>
            </div>
          )}
        </div>
      </div>
      {}
      {filteredWorkOrders.length === 0 && !loading ? (
        <Card className="text-center py-12">
          <div className="text-gray-500">
            <span className="w-16 h-16 mx-auto mb-4 text-gray-300 text-6xl">✅</span>
            <p className="text-lg font-medium mb-2">No completed work orders found</p>
            <p className="text-sm mb-4">
              {searchQuery ? `No results found for &ldquo;${searchQuery}&rdquo;` : 'Try adjusting your filters or search terms'}
            </p>
            <Button 
              onClick={() => router.push('/work-orders/create')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create First Work Order
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWorkOrders.map((workOrder) => (
            <Card key={workOrder.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-green-500">
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0">
                  {}
                  <div className="flex-1 space-y-4">
                    {}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-semibold text-gray-900 font-mono">
                          {workOrder.work_order_no}
                        </h3>
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          ✅ Completed
                        </span>
                      </div>
                    </div>
                    {}
                    {workOrder.description && (
                      <p className="text-sm text-gray-700 line-clamp-2">{workOrder.description}</p>
                    )}
                    {}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-lg">⚙️</span>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Equipment</p>
                          <p className="text-sm font-medium text-gray-900">{workOrder.equipment_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-lg">🔧</span>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Work Type</p>
                          <p className="text-sm font-medium text-gray-900">{workOrder.work_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-lg">👤</span>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Requested By</p>
                          <p className="text-sm font-medium text-gray-900">{workOrder.requested_by}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-lg">📅</span>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Order Date</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(workOrder.work_order_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-lg">📊</span>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">KM/Hrs</p>
                          <p className="text-sm font-medium text-gray-900">{workOrder.km_hrs || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-lg">📋</span>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Reference</p>
                          <p className="text-sm font-medium text-gray-900">{workOrder.reference_document || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {}
                  <div className="flex flex-col space-y-2 lg:ml-6">
                    {canGenerateReport(workOrder) && (
                      <Button
                        size="sm"
                        onClick={() => generateReport(workOrder.id)}
                        className="bg-[#08398F] hover:bg-[#062a6b] text-white flex items-center space-x-2 w-full lg:w-auto justify-center"
                      >
                        <span>📄</span>
                        <span>Generate Report</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/work-orders/${workOrder.id}`)}
                      className="flex items-center space-x-2 w-full lg:w-auto justify-center"
                    >
                      <span>👁️</span>
                      <span>View Details</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {}
      {totalPages > 1 && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="text-sm text-gray-600">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              {' '}(<span className="font-medium">{total}</span> total work orders)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center space-x-1"
              >
                <span>◀</span>
                <span>Previous</span>
              </Button>
              {}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "primary" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="w-10 h-10 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center space-x-1"
              >
                <span>Next</span>
                <span>▶</span>
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
} 