interface ZoomVectorInfoProps {
  zoomVector: {
    direction: 'ZOOM_IN' | 'ZOOM_OUT';
    speed: number;
    inDeadZone: boolean;
    distance: string;
    fingerPos: { x: string; y: string };
  } | null;
}

export default function ZoomVectorInfo({ zoomVector }: ZoomVectorInfoProps) {
  if (!zoomVector || zoomVector.inDeadZone) {
    return null;
  }

  const formatSpeed = (speed: number) => {
    return `${(speed * 100).toFixed(0).padStart(3, ' ')}%`;
  };


  return (
    <div className="bg-gray-600 p-3 rounded text-sm w-80">
      <div className="font-semibold text-purple-300 mb-2">Zoom Control Info:</div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <span className="text-gray-300">Direction:</span>
          <div className="text-green-300">
            {zoomVector.direction}
          </div>
        </div>
        <div>
          <span className="text-gray-300">Speed:</span>
          <div>{formatSpeed(zoomVector.speed)}</div>
        </div>
        <div>
          <span className="text-gray-300">Distance from Center:</span>
          <div>{zoomVector.distance.padStart(5, ' ')}</div>
        </div>
        <div>
          <span className="text-gray-300">Finger Position:</span>
          <div>({parseFloat(zoomVector.fingerPos.x).toFixed(3)}, {parseFloat(zoomVector.fingerPos.y).toFixed(3)})</div>
        </div>
      </div>
    </div>
  );
}