'use client';
import { useState } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { useAuth } from './AuthProvider';
interface ProtectedLayoutProps {
  children: React.ReactNode;
}
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
      </div>
    );
  }
  if (!user) {
    return null; 
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="pt-16 lg:pl-64">
        <div className="p-4 lg:p-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mb-4 p-2 bg-[#08398F] text-white rounded-lg"
            aria-label="Open sidebar"
          >
            ☰
          </button>
          {children}
        </div>
      </main>
    </div>
  );
} 