import { headers } from 'next/headers';
import { ProtectedRoute } from '@/components/protected-route';
import { getAppConfig } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const hdrs = await headers();
  const { companyName, logo, logoDark } = await getAppConfig(hdrs);

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
