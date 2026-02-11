'use client';
import { ProtectedLayout } from '../components/ProtectedLayout';
export default function WorkOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
} 