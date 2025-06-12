import { type Ref } from 'react';
import Map, { type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

type Props = {
  mapRef: Ref<MapRef>;
  containerRef: Ref<HTMLDivElement>;
  onMapLoad: () => void;
};

function ReactMap({ mapRef, containerRef, onMapLoad }: Props) {
  return (
    <div ref={containerRef} className="w-full h-full ">
      <Map
        ref={mapRef}
        onLoad={onMapLoad}
        initialViewState={{
          longitude: 2.3333333,
          latitude: 48.866667,
          zoom: 12,
          pitch: 30,
        }}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
        style={{ height: '100%' }}
        mapStyle="mapbox://styles/mapbox/standard"
      ></Map>
    </div>
  );
}

export default ReactMap;
