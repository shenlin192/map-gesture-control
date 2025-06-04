import React from "react";

interface CameraViewProps {
	videoRef:  React.RefObject<HTMLVideoElement | null>;
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

function CameraView({ videoRef, canvasRef }: CameraViewProps) {
	return (
		<div className="relative w-full max-w-xs aspect-[4/3] rounded-lg overflow-hidden border border-gray-600 bg-black">
			<video
				ref={videoRef}
				className="absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1]"
				playsInline
			/>
			<canvas
				ref={canvasRef}
				className="absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1]"
			/>
		</div>
	);
}

export default CameraView;