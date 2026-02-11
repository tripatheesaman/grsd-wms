'use client';
import { useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/ToastContext';
import { validateRequired } from '../../utils/validation';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiClient } from '../../utils/api';
import { LoginRequest, LoginResponse } from '../../types';
import Image from 'next/image';
import logo from '@/public/logo.png';
export default function LoginPage() {
  const [formData, setFormData] = useState<LoginRequest>({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const toast = useToast();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const usernameError = validateRequired(formData.username, 'Username');
    const passwordError = validateRequired(formData.password, 'Password');
    if (usernameError) {
      toast.showError('Validation Error', usernameError.message);
      return;
    }
    if (passwordError) {
      toast.showError('Validation Error', passwordError.message);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', formData);
      if (response.success && response.data) {
        login(response.data.token, response.data.user);
        toast.showSuccess('Login successful');
      } else {
        setError(response.error || 'Login failed');
        toast.showError('Login failed', response.error);
      }
    } catch {
      setError('An error occurred during login');
      toast.showError('Login Error', 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08398F] to-[#062a6b] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Image 
              src={logo} 
              alt="Nepal Airlines Logo" 
              width={128}
              height={64}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <p className="text-gray-600 mt-2">Work Order Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            required
            placeholder="Enter your username"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
          />
          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
          <Button
            type="submit"
            loading={loading}
            className="w-full"
            size="lg"
          >
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
} 