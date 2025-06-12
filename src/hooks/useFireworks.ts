import type { FireworksHandlers } from '@fireworks-js/react';
import { type RefObject, useCallback, useEffect, useRef } from 'react';

type Props = {
  ref: RefObject<FireworksHandlers | null>;
};

export const useFireworks = ({ ref }: Props) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFireworks = useCallback(() => {
    if (!ref?.current || ref?.current?.isRunning) return;

    ref.current?.start();

    if (timeoutRef?.current) clearTimeout(timeoutRef?.current);

    timeoutRef.current = setTimeout(() => {
      if (!ref?.current) return;
      ref?.current?.stop();
    }, 5000);
  }, [ref]);

  const stopFireworks = useCallback(() => {
    if (!ref?.current || !ref?.current?.isRunning) return;
    ref?.current?.stop();
  }, [ref]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { startFireworks, stopFireworks };
};
