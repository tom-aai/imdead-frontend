'use client';

import { Dashboard } from '@/components/dashboard';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="h-screen">
      <Dashboard
        disabled={false}
        onCreateNew={() => {
          router.push('/');
        }}
      />
    </div>
  );
}
