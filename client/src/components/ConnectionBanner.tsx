// Reconnect banner: appears when socket.io detects a disconnect, fades out
// once reconnected. Sits above all content with role=status so screen readers
// announce it.

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCcw } from 'lucide-react';
import { getSocket } from '@/lib/socket';

type Phase = 'online' | 'disconnected' | 'reconnecting';

export function ConnectionBanner() {
  const [phase, setPhase] = useState<Phase>('online');

  useEffect(() => {
    const s = getSocket();
    function on()  { setPhase('online'); }
    function off() { setPhase('disconnected'); }
    function tryReconnect() { setPhase('reconnecting'); }

    s.on('connect', on);
    s.on('disconnect', off);
    s.io.on('reconnect_attempt', tryReconnect);
    s.io.on('reconnect', on);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
      s.io.off('reconnect_attempt', tryReconnect);
      s.io.off('reconnect', on);
    };
  }, []);

  if (phase === 'online') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 bg-amber text-navy-900 text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 print:hidden"
    >
      {phase === 'reconnecting' ? (
        <>
          <RefreshCcw size={14} className="animate-spin" />
          Reconnecting...
        </>
      ) : (
        <>
          <WifiOff size={14} />
          Connection lost. Attempting to reconnect.
        </>
      )}
    </div>
  );
}
