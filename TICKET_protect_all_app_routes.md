# Ticket: Protect all (app) routes with authentication

## Problem

Currently, only `app/(app)/page.tsx` is wrapped with `<ProtectedRoute>`. The following routes under the `(app)` route group are **unprotected** and accessible without logging in:

- `/dashboard` — `app/(app)/dashboard/page.tsx`
- `/settings` — `app/(app)/settings/page.tsx`
- `/edit-avatar/[session_id]` — `app/(app)/edit-avatar/[session_id]/page.tsx`
- `/reclone-voice` — `app/(app)/reclone-voice/page.tsx`

## Solution

Move the `<ProtectedRoute>` wrapper from `app/(app)/page.tsx` into `app/(app)/layout.tsx` so that **all** routes in the `(app)` group are protected in one place.

### Changes required

**1. `app/(app)/layout.tsx`** — Add ProtectedRoute here

```tsx
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
```

**2. `app/(app)/page.tsx`** — Remove ProtectedRoute wrapper (now handled by layout)

```tsx
import { headers } from 'next/headers';
import { App } from '@/components/app';
import { getAppConfig } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{ resume?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const params = await searchParams;
  const resumeSessionId = params.resume || null;

  return <App appConfig={appConfig} resumeSessionId={resumeSessionId} />;
}
```

## Routes that should NOT be protected (already outside `(app)`)

These are correctly outside the `(app)` route group and must remain public:

- `/login` — Login page
- `/auth/callback` — OAuth callback
- `/chat/[share_token]` — Public chat links
- `/terms`, `/privacy`, `/biometric-policy` — Legal pages (under `(legal)`)

## Verification

After making changes, confirm:
- [ ] Visiting `/dashboard` while logged out redirects to `/login`
- [ ] Visiting `/settings` while logged out redirects to `/login`
- [ ] Visiting `/edit-avatar/xxx` while logged out redirects to `/login`
- [ ] Visiting `/reclone-voice` while logged out redirects to `/login`
- [ ] Visiting `/login` while logged in redirects to `/`
- [ ] All above routes work normally when logged in
- [ ] Public routes (`/chat/*`, `/terms`, etc.) remain accessible without login
