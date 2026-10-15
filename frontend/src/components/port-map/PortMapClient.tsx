'use client';

import dynamic from 'next/dynamic';

const PortMap = dynamic(() => import('./PortMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      Loading port map...
    </div>
  ),
});

export default function PortMapClient() {
  return <PortMap />;
}
