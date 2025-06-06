import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import type { ControlMode } from '../types';

interface PanVector {
  x: number;
  y: number;
  speed: number;
  inDeadZone: boolean;
}

interface UseMapControlProps {
  mapRef: React.RefObject<MapRef | null>;
  controlMode: ControlMode;
  panVector: PanVector | null;
}

export function useMapControl({ mapRef, controlMode, panVector }: UseMapControlProps) {
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (controlMode !== 'PANNING' || !panVector || panVector.inDeadZone || !mapRef.current) {
      // Stop any ongoing animation when not panning
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (!mapRef.current || controlMode !== 'PANNING' || !panVector || panVector.inDeadZone) {
        animationRef.current = null;
        return;
      }

      // Calculate delta time for consistent movement regardless of frame rate
      const deltaTime = currentTime - lastUpdateRef.current;
      lastUpdateRef.current = currentTime;

      // Base movement speed (pixels per second)
      const baseSpeed = 500; // Adjust this value to control overall sensitivity
      
      // Calculate movement distance based on speed, direction, and time
      const moveX = panVector.x * panVector.speed * baseSpeed * (deltaTime / 1000);
      const moveY = panVector.y * panVector.speed * baseSpeed * (deltaTime / 1000);

      // Apply movement to map
      try {
        const map = mapRef.current.getMap();
        if (map) {
          // Try panBy with duration 0 first
          map.panBy([moveX, moveY], { duration: 0 });
        } else {
          console.error('Map instance not found');
        }
      } catch (err) {
        console.error('Error panning map:', err);
      }

      // Continue animation
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    lastUpdateRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [controlMode, panVector, mapRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
}