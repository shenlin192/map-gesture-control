import type { ControlMode } from '../types';

interface ControlStatusProps {
  currentControlMode: ControlMode;
  detectedGesture: string;
}

export default function ControlStatus({ currentControlMode, detectedGesture }: ControlStatusProps) {
  return (
    <div className="mb-4 p-4 bg-gray-700 rounded-lg">
      <div className="flex flex-col gap-3">
        <div className="flex gap-6">
          <div>
            <span className="font-semibold">Control Mode: </span>
            <span className={`px-2 py-1 rounded text-sm ${
              currentControlMode === 'PANNING' ? 'bg-blue-600' :
              currentControlMode === 'ZOOMING' ? 'bg-green-600' :
              'bg-gray-600'
            }`}>
              {currentControlMode}
            </span>
          </div>
          <div>
            <span className="font-semibold">Gesture: </span>
            <span className="text-yellow-300">{detectedGesture}</span>
          </div>
        </div>
      </div>
    </div>
  );
}