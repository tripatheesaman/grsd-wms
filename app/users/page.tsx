'use client';
import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiClient } from '../utils/api';
import { useToast } from '../components/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../components/AuthProvider';
import { ConfirmationModal } from '../components/ConfirmationModal';
interface UserFormData {
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  role: 'user' | 'admin' | 'superadmin';
}
export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    first_name: '',
    last_name: '',
    password: '',
    role: 'user'
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiClient.get<User[]>('/users');
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        toast.showError('Error', response.error || 'Failed to fetch users');
      }
    } catch {
      toast.showError('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    if (user && user.role === 'superadmin') {
      fetchUsers();
    }
  }, [user, fetchUsers]);
  const resetForm = () => {
    setFormData({
      username: '',
      first_name: '',
      last_name: '',
      password: '',
      role: 'user'
    });
    setEditingUser(null);
    setShowForm(false);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      toast.showError('Validation Error', 'Username, first name, and last name are required');
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      toast.showError('Validation Error', 'Password is required for new users');
      return;
    }
    try {
      if (editingUser) {
        const updateData = {
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          ...(formData.password.trim() && { password: formData.password })
        };
        const response = await apiClient.put<User>(`/users/${editingUser.id}`, updateData);
        if (response.success) {
          toast.showSuccess('Success', 'User updated successfully');
          resetForm();
          fetchUsers();
        } else {
          toast.showError('Error', response.error || 'Failed to update user');
        }
      } else {
        const response = await apiClient.post<User>('/users', formData);
        if (response.success) {
          toast.showSuccess('Success', 'User created successfully');
          resetForm();
          fetchUsers();
        } else {
          toast.showError('Error', response.error || 'Failed to create user');
        }
      }
          } catch {
        toast.showError('Error', 'An error occurred');
      }
  };
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      password: '', 
      role: user.role
    });
    setShowForm(true);
  };
    const handleDelete = async (userToDelete: User) => {
    setUserToDelete(userToDelete);
    setShowDeleteModal(true);
  };
  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const response = await apiClient.delete(`/users/${userToDelete.id}`);
      if (response.success) {
        toast.showSuccess('Success', 'User deleted successfully');
        fetchUsers();
      } else {
        toast.showError('Error', response.error || 'Failed to delete user');
      }
    } catch {
      toast.showError('Error', 'Failed to delete user');
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };
  if (!user || user.role !== 'superadmin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">Only superadmins can access user management.</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage system users and their roles</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          ➕ Add User
        </Button>
      </div>
      {}
      {showForm && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter username"
                required
              />
              <Input
                label="First Name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Enter first name"
                required
              />
              <Input
                label="Last Name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Enter last name"
                required
              />
              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
                required={!editingUser}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'user' | 'admin' | 'superadmin' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#08398F] focus:border-[#08398F]"
                required
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <Button type="submit">
                {editingUser ? 'Update User' : 'Add User'}
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
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Users List</h2>
        {users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
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
                {users.map((userItem) => (
                  <tr key={userItem.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {userItem.first_name} {userItem.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{userItem.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        userItem.role === 'superadmin'
                          ? 'bg-purple-100 text-purple-800'
                          : userItem.role === 'admin'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(userItem.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(userItem)}
                        >
                          ✏️ Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(userItem)}
                          className="text-red-600 hover:text-red-800"
                          disabled={userItem.id === user.id}
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
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.first_name} ${userToDelete?.last_name}?`}
        confirmText="Delete User"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
}
