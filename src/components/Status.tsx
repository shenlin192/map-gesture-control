interface StatusDisplayProps {
	gestureStatus: string;
	activeGesture: string;
}

function StatusDisplay({ gestureStatus, activeGesture }: StatusDisplayProps) {
	return (
		<>
			<div className="bg-gray-700 p-3 rounded-lg shadow-md text-center w-full max-w-xs">
				<p className="text-sm font-semibold">Status:</p>
				<p className="text-xs text-blue-300 min-h-[3em] break-words">{gestureStatus}</p>
				<p className="text-sm font-semibold mt-1">Active Gesture:</p>
				<p className="text-xs text-green-400">{activeGesture || 'NONE'}</p>
			</div>
			<div className="mt-6 p-4 bg-gray-700 rounded-lg shadow-lg w-full max-w-4xl">
				<h2 className="text-xl font-semibold mb-2 text-center">Instructions</h2>
				<ul className="list-disc list-inside text-sm space-y-1">
					<li>Make sure you have replaced <code className="bg-gray-600 px-1 rounded text-xs">YOUR_MAPBOX_ACCESS_TOKEN</code>.</li>
					<li>Allow webcam access when prompted.</li>
					<li>Wait for "Webcam Active. Waiting for gestures..." status.</li>
					<li>**Pinch to Zoom**: Bring thumb and index finger together. Move apart to zoom in, closer to zoom out.</li>
					<li>**Pan Map**: Make a "Pointing Up" or custom pointing gesture, then move your hand.</li>
					<li>Ensure good lighting and a clear view of your hand.</li>
				</ul>
			</div>
		</>
	);
}

export default StatusDisplay