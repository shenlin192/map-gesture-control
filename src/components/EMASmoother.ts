import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export class EMASmoother {
  private alpha: number;
  private lastSValue: number | null;
  private lastLValue: NormalizedLandmark | null;

  constructor(alpha: number = 0.5) {
    this.alpha = alpha;
    this.lastSValue = null;
    this.lastLValue = null;
  }

  smooth(value: number): number {
    if (this.lastSValue === null) {
      this.lastSValue = value;
      return value;
    }
    const smoothedValue =
      this.alpha * value + (1 - this.alpha) * this.lastSValue;
    this.lastSValue = smoothedValue;
    return smoothedValue;
  }

  smoothLandmark(
    landmark: NormalizedLandmark | null,
  ): NormalizedLandmark | null {
    if (!landmark) return null;
    if (this.lastLValue === null) {
      this.lastLValue = { ...landmark };
      return { ...landmark };
    }
    const newSmoothed: NormalizedLandmark = {
      x: this.alpha * landmark.x + (1 - this.alpha) * this.lastLValue.x,
      y: this.alpha * landmark.y + (1 - this.alpha) * this.lastLValue.y,
      z:
        landmark.z !== undefined && this.lastLValue.z !== undefined
          ? this.alpha * landmark.z + (1 - this.alpha) * this.lastLValue.z
          : landmark.z,
      visibility: landmark.visibility,
    };
    this.lastLValue = newSmoothed;
    return newSmoothed;
  }

  reset(): void {
    this.lastSValue = null;
    this.lastLValue = null;
  }
}
