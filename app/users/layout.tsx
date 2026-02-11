"use client";
import { ProtectedLayout } from '../components/ProtectedLayout';
export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
