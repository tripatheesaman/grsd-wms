'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}
interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}
const ToastItem = ({ toast, onRemove }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };
  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };
  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };
  return (
    <div
      className={`
        ${getBgColor()} ${getTextColor()}
        border rounded-lg p-4 shadow-lg max-w-sm w-full
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          <span className="text-lg">{getIcon()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm mt-1 opacity-90">{toast.message}</p>
          )}
        </div>
        <div className="flex-shrink-0 ml-3">
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => onRemove(toast.id), 300);
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}
const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed top-20 right-4 z-[9999] space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
};
export default ToastContainer; 