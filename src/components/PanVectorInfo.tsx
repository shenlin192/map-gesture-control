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

  return (
    <div className="bg-gray-600 p-3 rounded text-sm">
      <div className="font-semibold text-blue-300 mb-2">Pan Vector Info (Natural Scrolling):</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-300">Hand Direction:</span> ({panVector.rawDirection.x}, {panVector.rawDirection.y})
        </div>
        <div>
          <span className="text-green-300">Map Pan Direction:</span> ({panVector.x.toFixed(3)}, {panVector.y.toFixed(3)})
        </div>
        <div>Speed: {(panVector.speed * 100).toFixed(0)}%</div>
        <div>Distance: {panVector.distance}</div>
        <div className="col-span-2 text-gray-400 text-xs mt-1">
          Hand UP → Map DOWN | Hand DOWN → Map UP
        </div>
      </div>
    </div>
  );
}