'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Notification } from '../types';
import { apiClient } from '../utils/api';
export const NotificationBell: React.FC = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Notification[]>('/notifications');
      if (response.success && response.data) {
        setNotifications(response.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);
  const markAsRead = async (notificationId: number) => {
    try {
      const response = await apiClient.put(`/notifications/${notificationId}`, {});
      if (response.success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
      }
    } catch {
    }
  };
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approval':
        return '✅';
      case 'rejection':
        return '❌';
      case 'completion':
        return '🎯';
      default:
        return 'ℹ️';
    }
  };
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date.toLocaleDateString('en-GB');
  };
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600">{unreadCount} unread</p>
            )}
          </div>
          <div className="p-2">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No notifications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      notification.is_read 
                        ? 'bg-gray-50 hover:bg-gray-100' 
                        : 'bg-blue-50 hover:bg-blue-100'
                    }`}
                    onClick={() => {
                      markAsRead(notification.id);
                      if (notification.related_entity_id && notification.related_entity_type === 'work_order') {
                        router.push(`/work-orders/${notification.related_entity_id}`);
                        setShowDropdown(false);
                      }
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium ${
                          notification.is_read ? 'text-gray-700' : 'text-blue-900'
                        }`}>
                          {notification.title}
                        </h4>
                        <p className={`text-sm mt-1 ${
                          notification.is_read ? 'text-gray-600' : 'text-blue-800'
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={() => setShowDropdown(false)}
                className="w-full text-sm text-blue-600 hover:text-blue-800 text-center"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
      {}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};
