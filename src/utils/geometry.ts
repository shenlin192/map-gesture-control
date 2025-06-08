import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Calculates the Euclidean distance between two 3D landmarks.
 * @param p1 The first landmark.
 * @param p2 The second landmark.
 * @returns The distance, or Infinity if either landmark is undefined.
 */
export const calculateDistance = (
  p1?: NormalizedLandmark,
  p2?: NormalizedLandmark,
): number => {
  if (!p1 || !p2) return Infinity;
  // The z-coordinate might be undefined, default to 0 if so.
  const z1 = p1.z ?? 0;
  const z2 = p2.z ?? 0;
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(z1 - z2, 2),
  );
};

/**
 * Calculates the angle in degrees between two vectors from a common origin.
 * @param origin The common origin point.
 * @param point1 The first point.
 * @param point2 The second point.
 * @returns The angle in degrees, or 0 if any landmark is undefined.
 */
export const calculateAngle = (
  origin?: NormalizedLandmark,
  point1?: NormalizedLandmark,
  point2?: NormalizedLandmark,
): number => {
  if (!origin || !point1 || !point2) return 0;
  
  // Create vectors from origin to each point
  const vector1 = {
    x: point1.x - origin.x,
    y: point1.y - origin.y,
    z: (point1.z ?? 0) - (origin.z ?? 0)
  };
  
  const vector2 = {
    x: point2.x - origin.x,
    y: point2.y - origin.y,
    z: (point2.z ?? 0) - (origin.z ?? 0)
  };
  
  // Calculate dot product
  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;
  
  // Calculate magnitudes
  const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y + vector1.z * vector1.z);
  const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y + vector2.z * vector2.z);
  
  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  // Calculate cosine of angle
  const cosAngle = dotProduct / (magnitude1 * magnitude2);
  
  // Clamp to valid range for acos [-1, 1]
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  
  // Calculate angle in radians and convert to degrees
  const angleRad = Math.acos(clampedCos);
  const angleDeg = angleRad * (180 / Math.PI);
  
  return angleDeg;
};
