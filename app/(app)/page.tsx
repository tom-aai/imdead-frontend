import { headers } from 'next/headers';
import { App } from '@/components/app';
import { ProtectedRoute } from '@/components/protected-route';
import { getAppConfig } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{ resume?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const params = await searchParams;
  const resumeSessionId = params.resume || null;

  return (
    <ProtectedRoute>
      <App appConfig={appConfig} resumeSessionId={resumeSessionId} />
    </ProtectedRoute>
  );
}
