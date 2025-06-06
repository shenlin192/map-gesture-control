import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import type { ControlMode } from '../types';

interface PanVector {
  x: number;
  y: number;
  speed: number;
  inDeadZone: boolean;
}

interface ZoomVector {
  zoomDelta: number;
  speed: number;
  isActive: boolean;
}

interface UseMapControlProps {
  mapRef: React.RefObject<MapRef | null>;
  controlMode: ControlMode;
  panVector: PanVector | null;
  zoomVector?: ZoomVector | null;
}

const shouldControlMap = (
  mapRef: React.RefObject<MapRef | null>, 
  controlMode: ControlMode, 
  panVector: PanVector | null,
  zoomVector?: ZoomVector | null
) => {
  if (!mapRef.current) return false;
  
  switch (controlMode) {
    case 'PANNING':
      return panVector && !panVector.inDeadZone;
    case 'ZOOMING':
      return zoomVector && zoomVector.isActive;
    default:
      return false;
  }
};

const calculateMapAction = (
  controlMode: ControlMode,
  deltaTime: number,
  panVector?: PanVector | null,
  zoomVector?: ZoomVector | null
) => {
  switch (controlMode) {
    case 'PANNING':
      if (!panVector) return null;
      const baseSpeed = 500; // pixels per second
      const moveX = panVector.x * panVector.speed * baseSpeed * (deltaTime / 1000);
      const moveY = panVector.y * panVector.speed * baseSpeed * (deltaTime / 1000);
      return { type: 'pan' as const, moveX, moveY };
      
    case 'ZOOMING':
      if (!zoomVector) return null;
      const zoomSpeed = 2; // zoom units per second
      const zoomChange = zoomVector.zoomDelta * zoomVector.speed * zoomSpeed * (deltaTime / 1000);
      return { type: 'zoom' as const, zoomChange };
      
    default:
      return null;
  }
};

// Helper function to apply map action
const applyMapAction = (map: any, action: ReturnType<typeof calculateMapAction>) => {
  if (!action || !map) return;
  
  try {
    switch (action.type) {
      case 'pan':
        map.panBy([action.moveX, action.moveY], { duration: 0 });
        break;
      case 'zoom':
        const currentZoom = map.getZoom();
        map.setZoom(currentZoom + action.zoomChange);
        break;
    }
  } catch (err) {
    console.error('Error applying map action:', err);
  }
};

export function useMapControl({ mapRef, controlMode, panVector, zoomVector }: UseMapControlProps) {
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!shouldControlMap(mapRef, controlMode, panVector, zoomVector)) {
      // Stop any ongoing animation when not controlling
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (!shouldControlMap(mapRef, controlMode, panVector, zoomVector)) {
        animationRef.current = null;
        return;
      }

      const deltaTime = currentTime - lastUpdateRef.current;
      lastUpdateRef.current = currentTime;

      const action = calculateMapAction(controlMode, deltaTime, panVector, zoomVector);
      
      if (action) {
        const map = mapRef.current!.getMap();
        applyMapAction(map, action);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    lastUpdateRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [controlMode, panVector, zoomVector, mapRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
}