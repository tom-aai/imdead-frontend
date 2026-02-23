import React from 'react';
import { motion } from 'motion/react';
import { VideoTrack } from '@livekit/components-react';
import { cn } from '@/lib/utils';

const MotionVideoTrack = motion.create(VideoTrack);

export const VideoTile = ({
  trackRef,
  className,
  ref,
}: React.ComponentProps<'div'> & React.ComponentProps<typeof VideoTrack>) => {
  return (
    <div ref={ref} className={cn('bg-muted overflow-hidden rounded-md', className)}>
      <MotionVideoTrack trackRef={trackRef} className={cn('h-full w-full object-cover')} />
    </div>
  );
};
