'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WorkOrder } from '@/app/types';
import { apiClient } from '@/app/utils/api';
import { useToast } from '@/app/components/ToastContext';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';
import { useAuth } from '@/app/components/AuthProvider';
interface CompletionRequest extends WorkOrder {
  completion_requested_by_username?: string;
  completion_requested_by_first_name?: string;
  completion_requested_by_last_name?: string;
}
export default function CompletionRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [completionRequests, setCompletionRequests] = useState<CompletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [workOrderToReject, setWorkOrderToReject] = useState<number | null>(null);
  const fetchCompletionRequests = useCallback(async () => {
    try {
      const response = await apiClient.get<CompletionRequest[]>('/work-orders/completion-requests');
      if (response.success && response.data) {
        setCompletionRequests(response.data);
      } else {
        toast.showError('Error', response.error || 'Failed to fetch completion requests');
      }
    } catch {
      toast.showError('Error', 'Failed to fetch completion requests');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      fetchCompletionRequests();
    }
  }, [user, fetchCompletionRequests]);
  const handleApproveCompletion = async (workOrderId: number) => {
    try {
      const response = await apiClient.put(`/work-orders/${workOrderId}/approve-completion`, {
        approved: true
      });
      if (response.success) {
        toast.showSuccess('Success', 'Work order completion approved successfully');
        fetchCompletionRequests(); 
      } else {
        toast.showError('Error', response.error || 'Failed to approve completion');
      }
    } catch {
      toast.showError('Error', 'Failed to approve completion');
    }
  };
  const handleRejectCompletion = async (workOrderId: number, rejectionReason: string) => {
    try {
      const response = await apiClient.put(`/work-orders/${workOrderId}/approve-completion`, {
        approved: false,
        rejection_reason: rejectionReason
      });
      if (response.success) {
        toast.showSuccess('Success', 'Work order completion rejected');
        fetchCompletionRequests(); 
        setShowRejectModal(false);
        setRejectReason('');
        setWorkOrderToReject(null);
      } else {
        toast.showError('Error', response.error || 'Failed to reject completion');
      }
    } catch {
      toast.showError('Error', 'Failed to reject completion');
    }
  };
  const openRejectModal = (workOrderId: number) => {
    setWorkOrderToReject(workOrderId);
    setShowRejectModal(true);
    setRejectReason(''); 
  };
  const confirmReject = () => {
    if (workOrderToReject && rejectReason.trim()) {
      handleRejectCompletion(workOrderToReject, rejectReason.trim());
    }
  };
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-GB');
  };
  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleString('en-GB');
  };
  if (!user || user.role === 'user') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to access completion requests.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Completion Requests</h1>
          <p className="text-gray-600">
            {user.role === 'admin' 
              ? 'View pending work order completion requests (approval requires superadmin access)'
              : 'Review and approve pending work order completion requests'
            }
          </p>
        </div>
      </div>
      {completionRequests.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No pending completion requests found</p>
            <p className="text-gray-400 text-sm mt-2">All completion requests have been processed</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {completionRequests.map((workOrder) => (
            <Card key={workOrder.id} className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {workOrder.work_order_no}
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                      Completion Requested
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                    <div>
                      <span className="font-medium">Equipment:</span> {workOrder.equipment_number}
                    </div>
                    <div>
                      <span className="font-medium">Work Type:</span> {workOrder.work_type}
                    </div>
                    <div>
                      <span className="font-medium">Requested By:</span> {workOrder.requested_by}
                    </div>
                    <div>
                      <span className="font-medium">Order Date:</span> {formatDate(workOrder.work_order_date)}
                    </div>
                    <div>
                      <span className="font-medium">KM/Hrs:</span> {workOrder.km_hrs || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Allocated:</span> {formatDateTime(workOrder.job_allocation_time)}
                    </div>
                  </div>
                  {}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-blue-900 mb-2">Completion Request Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-800">Requested by:</span> 
                        <span className="ml-2 text-blue-700">
                          {workOrder.completion_requested_by_first_name} {workOrder.completion_requested_by_last_name}
                          {workOrder.completion_requested_by_username && ` (${workOrder.completion_requested_by_username})`}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Requested on:</span> 
                        <span className="ml-2 text-blue-700">
                          {workOrder.completion_requested_at ? formatDateTime(workOrder.completion_requested_at) : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Completion date:</span> 
                        <span className="ml-2 text-blue-700">
                          {workOrder.work_completed_date ? formatDate(workOrder.work_completed_date) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/work-orders/${workOrder.id}`)}
                  >
                    View Details
                  </Button>
                  {}
                  {user.role === 'superadmin' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApproveCompletion(workOrder.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        ✅ Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectModal(workOrder.id)}
                        className="text-red-600 hover:text-red-800 border-red-300"
                      >
                        ❌ Reject
                      </Button>
                    </>
                  ) : (
                    <div className="text-xs text-gray-500 text-center px-2 py-1 bg-gray-100 rounded">
                      View Only
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="text-2xl mr-3 text-red-600">⚠️</div>
                <h3 className="text-lg font-semibold text-gray-900">Reject Completion Request</h3>
              </div>
              <p className="text-gray-600 mb-4">Please provide a reason for rejecting this completion request:</p>
              <textarea
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                }}
                placeholder="Enter rejection reason..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                rows={3}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <div className="flex space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setWorkOrderToReject(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmReject}
                  disabled={!rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Reject Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
