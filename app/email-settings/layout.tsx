'use client';

import { ProtectedLayout } from '../components/ProtectedLayout';

export default function EmailSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
