import { headers } from 'next/headers';
import { App } from '@/components/app';
import { ProtectedRoute } from '@/components/protected-route';
import { getAppConfig } from '@/lib/utils';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <ProtectedRoute>
      <App appConfig={appConfig} />
    </ProtectedRoute>
  );
}
