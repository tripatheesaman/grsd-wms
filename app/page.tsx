'use client';
import { useAuth } from './components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
export default function Home() {
  const { loading, user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    } else if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
      </main>
    );
  }
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
    </main>
  );
}
