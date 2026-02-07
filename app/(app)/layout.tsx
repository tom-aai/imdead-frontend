import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import { ProtectedRoute } from '@/components/protected-route';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const hdrs = await headers();
  const { companyName, logo, logoDark } = await getAppConfig(hdrs);

  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}
