// Types for better type safety
export type GestureType =
  | 'NONE'
  | 'PINCHING'
  | 'PANNING_POINTING_UP'
  | 'PANNING_CUSTOM';

export type ControlMode = 'PANNING' | 'ZOOM_IN' | 'ZOOM_OUT' | 'IDLE';

export type GestureStatus =
  | 'Initializing Map...'
  | 'Map Loaded. Initializing MediaPipe...'
  | 'MediaPipe Ready. Starting Webcam...'
  | 'Starting Webcam...'
  | 'Webcam Active. Waiting for gestures...'
  | 'Webcam Active. No hand detected.'
  | `Webcam Active. Detected: ${string}`
  | `Pinch Detected (Dist: ${string})`
  | 'Panning (Pointing Up)'
  | 'Panning (Custom Point)'
  | 'Error initializing MediaPipe. Check console.'
  | 'Error accessing webcam. Check permissions.';
