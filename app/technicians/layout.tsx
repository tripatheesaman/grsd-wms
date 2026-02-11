'use client';
import { ProtectedLayout } from '../components/ProtectedLayout';
export default function TechniciansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
