'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { NotificationBell } from './NotificationBell';
import Image from 'next/image';
import logo from '@/public/logo.png';

export const TopBar: React.FC = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, logout } = useAuth();

  if (!user) return null;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-gray-200 px-4 lg:px-6">
      <div className="h-full flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Image
            src={logo}
            alt="Nepal Airlines Logo"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            priority
            quality={100}
          />
          <h1 className="text-lg sm:text-xl font-semibold text-[#08398F] whitespace-nowrap">
            Work Order Management
          </h1>
        </div>

        <div className="flex items-center space-x-3 lg:space-x-4">
          <NotificationBell />
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">
              Welcome, {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-gray-500">{user.username} • {user.role}</p>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-10 h-10 bg-[#08398F] text-white rounded-full flex items-center justify-center font-semibold hover:bg-[#062a6b] transition-colors"
            >
              {getInitials(user.first_name, user.last_name)}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                <div className="py-1">
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}; 