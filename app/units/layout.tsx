import { ReactNode } from 'react';
import { ProtectedLayout } from '../components/ProtectedLayout';
interface Props {
  children: ReactNode;
}
export default function UnitsLayout({ children }: Props) {
  return (
    <ProtectedLayout>
      {children}
    </ProtectedLayout>
  );
}
