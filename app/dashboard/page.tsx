'use client';

import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { apiClient } from '../utils/api';
import { DashboardStats } from '../types';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import Image from 'next/image';
import nacIcon from '@/public/nac_icon.png';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    ongoing: 0,
    completed: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<DashboardStats>('/dashboard/stats');
        if (response.success && response.data) {
          setStats(response.data);
        } else {
          setError(response.error || 'Failed to fetch dashboard stats');
        }
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      setError('Request timed out. Please try again.');
      setLoading(false);
    }, 5000); 

    fetchStats().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, []);

  const Header = (
    <div>
      <div className="flex items-center space-x-3 mb-2">
        <Image 
          src={nacIcon} 
          alt="NAC Icon" 
          width={32}
          height={32}
          className="w-8 h-8 object-contain"
          priority
        />
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>
      <p className="text-gray-600">Welcome to your work order management dashboard</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {Header}
        <Card className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {Header}
        <Card className="text-center py-12">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#08398F] text-white rounded-lg hover:bg-[#062a6b] transition-colors"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Header}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="text-center">
          <div className="w-12 h-12 bg-[#08398F] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">🔄</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.ongoing}</h3>
          <p className="text-gray-600">Ongoing Tasks</p>
        </Card>
        <Card className="text-center">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">✅</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.completed}</h3>
          <p className="text-gray-600">Completed Tasks</p>
        </Card>
        <Card className="text-center">
          <div className="w-12 h-12 bg-[#08398F] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl">📋</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.total}</h3>
          <p className="text-gray-600">Total Work Orders</p>
        </Card>
      </div>

      {user && (user.role === 'admin' || user.role === 'superadmin') && (
        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Pending Completion Requests</h3>
              <p className="text-yellow-700 text-sm">Review and approve work order completion requests</p>
            </div>
            <button 
              onClick={() => router.push('/work-orders/completion-requests')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              View Requests
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => router.push('/work-orders/create')}
              className="w-full text-left p-3 bg-[#08398F] text-white rounded-lg hover:bg-[#062a6b] transition-colors"
            >
              ➕ Create New Work Order
            </button>
            <button 
              onClick={() => router.push('/work-orders/pending')}
              className="w-full text-left p-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              ⏳ View Pending Approvals
            </button>
            <button 
              onClick={() => router.push('/work-orders/ongoing')}
              className="w-full text-left p-3 bg-[#08398F] text-white rounded-lg hover:bg-[#062a6b] transition-colors"
            >
              🔄 View Ongoing Tasks
            </button>
            <button 
              onClick={() => router.push('/work-orders/completed')}
              className="w-full text-left p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              ✅ View Completed Tasks
            </button>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-[#08398F] rounded-full"></div>
              <div>
                <p className="text-sm font-medium">New work order created</p>
                <p className="text-xs text-gray-500">WO-2024-001</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Task completed</p>
                <p className="text-xs text-gray-500">WO-2024-002</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 bg-[#08398F] rounded-full"></div>
              <div>
                <p className="text-sm font-medium">New finding added</p>
                <p className="text-xs text-gray-500">WO-2024-003</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
} 