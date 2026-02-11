'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer, { Toast, ToastType } from './Toast';
interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}
const ToastContext = createContext<ToastContextType | undefined>(undefined);
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
interface ToastProviderProps {
  children: React.ReactNode;
}
export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);
  const showToast = useCallback((
    type: ToastType, 
    title: string, 
    message?: string, 
    duration?: number
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      type,
      title,
      message,
      duration
    };
    setToasts(prev => [...prev, newToast]);
  }, []);
  const showSuccess = useCallback((title: string, message?: string) => {
    showToast('success', title, message);
  }, [showToast]);
  const showError = useCallback((title: string, message?: string) => {
    showToast('error', title, message, 7000); 
  }, [showToast]);
  const showWarning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message);
  }, [showToast]);
  const showInfo = useCallback((title: string, message?: string) => {
    showToast('info', title, message);
  }, [showToast]);
  const value = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}; 