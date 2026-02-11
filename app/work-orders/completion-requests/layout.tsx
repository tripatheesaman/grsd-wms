'use client';
import { ProtectedLayout } from '../../components/ProtectedLayout';
export default function CompletionRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
