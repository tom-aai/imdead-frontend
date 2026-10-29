'use client';

import { Button } from '@/components/ui/button';

interface LandingScreenProps {
  onStart: () => void;
}

export function LandingScreen({ onStart }: LandingScreenProps) {
  return (
    <section className="bg-background fixed inset-0 flex h-svh flex-col items-center justify-center px-4 text-center">
      <h1 className="font-mono text-6xl font-bold tracking-tight sm:text-7xl">I&apos;m Dead</h1>
      <p className="text-muted-foreground mt-4 max-w-md text-lg">
        Talk to yourself beyond the grave.
      </p>
      <Button variant="primary" size="lg" onClick={onStart} className="mt-10 w-48 font-mono">
        Start
      </Button>
    </section>
  );
}
