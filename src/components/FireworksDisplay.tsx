import { Fireworks, type FireworksHandlers } from '@fireworks-js/react';
import type { Ref } from 'react';

type Props = {
  ref: Ref<FireworksHandlers>;
};

function FireworksDisplay({ ref }: Props) {
  return (
    <div className="absolute fireworks pointer-events-none size-full inset-0">
      <Fireworks
        ref={ref}
        className="w-full h-full"
        autostart={false}
        options={{
          opacity: 0.75,
          acceleration: 1.02,
          // delay: { min: 50, max: 100 },
          // intensity: 30,
          // traceSpeed: 5,
          particles: 75,
          hue: {
            min: 180,
            max: 360,
          },
        }}
      />
    </div>
  );
}

export default FireworksDisplay;
