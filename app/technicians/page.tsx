'use client';
import { useState, useEffect, useCallback } from 'react';
import { Technician } from '../types';
import { apiClient } from '../utils/api';
import { useToast } from '../components/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../components/AuthProvider';
import { ConfirmationModal } from '../components/ConfirmationModal';
interface TechnicianFormData {
  name: string;
  staff_id: string;
  designation: string;
  is_available: boolean;
}
export default function TechniciansPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [formData, setFormData] = useState<TechnicianFormData>({
    name: '',
    staff_id: '',
    designation: '',
    is_available: true
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null);
  const fetchTechnicians = useCallback(async () => {
    try {
      const response = await apiClient.get<Technician[]>('/technicians');
      if (response.success && response.data) {
        setTechnicians(response.data);
      } else {
        toast.showError('Error', response.error || 'Failed to fetch technicians');
      }
    } catch {
      toast.showError('Error', 'Failed to fetch technicians');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      fetchTechnicians();
    }
  }, [user, fetchTechnicians]);
  const resetForm = () => {
    setFormData({
      name: '',
      staff_id: '',
      designation: '',
      is_available: true
    });
    setEditingTechnician(null);
    setShowForm(false);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.staff_id.trim()) {
      toast.showError('Validation Error', 'Name and Staff ID are required');
      return;
    }
    try {
      if (editingTechnician) {
        const response = await apiClient.put<Technician>(`/technicians/${editingTechnician.id}`, formData);
        if (response.success) {
          toast.showSuccess('Success', 'Technician updated successfully');
          resetForm();
          fetchTechnicians();
        } else {
          toast.showError('Error', response.error || 'Failed to update technician');
        }
      } else {
        const response = await apiClient.post<Technician>('/technicians', formData);
        if (response.success) {
          toast.showSuccess('Success', 'Technician created successfully');
          resetForm();
          fetchTechnicians();
        } else {
          toast.showError('Error', response.error || 'Failed to create technician');
        }
      }
          } catch {
        toast.showError('Error', 'An error occurred');
      }
  };
  const handleEdit = (technician: Technician) => {
    setEditingTechnician(technician);
    setFormData({
      name: technician.name,
      staff_id: technician.staff_id,
      designation: technician.designation || '',
      is_available: technician.is_available
    });
    setShowForm(true);
  };
    const handleDelete = async (technician: Technician) => {
    setTechnicianToDelete(technician);
    setShowDeleteModal(true);
  };
  const confirmDelete = async () => {
    if (!technicianToDelete) return;
    try {
      const response = await apiClient.delete(`/technicians/${technicianToDelete.id}`);
      if (response.success) {
        toast.showSuccess('Success', 'Technician deleted successfully');
        fetchTechnicians();
      } else {
        toast.showError('Error', response.error || 'Failed to delete technician');
      }
    } catch {
      toast.showError('Error', 'Failed to delete technician');
    } finally {
      setShowDeleteModal(false);
      setTechnicianToDelete(null);
    }
  };
  const handleToggleAvailability = async (technician: Technician) => {
    try {
      const response = await apiClient.put<Technician>(`/technicians/${technician.id}`, {
        ...technician,
        is_available: !technician.is_available
      });
      if (response.success && response.data) {
        toast.showSuccess('Success', `Technician ${response.data.is_available ? 'activated' : 'deactivated'} successfully`);
        fetchTechnicians();
      } else {
        toast.showError('Error', response.error || 'Failed to update technician availability');
      }
          } catch {
        toast.showError('Error', 'Failed to update technician availability');
      }
  };
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Technicians Management</h1>
          <p className="text-gray-600">Manage technician accounts and availability</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          ➕ Add Technician
        </Button>
      </div>
      {}
      {showForm && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingTechnician ? 'Edit Technician' : 'Add New Technician'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter technician name"
                required
              />
              <Input
                label="Staff ID"
                value={formData.staff_id}
                onChange={(e) => setFormData(prev => ({ ...prev, staff_id: e.target.value }))}
                placeholder="Enter staff ID"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Designation"
                value={formData.designation}
                onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                placeholder="Enter designation (e.g., Senior Technician, Engineer)"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_available"
                checked={formData.is_available}
                onChange={(e) => setFormData(prev => ({ ...prev, is_available: e.target.checked }))}
                className="rounded border-gray-300 text-[#08398F] focus:ring-[#08398F]"
              />
              <label htmlFor="is_available" className="text-sm font-medium text-gray-700">
                Available for work
              </label>
            </div>
            <div className="flex space-x-3">
              <Button type="submit">
                {editingTechnician ? 'Update Technician' : 'Add Technician'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      {}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Technicians List</h2>
        {technicians.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No technicians found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {technicians.map((technician) => (
                  <tr key={technician.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{technician.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{technician.staff_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{technician.designation || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        technician.is_available
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {technician.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(technician.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAvailability(technician)}
                        >
                          {technician.is_available ? '🔄 Deactivate' : '✅ Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(technician)}
                        >
                          ✏️ Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(technician)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️ Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Technician"
        message={`Are you sure you want to delete ${technicianToDelete?.name}?`}
        confirmText="Delete Technician"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setTechnicianToDelete(null);
        }}
      />
    </div>
  );
}
