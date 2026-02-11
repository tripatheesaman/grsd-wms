import { ProtectedLayout } from '../components/ProtectedLayout';
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
