import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistance } from '@/utils/geo-utils';

// Fix Leaflet icon paths (Vite asset handling)
// @ts-expect-error Leaflet global override
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface LocationMapWidgetProps {
  center: { lat: number; lng: number } | null;
  radiusMeters: number;
  onChange: (center: { lat: number; lng: number }, _radiusMeters: number) => void;
  markers?: Array<{ id: string; lat: number; lng: number; title: string }>;
  className?: string;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }; // San Francisco
const DEFAULT_ZOOM = 10;
const DEFAULT_RADIUS = 5000; // 5km

/**
 * LocationMapWidget - Interactive map for Location filter
 *
 * Features:
 * - Pan/zoom map controls
 * - Draggable center marker
 * - Adjustable radius circle
 * - Note markers (clustered)
 * - Current location detection
 * - OpenStreetMap tiles (free, no API key)
 */
export function LocationMapWidget({
  center,
  radiusMeters,
  onChange,
  markers = [],
  className = '',
}: LocationMapWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const noteMarkersRef = useRef<L.Marker[]>([]);

  const [geolocationStatus, setGeolocationStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle');

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initialCenter = center || DEFAULT_CENTER;
    const initialRadius = radiusMeters || DEFAULT_RADIUS;

    // Create map
    const map = L.map(mapRef.current).setView(
      [initialCenter.lat, initialCenter.lng],
      DEFAULT_ZOOM
    );

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add radius circle
    const circle = L.circle([initialCenter.lat, initialCenter.lng], {
      radius: initialRadius,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2,
    }).addTo(map);

    // Add center marker
    const centerMarker = L.marker([initialCenter.lat, initialCenter.lng], {
      draggable: true,
      title: 'Drag to move filter center',
    }).addTo(map);

    // Handle center marker drag
    centerMarker.on('dragend', () => {
      const pos = centerMarker.getLatLng();
      circle.setLatLng(pos);
      onChange({ lat: pos.lat, lng: pos.lng }, initialRadius);
    });

    // Handle map click to set new center
    map.on('click', (e) => {
      const pos = e.latlng;
      centerMarker.setLatLng(pos);
      circle.setLatLng(pos);
      onChange({ lat: pos.lat, lng: pos.lng }, initialRadius);
    });

    mapInstanceRef.current = map;
    circleRef.current = circle;
    centerMarkerRef.current = centerMarker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      circleRef.current = null;
      centerMarkerRef.current = null;
    };
  }, []); // Only run once on mount

  // Update center and radius when props change
  useEffect(() => {
    if (!mapInstanceRef.current || !circleRef.current || !centerMarkerRef.current)
      return;

    const newCenter = center || DEFAULT_CENTER;
    const newRadius = radiusMeters || DEFAULT_RADIUS;

    centerMarkerRef.current.setLatLng([newCenter.lat, newCenter.lng]);
    circleRef.current.setLatLng([newCenter.lat, newCenter.lng]);
    circleRef.current.setRadius(newRadius);

    // Pan map to new center
    mapInstanceRef.current.panTo([newCenter.lat, newCenter.lng]);
  }, [center, radiusMeters]);

  // Update note markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove old markers
    noteMarkersRef.current.forEach((marker) => marker.remove());
    noteMarkersRef.current = [];

    // Add new markers
    const newMarkers = markers.map((note) => {
      const marker = L.marker([note.lat, note.lng], {
        title: note.title,
        opacity: 0.7,
      });

      marker.bindPopup(`<strong>${note.title}</strong>`);
      marker.addTo(map);

      return marker;
    });

    noteMarkersRef.current = newMarkers;
  }, [markers]);

  // Request geolocation
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGeolocationStatus('denied');
      return;
    }

    setGeolocationStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGeolocationStatus('granted');

        onChange(
          { lat: latitude, lng: longitude },
          radiusMeters || DEFAULT_RADIUS
        );

        // Center map on user location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 12);
        }
      },
      (error) => {
        console.warn('Geolocation denied:', error);
        setGeolocationStatus('denied');
      }
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Map container */}
      <div ref={mapRef} className="w-full h-[300px] rounded border border-gray-300" />

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 text-sm">
        {/* Geolocation button */}
        <button
          type="button"
          onClick={requestGeolocation}
          disabled={geolocationStatus === 'requesting'}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {geolocationStatus === 'requesting' && 'Requesting location...'}
          {geolocationStatus === 'granted' && '✓ Location granted'}
          {geolocationStatus === 'denied' && '✗ Location denied'}
          {geolocationStatus === 'idle' && 'Use my location'}
        </button>

        {/* Radius control */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Radius:</label>
          <input
            type="range"
            min="500"
            max="50000"
            step="500"
            value={radiusMeters || DEFAULT_RADIUS}
            onChange={(e) => {
              const newRadius = parseInt(e.target.value, 10);
              onChange(center || DEFAULT_CENTER, newRadius);
            }}
            className="w-32"
          />
          <span className="text-xs font-medium text-gray-900 min-w-[60px]">
            {formatDistance(radiusMeters || DEFAULT_RADIUS)}
          </span>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-500">
        Click map to set center, or drag the marker. Adjust radius with slider.
      </p>
    </div>
  );
}
