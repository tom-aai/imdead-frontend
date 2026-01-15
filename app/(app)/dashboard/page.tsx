'use client';

import { Dashboard } from '@/components/dashboard';
import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if we just came from a finished session
  const justFinishedSession = searchParams.get('from_session') === 'true';

  const handleResumeSession = (sessionId: string) => {
    // Navigate to root with resume session query param
    router.push(`/?resume=${sessionId}`);
  };

  return (
    <div className="h-screen">
      <Dashboard
        disabled={false}
        onCreateNew={() => {
          router.push('/');
        }}
        onResumeSession={handleResumeSession}
        justFinishedSession={justFinishedSession}
      />
    </div>
  );
}
