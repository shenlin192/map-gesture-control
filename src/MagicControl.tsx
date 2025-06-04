import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Category,
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import { EMASmoother } from './components/EMASmoother.ts';
import { calculateDistance } from './utils/geometry';
import type { MapRef } from 'react-map-gl/maplibre';
import ReactMap from './components/ReactMap.tsx';
import CameraView from './components/Camera.tsx';
import StatusDisplay from './components/Status.tsx';
import type { ControlMode, GestureStatus, GestureType } from './types.ts';

const MEDIAPIPE_GESTURE_MODEL_PATH: string =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';


/**
 * Main component for hand gesture control of the map
 */
function MagicControl() {
  // Refs
  const mapComponentContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPanPointRef = useRef<[number, number] | null>(null);
  const velocityRef = useRef<{ x: number; y: number; lastTime: number } | null>(
    null,
  );
  const flickMomentumRef = useRef<{
    vx: number;
    vy: number;
    startTime: number;
  } | null>(null);
  const lastFlickTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const requestRef = useRef<number | null>(null);

  // State
  const [gestureStatus, setGestureStatus] = useState<GestureStatus>(
    'Initializing Map...',
  );
  const [activeGesture, _setActiveGesture] = useState<GestureType>('NONE');
  const activeGestureRef = useRef<GestureType>('NONE');
  const [gestureRecLoaded, setGestureRecLoaded] = useState<boolean>(false);
  const [controlMode, setControlMode] = useState<ControlMode>('PAN');
  const modeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastModeSwitchTime = useRef<number>(0);
  const MODE_SWITCH_DELAY = 300; // ms

  // Keep ref in sync with state
  const setActiveGesture = useCallback((gesture: GestureType) => {
    activeGestureRef.current = gesture;
    _setActiveGesture(gesture);
  }, []);

  // Gesture tracking refs
  const initialPinchDistanceRef = useRef<number>(0);
  const initialPinchMidpointScreenRef = useRef<[number, number] | null>(null);
  const initialPanScreenPointRef = useRef<[number, number] | null>(null);
  const landmarkSmootherRef = useRef<EMASmoother[]>([]);
  const pinchDistanceSmootherRef = useRef<EMASmoother>(new EMASmoother(0.3));

  /**
   * Handles successful map load
   */
  const handleMapLoad = useCallback(() => {
    setGestureStatus('Map Loaded. Initializing MediaPipe...');
  }, []);

  const getScreenCoordinatesForMap = useCallback(
    (normalizedLandmark: NormalizedLandmark): [number, number] | null => {
      if (!mapComponentContainerRef.current || !mapRef.current) return null;
      const mapRect = mapComponentContainerRef.current.getBoundingClientRect();
      return [
        (1 - normalizedLandmark.x) * mapRect.width,
        normalizedLandmark.y * mapRect.height,
      ];
    },
    [],
  );

  const isIndexPointingCustom = useCallback(
    (landmarks: NormalizedLandmark[]): boolean => {
      if (!landmarks || landmarks.length === 0) return false;
      const hand = landmarks;
      const idxT = hand[8],
        idxP = hand[6],
        idxM = hand[5];
      const midT = hand[12],
        midP = hand[10];
      const rngT = hand[16],
        rngP = hand[14];
      const pkyT = hand[20],
        pkyP = hand[18];
      if (
        !idxT ||
        !idxP ||
        !idxM ||
        !midT ||
        !midP ||
        !rngT ||
        !rngP ||
        !pkyT ||
        !pkyP
      )
        return false;
      const indexExtended = idxT.y < idxP.y && idxP.y < idxM.y;
      const yTol = 0.04;
      const middleCurled = midT.y > midP.y - yTol;
      const ringCurled = rngT.y > rngP.y - yTol;
      const pinkyCurled = pkyT.y > pkyP.y - yTol;
      return indexExtended && middleCurled && ringCurled && pinkyCurled;
    },
    [],
  );

  const processGestures = useCallback(
    (
      landmarksList: NormalizedLandmark[][] | null,
      recognizedGestures?: Category[][],
    ): void => {
      const mapInstance = mapRef.current?.getMap();

      // Reset state if no landmarks or gestures detected
      if (!mapInstance || !landmarksList?.length) {
        if (activeGesture !== 'NONE') {
          setActiveGesture('NONE');
        }
        if (gestureStatus.startsWith('Webcam Active')) {
          setGestureStatus('Webcam Active. No hand detected.');
        }
        // Clear the last pan point when no hands are detected
        lastPanPointRef.current = null;
        return;
      }

      try {
        // Validate we have at least one hand
        if (!landmarksList?.length || !Array.isArray(landmarksList[0])) {
          console.debug('No valid hand data available');
          return;
        }

        // Process the first hand (for backward compatibility)
        const hand = landmarksList[0];

        // Validate first hand has enough landmarks
        if (hand.length < 21) {
          console.debug(
            'Incomplete hand data, expected 21 landmarks, got',
            hand.length,
          );
          return;
        }

        // Safely get landmarks with null checks for first hand
        const thumbTip = hand[4] || null;
        const indexTip = hand[8] || null;

        // Check if we have valid landmarks for first hand
        if (
          !thumbTip ||
          !indexTip ||
          thumbTip.x === undefined ||
          thumbTip.y === undefined ||
          indexTip.x === undefined ||
          indexTip.y === undefined
        ) {
          console.debug(
            'Missing or invalid thumb/index tip data for first hand',
          );
          return;
        }

        // Check for second hand if available
        let secondHand = null;
        let secondThumbTip = null;
        let secondIndexTip = null;

        if (landmarksList.length >= 2) {
          secondHand = landmarksList[1];
          if (secondHand && secondHand.length >= 21) {
            secondThumbTip = secondHand[4] || null;
            secondIndexTip = secondHand[8] || null;

            // Validate second hand landmarks
            if (
              !secondThumbTip ||
              !secondIndexTip ||
              secondThumbTip.x === undefined ||
              secondThumbTip.y === undefined ||
              secondIndexTip.x === undefined ||
              secondIndexTip.y === undefined
            ) {
              console.debug(
                'Missing or invalid thumb/index tip data for second hand',
              );
              secondHand = null; // Ignore second hand if invalid
            }
          }
        }

        // Safely get the recognized gesture name
        const currentRecGesture =
          recognizedGestures?.[0]?.[0]?.categoryName || 'NONE';
        const customPointing = isIndexPointingCustom(hand);

        // Calculate distance between thumb and index finger for first hand
        const currentDist = calculateDistance(thumbTip, indexTip);
        console.log('Current distance between thumb and index:', currentDist);

        // Clear any pending mode switch
        if (modeTimeoutRef.current) {
          clearTimeout(modeTimeoutRef.current);
        }

        // Check for two hands (zoom mode)
        const PINCH_THRESHOLD = 0.15; // Distance threshold for pinch detection
        const twoHandsDetected =
          landmarksList.length >= 2 && secondHand !== null;
        console.log(
          `Hands detected: ${landmarksList.length}, Two hands: ${twoHandsDetected}`,
        );

        // Process two-hand zoom if both hands are detected and valid
        if (twoHandsDetected) {
          try {
            // Calculate pinch distance for both hands
            const dist1 = calculateDistance(thumbTip, indexTip);
            const dist2 = calculateDistance(secondThumbTip, secondIndexTip);

            // Calculate midpoint between both pinches for zoom center
            const midX = (indexTip.x + secondIndexTip.x) / 2;
            const midY = (indexTip.y + secondIndexTip.y) / 2;
            const midPoint = { x: midX, y: midY };

            // Use average pinch distance for zoom level
            const avgPinchDistance = (dist1 + dist2) / 2;

            console.log(
              'Two-hand zoom - distance1:',
              dist1,
              'distance2:',
              dist2,
              'avg:',
              avgPinchDistance,
            );

            // Process two-hand zoom
            if (
              handlePinchToZoom(
                hand,
                thumbTip,
                indexTip,
                currentRecGesture,
                midPoint,
                avgPinchDistance,
              )
            ) {
              return;
            }
          } catch (error) {
            console.error('Error in two-hand zoom:', error);
            // Fall back to single-hand zoom if there's an error
            if (
              handlePinchToZoom(
                hand,
                thumbTip,
                indexTip,
                currentRecGesture,
                undefined,
                currentDist,
              )
            ) {
              return;
            }
          }
        } else {
          console.log(
            `Hands detected: ${landmarksList.length}, Two hands: ${twoHandsDetected}`,
          );
        }

        if (twoHandsDetected) {
          // Two-hand mode - always use zoom
          if (controlMode !== 'ZOOM') {
            console.log('Two hands detected - switching to ZOOM mode');
            setControlMode('ZOOM');
            lastModeSwitchTime.current = Date.now();
          }
        } else if (controlMode === 'ZOOM' && activeGesture === 'NONE') {
          // Only switch back to PAN if not currently in a zoom gesture
          modeTimeoutRef.current = setTimeout(() => {
            if (Date.now() - (lastModeSwitchTime.current || 0) > 300) {
              console.log('Switching to PAN mode');
              setControlMode('PAN');
            }
          }, 100);
        }

        // Handle the appropriate mode
        if (controlMode === 'ZOOM') {
          // Handle two-hand zoom if two hands are detected
          if (twoHandsDetected && landmarksList.length >= 2) {
            try {
              const secondHand = landmarksList[1];
              const secondThumbTip = secondHand[4];
              const secondIndexTip = secondHand[8];

              // Calculate midpoints for both hands
              const firstHandMid: NormalizedLandmark = {
                x: (thumbTip.x + indexTip.x) / 2,
                y: (thumbTip.y + indexTip.y) / 2,
                z: (thumbTip.z! + indexTip.z!) / 2,
                visibility: (thumbTip.visibility + indexTip.visibility) / 2,
              };

              const secondHandMid: NormalizedLandmark = {
                x: (secondThumbTip.x + secondIndexTip.x) / 2,
                y: (secondThumbTip.y + secondIndexTip.y) / 2,
                z: (secondThumbTip.z! + secondIndexTip.z!) / 2,
                visibility:
                  (secondThumbTip.visibility + secondIndexTip.visibility) / 2,
              };

              // Calculate distance between hands for two-hand zoom
              const handsDistance = calculateDistance(
                firstHandMid,
                secondHandMid,
              );
              const secondHandDist = calculateDistance(
                secondThumbTip,
                secondIndexTip,
              );
              const avgPinchDistance = (currentDist + secondHandDist) / 2;

              console.log(
                `Two-hand zoom - Hand1 dist: ${currentDist.toFixed(3)}, Hand2 dist: ${secondHandDist.toFixed(3)}, Hands distance: ${handsDistance.toFixed(3)}`,
              );

              // Use the average of both hands for zooming
              handlePinchToZoom(
                hand,
                thumbTip,
                indexTip,
                currentRecGesture,
                {
                  x: (firstHandMid.x + secondHandMid.x) / 2,
                  y: (firstHandMid.y + secondHandMid.y) / 2,
                  z: (firstHandMid.z! + secondHandMid.z!) / 2,
                },
                avgPinchDistance,
              );
            } catch (error) {
              console.error('Error in two-hand zoom:', error);
              // Fall back to single-hand zoom if there's an error
              if (
                handlePinchToZoom(
                  hand,
                  thumbTip,
                  indexTip,
                  currentRecGesture,
                  undefined,
                  currentDist,
                )
              ) {
                return;
              }
            }
          } else {
            // Single-hand zoom
            if (
              handlePinchToZoom(
                hand,
                thumbTip,
                indexTip,
                currentRecGesture,
                undefined,
                currentDist,
              )
            ) {
              // If we're not in a zoom gesture anymore, switch back to pan after a delay
              if (currentDist > 0.25) {
                // Only switch if fingers are not pinching
                modeTimeoutRef.current = setTimeout(() => {
                  if (Date.now() - (lastModeSwitchTime.current || 0) > 500) {
                    setControlMode('PAN');
                  }
                }, MODE_SWITCH_DELAY);
              }
              return;
            }
          }
        } else {
          // In pan mode, handle panning
          try {
            if (
              handlePanning(hand, indexTip, currentRecGesture, customPointing)
            ) {
              return;
            }
          } catch (error) {
            console.error('Error during panning:', error);
          }
        }

        // No active gesture, reset state if needed
        if (activeGesture !== 'NONE') {
          setActiveGesture('NONE');
          pinchDistanceSmootherRef.current.reset();
          initialPinchMidpointScreenRef.current = null;
        }

        // Update status with current mode and gesture
        setGestureStatus(
          `Mode: ${controlMode} | Gesture: ${currentRecGesture}`,
        );
      } catch (error) {
        console.error('Error processing gestures:', error);
      }
    },
    [activeGesture, gestureStatus, isIndexPointingCustom],
  );

  const handlePinchToZoom = (
    hand: NormalizedLandmark[],
    thumbTip: NormalizedLandmark,
    indexTip: NormalizedLandmark,
    currentRecGesture: string,
    customMidpoint?: { x: number; y: number; z: number },
    customDistance?: number,
  ): boolean => {
    try {
      const mapInstance = mapRef.current?.getMap();
      if (!mapInstance) {
        console.log('No map instance available');
        return false;
      }

      // Calculate current distance between fingers
      const currentDist =
        customDistance ?? calculateDistance(thumbTip, indexTip);
      const smoothedDist = pinchDistanceSmootherRef.current.smooth(currentDist);

      // Get current midpoint of the pinch, using custom midpoint if provided (for two-hand zoom)
      const midpoint = customMidpoint || {
        x: (thumbTip.x + indexTip.x) / 2,
        y: (thumbTip.y + indexTip.y) / 2,
        z: (thumbTip.z! + indexTip.z!) / 2,
      };

      console.log(midpoint);

      const currentMidpointScreen = getScreenCoordinatesForMap(
        midpoint as NormalizedLandmark,
      );
      if (!currentMidpointScreen) {
        console.log('Could not get screen coordinates for midpoint');
        return false;
      }

      console.log(
        `Zoom - Distance: ${smoothedDist.toFixed(3)}, Midpoint: (${midpoint.x.toFixed(3)}, ${midpoint.y.toFixed(3)})`,
      );

      console.log('Pinch zoom - distance:', smoothedDist.toFixed(3));

      // Check if we're starting a new pinch gesture
      if (activeGestureRef.current !== 'PINCHING') {
        // Start pinch gesture
        setActiveGesture('PINCHING');
        initialPinchDistanceRef.current = smoothedDist;
        initialPinchMidpointScreenRef.current = currentMidpointScreen;
        setGestureStatus('Pinch Start');
        console.log(
          'Pinch started - initial distance:',
          smoothedDist.toFixed(3),
        );
        return true;
      }

      // Get current zoom and map bounds
      const currentZoom = mapInstance.getZoom();
      const minZoom = mapInstance.getMinZoom?.() ?? 0;
      const maxZoom = mapInstance.getMaxZoom?.() ?? 22;

      // Calculate zoom based on pinch distance change
      const ZOOM_SENSITIVITY = 10.0; // Increased for more responsive zooming
      const zoomDelta =
        (initialPinchDistanceRef.current - smoothedDist) * ZOOM_SENSITIVITY;
      let newZoom = currentZoom + zoomDelta;

      console.log(
        'Zoom delta:',
        zoomDelta.toFixed(3),
        'New zoom:',
        newZoom.toFixed(3),
      );

      // Update the initial distance for the next frame
      initialPinchDistanceRef.current = smoothedDist;

      // Debug logging
      console.log(
        'Pinch Dist:',
        smoothedDist.toFixed(4),
        'Zoom Delta:',
        zoomDelta.toFixed(4),
        'Current Zoom:',
        currentZoom.toFixed(2),
        'New Zoom:',
        newZoom.toFixed(2),
      );

      // Clamp zoom to map bounds
      newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

      // Update the map
      if (Math.abs(newZoom - currentZoom) > 0.001) {
        mapInstance.setZoom(newZoom, {
          duration: 50,
          esstential: true,
        });
      }

      // Update gesture status for debugging
      setGestureStatus(
        `Zoom: ${newZoom.toFixed(2)} (${zoomDelta > 0 ? '+' : ''}${zoomDelta.toFixed(3)})`,
      );

      return true;
    } catch (error) {
      console.error('Error in pinch-to-zoom:', error);
      return false;
    }
  };

  const applyMomentum = useCallback(() => {
    if (!flickMomentumRef.current) return false;

    const now = Date.now();
    const { vx, vy, startTime } = flickMomentumRef.current;
    const elapsed = now - startTime;

    // Apply deceleration (friction)
    const DECELERATION = 0.95; // Adjust this value to control how quickly the momentum slows down
    const currentVx = vx * Math.pow(DECELERATION, elapsed / 16);
    const currentVy = vy * Math.pow(DECELERATION, elapsed / 16);

    // Stop momentum when velocity is very small
    if (Math.abs(currentVx) < 0.1 && Math.abs(currentVy) < 0.1) {
      flickMomentumRef.current = null;
      return false;
    }

    // Update the map
    const mapInstance = mapRef.current?.getMap();
    if (mapInstance) {
      mapInstance.panBy([-currentVx, -currentVy], {
        duration: 50,
        animate: true,
      });
    }

    // Update momentum
    flickMomentumRef.current = { vx: currentVx, vy: currentVy, startTime };
    return true;
  }, []);

  const handlePanning = (
    hand: NormalizedLandmark[],
    indexTip: NormalizedLandmark,
    currentRecGesture: string,
    customPointing: boolean,
  ): boolean => {
    try {
      console.log('handlePanning called with:', {
        hand,
        indexTip,
        currentRecGesture,
        customPointing,
      });

      const mapInstance = mapRef.current?.getMap();
      if (!mapInstance) {
        console.log('No map instance available');
        return false;
      }

      // Validate hand landmarks
      if (!hand || hand.length < 5) {
        console.error('Invalid hand data in handlePanning:', hand);
        return false;
      }

      // Calculate thumb-index distance to prevent panning during pinch
      const thumbTip = hand[4];
      if (!thumbTip || !indexTip) {
        console.error('Missing thumb or index tip:', { thumbTip, indexTip });
        return false;
      }

      const currentDist = calculateDistance(thumbTip, indexTip);
      const PAN_DISTANCE_THRESHOLD = 0.3; // Slightly higher than PINCH_START_THRESHOLD

      console.log(
        'Pan check - distance:',
        currentDist,
        'threshold:',
        PAN_DISTANCE_THRESHOLD,
      );

      // Only check for pinch interference if we're not already in a pan gesture
      if (
        activeGestureRef.current !== 'PANNING_POINTING_UP' &&
        activeGestureRef.current !== 'PANNING_CUSTOM' &&
        currentDist < PAN_DISTANCE_THRESHOLD
      ) {
        console.log('Fingers too close, likely a pinch');
        return false;
      }

      const isPointingUp = currentRecGesture === 'Pointing_Up';
      if (!isPointingUp && !customPointing) {
        console.log('Not pointing up and not custom pointing');
        return false;
      }

      const panMode = isPointingUp ? 'PANNING_POINTING_UP' : 'PANNING_CUSTOM';
      const statusText = isPointingUp
        ? 'Panning (Pointing Up)'
        : 'Panning (Custom Point)';
      setGestureStatus(statusText);
      console.log('Setting pan mode:', panMode);

      const currentPanScreenPoint = getScreenCoordinatesForMap(indexTip);
      if (!currentPanScreenPoint) {
        console.error('Could not get screen coordinates for index tip');
        return false;
      }
      console.log('Current pan screen point:', currentPanScreenPoint);

      // If this is the first frame of panning, just store the initial point
      if (activeGestureRef.current !== panMode) {
        console.log('Starting new pan gesture. Mode:', panMode);
        setActiveGesture(panMode);
        lastPanPointRef.current = currentPanScreenPoint;
        return true;
      }

      // Continue panning
      if (!lastPanPointRef.current) {
        console.error('No last pan point set');
        lastPanPointRef.current = currentPanScreenPoint;
        return false;
      }

      const now = Date.now();
      const timeSinceLastFlick = now - lastFlickTimeRef.current;

      // If we're still in the cooldown period after a flick, don't process panning
      if (timeSinceLastFlick < 300) {
        // 300ms cooldown after flick
        lastPanPointRef.current = currentPanScreenPoint;
        return true;
      }

      // Calculate movement since last frame
      const dxPixels = currentPanScreenPoint[0] - lastPanPointRef.current[0];
      const dyPixels = currentPanScreenPoint[1] - lastPanPointRef.current[1];
      const dt = now - (velocityRef.current?.lastTime || now);

      // Calculate velocity (pixels per ms)
      const vx = dt > 0 ? dxPixels / dt : 0;
      const vy = dt > 0 ? dyPixels / dt : 0;

      // Store velocity for flick detection
      velocityRef.current = { x: vx, y: vy, lastTime: now };

      // Detect flick (quick movement)
      const FLICK_THRESHOLD = 0.3; // Adjust this value to control flick sensitivity
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed > FLICK_THRESHOLD) {
        // Start momentum animation
        flickMomentumRef.current = {
          vx: vx * 20, // Multiply by a factor to make the flick more noticeable
          vy: vy * 20,
          startTime: now,
        };
        lastFlickTimeRef.current = now;
        console.log('Flick detected!', { vx, vy, speed });
        // Reset the last point to prevent jumping after flick
        lastPanPointRef.current = null;
        return true;
      }

      try {
        // Apply movement with some gain for better control
        const GAIN = 1.5;
        const scaledDx = dxPixels * GAIN;
        const scaledDy = dyPixels * GAIN;

        mapInstance.panBy([-scaledDx, -scaledDy], {
          duration: 50,
          animate: true,
        });
        lastPanPointRef.current = currentPanScreenPoint;
      } catch (panError) {
        console.error('Error during map pan:', panError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in panning:', error);
      return false;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      if (modeTimeoutRef.current) {
        clearTimeout(modeTimeoutRef.current);
      }

      // Stop any active animation frame
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }

      // Stop video stream if active
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // --- Initialize MediaPipe ---
  useEffect(() => {
    if (
      gestureRecognizerRef.current ||
      gestureStatus !== 'Map Loaded. Initializing MediaPipe...'
    ) {
      return;
    }

    /**
     * Initializes MediaPipe hand gesture recognition
     */
    const initializeMediaPipe = async () => {
      try {
        console.log('Initializing MediaPipe...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_GESTURE_MODEL_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        console.log('MediaPipe initialized successfully');
        gestureRecognizerRef.current = recognizer;
        console.log(gestureRecognizerRef.current);
        setGestureRecLoaded(true);
        landmarkSmootherRef.current = Array(21)
          .fill(null)
          .map(() => new EMASmoother(0.4));
        setGestureStatus('MediaPipe Ready. Starting Webcam...');
      } catch (err) {
        const errorMessage =
          'Error initializing MediaPipe: ' +
          (err instanceof Error ? err.message : 'Unknown error');
        console.error(errorMessage, err);
        setGestureStatus('Error initializing MediaPipe. Check console.');
      }
    };

    initializeMediaPipe();
  }, [gestureStatus]);

  // --- Initialize Webcam ---
  useEffect(() => {
    if (
      !gestureRecLoaded ||
      gestureStatus !== 'MediaPipe Ready. Starting Webcam...'
    ) {
      return;
    }

    let lastVideoTime = -1;
    let stream: MediaStream | null = null;

    /**
     * Sets up the webcam stream and starts the prediction loop
     */
    const setupWebcam = async () => {
      try {
        setGestureStatus('Starting Webcam...');

        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: 'user',
          },
          audio: false,
        });

        if (!videoRef.current) {
          throw new Error('Video element not found');
        }

        // Set up video element
        videoRef.current.srcObject = stream;

        return new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }

          videoRef.current.onloadedmetadata = () => {
            if (!videoRef.current) {
              reject(new Error('Video element not found'));
              return;
            }

            videoRef.current
              .play()
              .then(() => {
                // Initialize canvas context once video is playing
                if (canvasRef.current) {
                  const canvasCtx = canvasRef.current.getContext('2d');
                  if (canvasCtx) {
                    drawingUtilsRef.current = new DrawingUtils(canvasCtx);
                  }
                }
                setGestureStatus('Webcam Active. Waiting for gestures...');
                predictWebcamLoop();
                resolve();
              })
              .catch((err) => {
                console.error('Error playing video:', err);
                reject(new Error('Could not start video playback'));
              });
          };

          videoRef.current.onerror = () => {
            reject(new Error('Error loading video stream'));
          };
        });
      } catch (err) {
        const errorMessage =
          'Error accessing webcam: ' +
          (err instanceof Error ? err.message : 'Unknown error');
        console.error(errorMessage, err);
        setGestureStatus('Error accessing webcam. Check permissions.');
        throw err;
      }
    };

    const predictWebcamLoop = () => {
      // Apply momentum if active
      if (flickMomentumRef.current) {
        const momentumActive = applyMomentum();
        if (!momentumActive) {
          // Clear the last pan point when momentum ends to prevent jumping
          lastPanPointRef.current = null;
        }
      }

      if (!videoRef.current || videoRef.current.readyState < 2) {
        requestRef.current = requestAnimationFrame(predictWebcamLoop);
        return;
      }

      const currentTime = videoRef.current.currentTime;
      if (currentTime === lastVideoTime) {
        requestRef.current = requestAnimationFrame(predictWebcamLoop);
        return;
      }
      lastVideoTime = currentTime;

      const mapInstance = mapRef.current?.getMap();
      if (!mapInstance) {
        requestRef.current = requestAnimationFrame(predictWebcamLoop);
        return;
      }

      try {
        const startTimeMs = performance.now();
        const results = gestureRecognizerRef.current?.recognizeForVideo(
          videoRef.current,
          startTimeMs,
        );
        const canvasCtx = canvasRef.current?.getContext('2d');

        // Update canvas dimensions if needed
        if (canvasCtx && canvasRef.current && videoRef.current) {
          canvasCtx.save();
          canvasCtx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height,
          );

          // Only update dimensions if video is ready
          if (
            videoRef.current.videoWidth > 0 &&
            videoRef.current.videoHeight > 0
          ) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }

          // Process and draw landmarks if detected
          if (results?.landmarks?.length > 0) {
            // Process all detected hands
            const allHands = results.landmarks.map((handLandmarks) =>
              handLandmarks.map(
                (lm, idx) =>
                  landmarkSmootherRef.current[idx]?.smoothLandmark(lm) || lm,
              ),
            );

            // Process gestures with all hands
            processGestures(allHands, results.gestures);

            // Draw hand landmarks if drawing utils are available
            if (drawingUtilsRef.current) {
              allHands.forEach((handLandmarks) => {
                drawingUtilsRef.current.drawConnectors(
                  handLandmarks,
                  GestureRecognizer.HAND_CONNECTIONS,
                  { color: '#00FF00', lineWidth: 2 },
                );
                drawingUtilsRef.current.drawLandmarks(handLandmarks, {
                  color: '#FF0000',
                  lineWidth: 1,
                  radius: 3,
                });
              });
            }
          } else {
            // No landmarks detected
            processGestures([], undefined);
          }

          canvasCtx.restore();
        } else if (results?.landmarks?.length > 0) {
          // Fallback processing without canvas - process all hands
          const allHands = results.landmarks.map((handLandmarks) =>
            handLandmarks.map(
              (lm, idx) =>
                landmarkSmootherRef.current[idx]?.smoothLandmark(lm) || lm,
            ),
          );
          processGestures(allHands, results.gestures);
        } else {
          processGestures([], undefined);
        }
      } catch (err) {
        console.error('Error in prediction loop:', err);
      }

      // Schedule next frame
      requestRef.current = requestAnimationFrame(predictWebcamLoop);
    };

    setupWebcam().catch(console.error);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [gestureStatus, processGestures, gestureRecLoaded]);

  return (
    <div className="w-full flex flex-col h-screen bg-gray-800 text-white items-center p-4 font-sans">
      <h1 className="text-3xl font-bold mb-4">Mapbox Hand Gesture Control</h1>
      <div className="w-full flex flex-col md:flex-row gap-4">
        <ReactMap
          containerRef={mapComponentContainerRef}
          mapRef={mapRef}
          onMapLoad={handleMapLoad}
        />
        <div className="w-full md:w-1/3 flex flex-col items-center gap-3">
          <CameraView videoRef={videoRef} canvasRef={canvasRef} />
          <StatusDisplay
            gestureStatus={gestureStatus}
            activeGesture={activeGesture}
          />
        </div>
      </div>
    </div>
  );
}

export default MagicControl;
