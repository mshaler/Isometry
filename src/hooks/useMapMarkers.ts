import { useEffect, useState } from 'react';
import { useSQLite } from '../db/SQLiteContext';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
}

/**
 * Fetch all nodes with location data for map markers
 *
 * Returns array of markers with lat/lng coordinates.
 * For performance, limits to 1000 markers (can add clustering later).
 */
export function useMapMarkers(): {
  markers: MapMarker[];
  loading: boolean;
  error: Error | null;
} {
  const { db } = useSQLite();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const fetchMarkers = async () => {
      try {
        setLoading(true);

        // Query nodes with non-null latitude/longitude
        const result = await db.exec(`
          SELECT id, name, latitude, longitude
          FROM nodes
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND deleted_at IS NULL
          LIMIT 1000
        `);

        if (result.length === 0 || result[0].values.length === 0) {
          setMarkers([]);
          setLoading(false);
          return;
        }

        const markerData: MapMarker[] = result[0].values.map((row) => ({
          id: String(row[0]),
          title: String(row[1]),
          lat: Number(row[2]),
          lng: Number(row[3]),
        }));

        setMarkers(markerData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch map markers:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkers();
  }, [db]);

  return { markers, loading, error };
}
