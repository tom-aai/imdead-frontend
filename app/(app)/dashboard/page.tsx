'use client';

import { Dashboard } from '@/components/dashboard';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

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
      />
    </div>
  );
}
