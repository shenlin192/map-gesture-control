import { type Ref } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  mapRef: Ref<MapRef>
  containerRef: Ref<HTMLDivElement>
  onMapLoad: () => void
}

function ReactMap({ mapRef, containerRef, onMapLoad }: Props) {
  return (
    <div ref={containerRef}
         className="w-full h-[400px] md:h-[600px] rounded-lg shadow-xl border-2 border-blue-500 bg-gray-700 relative overflow-hidden">
      <Map
        ref={mapRef}
        onLoad={onMapLoad}
        initialViewState={{
          longitude: -74.5,
          latitude: 40,
          zoom: 9
        }}
        style={{ height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
      </Map>
    </div>
  );
}

export default ReactMap;