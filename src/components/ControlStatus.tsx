import type { ControlMode } from '../types';

interface ControlStatusProps {
  currentControlMode: ControlMode;
  panVector: any;
  zoomVector: any;
}

// Helper function to format speed percentage
const formatSpeedPercentage = (speed: number): string => {
  return (speed * 100).toFixed(0).padStart(3, ' ');
};

// Helper function to generate gesture text based on control mode and state
const generateGestureText = (controlMode: ControlMode, panVector: any, zoomVector: any): string => {
  if (controlMode === 'IDLE') {
    return panVector || zoomVector ? 'Open Palm/Other - Idle' : 'No hand detected';
  }

  if (controlMode === 'ZOOM_IN' || controlMode === 'ZOOM_OUT') {
    if (!zoomVector) return 'Unknown';
    
    const gestureLabel = controlMode === 'ZOOM_IN' ? 'Victory' : 'Close Pinch';
    if (zoomVector.inDeadZone) {
      return `${gestureLabel} - In Dead Zone`;
    }
    const zoomDirection = controlMode.replace('_', ' ');
    return `${gestureLabel} - ${zoomDirection} (Speed: ${formatSpeedPercentage(zoomVector.speed)}%)`;
  }

  if (controlMode === 'PANNING') {
    if (!panVector) return 'Unknown';
    
    if (panVector.inDeadZone) {
      return 'Pointing Up - In Dead Zone';
    }
    return `Pointing Up - Pan Active (Speed: ${formatSpeedPercentage(panVector.speed)}%)`;
  }

  return 'Unknown';
};

export default function ControlStatus({ currentControlMode, panVector, zoomVector }: ControlStatusProps) {
  const detectedGesture = generateGestureText(currentControlMode, panVector, zoomVector);
  return (
    <div className="mb-4 p-4 bg-gray-700 rounded-lg">
      <div className="flex flex-col gap-3">
        <div className="flex gap-6">
          <div>
            <span className="font-semibold">Control Mode: </span>
            <span className={`px-2 py-1 rounded text-sm ${
              currentControlMode === 'PANNING' ? 'bg-blue-600' :
              currentControlMode === 'ZOOM_IN' || currentControlMode === 'ZOOM_OUT' ? 'bg-green-600' :
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