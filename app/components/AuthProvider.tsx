'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '../types';
import { PasswordChangeModal } from './PasswordChangeModal';
interface AuthContextType {
  user: Omit<User, 'password_hash'> | null;
  loading: boolean;
  login: (token: string, userData: Omit<User, 'password_hash'>) => void;
  logout: () => void;
  refreshUser: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Omit<User, 'password_hash'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    setMounted(true);
  }, []);
  const refreshUser = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch {
        console.error('Error parsing user data');
      }
    }
  };
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        if (parsedUser.first_login && pathname !== '/auth/login') {
          setShowPasswordModal(true);
        } else if (pathname === '/auth/login') {
          setTimeout(() => {
            router.replace('/dashboard');
          }, 100);
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (pathname !== '/auth/login') {
          setTimeout(() => {
            router.replace('/auth/login');
          }, 100);
        }
      }
    } else {
      if (pathname !== '/auth/login' && pathname !== '/') {
        setTimeout(() => {
          router.replace('/auth/login');
        }, 100);
      } else if (pathname === '/') {
        setTimeout(() => {
          router.replace('/auth/login');
        }, 100);
      }
    }
    setLoading(false);
  }, [pathname, router, mounted]);
  const login = (token: string, userData: Omit<User, 'password_hash'>) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    if (userData.first_login) {
      setShowPasswordModal(true);
    } else {
      setTimeout(() => {
        router.replace('/dashboard');
      }, 100);
    }
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowPasswordModal(false);
    setTimeout(() => {
      router.replace('/auth/login');
    }, 100);
  };
  const handlePasswordChangeSuccess = () => {
    if (user) {
      const updatedUser = { ...user, first_login: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setShowPasswordModal(false);
      setTimeout(() => {
        router.replace('/dashboard');
      }, 100);
    }
  };
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, loading: true, login, logout, refreshUser }}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
        </div>
      </AuthContext.Provider>
    );
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
      {}
      {showPasswordModal && (
        <PasswordChangeModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 