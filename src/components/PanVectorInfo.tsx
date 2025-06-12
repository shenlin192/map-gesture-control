interface PanVectorInfoProps {
  panVector: {
    x: number;
    y: number;
    speed: number;
    inDeadZone: boolean;
    distance: string;
    rawDirection: { x: string; y: string };
  } | null;
}

export default function PanVectorInfo({ panVector }: PanVectorInfoProps) {
  if (!panVector || panVector.inDeadZone) {
    return null;
  }

  // Format numbers with fixed width to prevent layout shifts
  const formatNumber = (num: number, decimals: number = 3) => {
    return num.toFixed(decimals).padStart(6, ' ');
  };

  const formatSpeed = (speed: number) => {
    return `${(speed * 100).toFixed(0).padStart(3, ' ')}%`;
  };

  return (
    <div className="bg-gray-600 p-3 rounded text-sm w-80">
      <div className="font-semibold text-blue-300 mb-2">Pan Vector Info :</div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <span className="text-gray-300">Hand Direction:</span>
          <div>({formatNumber(parseFloat(panVector.rawDirection.x))}, {formatNumber(parseFloat(panVector.rawDirection.y))})</div>
        </div>
        <div>
          <span className="text-green-300">Map Pan Direction:</span>
          <div>({formatNumber(panVector.x)}, {formatNumber(panVector.y)})</div>
        </div>
        <div>Speed: {formatSpeed(panVector.speed)}</div>
        <div>Distance: {panVector.distance.padStart(5, ' ')}</div>
      </div>
    </div>
  );
}