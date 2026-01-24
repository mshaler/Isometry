import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  latLngToBounds,
  isPointInRadius,
  isPointInBounds,
  formatDistance,
} from '../geo-utils';

describe('geo-utils', () => {
  describe('haversineDistance', () => {
    it('calculates distance between two points', () => {
      // NYC to LA (approx 3,936 km)
      const nyc = { lat: 40.7128, lng: -74.006 };
      const la = { lat: 34.0522, lng: -118.2437 };
      const distance = haversineDistance(nyc, la);

      // Should be approximately 3,936,000 meters (within 1%)
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(3970000);
    });

    it('returns 0 for same point', () => {
      const point = { lat: 40.7128, lng: -74.006 };
      expect(haversineDistance(point, point)).toBe(0);
    });

    it('handles points across date line', () => {
      const point1 = { lat: 0, lng: 179 };
      const point2 = { lat: 0, lng: -179 };
      const distance = haversineDistance(point1, point2);

      // Should be ~222km (2 degrees at equator)
      expect(distance).toBeGreaterThan(200000);
      expect(distance).toBeLessThan(250000);
    });
  });

  describe('latLngToBounds', () => {
    it('creates bounding box from center and radius', () => {
      const center = { lat: 40.7128, lng: -74.006 };
      const radius = 1000; // 1km
      const bounds = latLngToBounds(center, radius);

      expect(bounds.sw.lat).toBeLessThan(center.lat);
      expect(bounds.sw.lng).toBeLessThan(center.lng);
      expect(bounds.ne.lat).toBeGreaterThan(center.lat);
      expect(bounds.ne.lng).toBeGreaterThan(center.lng);
    });

    it('creates symmetric bounds at equator', () => {
      const center = { lat: 0, lng: 0 };
      const radius = 1000;
      const bounds = latLngToBounds(center, radius);

      const latDelta = bounds.ne.lat - center.lat;
      const lngDelta = bounds.ne.lng - center.lng;

      // At equator, lat/lng deltas should be approximately equal
      expect(Math.abs(latDelta - lngDelta)).toBeLessThan(0.001);
    });

    it('adjusts for latitude compression', () => {
      const centerEquator = { lat: 0, lng: 0 };
      const centerPole = { lat: 60, lng: 0 };
      const radius = 1000;

      const boundsEquator = latLngToBounds(centerEquator, radius);
      const boundsPole = latLngToBounds(centerPole, radius);

      const lngDeltaEquator = boundsEquator.ne.lng - centerEquator.lng;
      const lngDeltaPole = boundsPole.ne.lng - centerPole.lng;

      // Lng delta should be larger near pole (latitude compression)
      expect(lngDeltaPole).toBeGreaterThan(lngDeltaEquator);
    });
  });

  describe('isPointInRadius', () => {
    it('returns true for point within radius', () => {
      const center = { lat: 40.7128, lng: -74.006 };
      const nearby = { lat: 40.72, lng: -74.0 };
      const radius = 2000; // 2km

      expect(isPointInRadius(nearby, center, radius)).toBe(true);
    });

    it('returns false for point outside radius', () => {
      const center = { lat: 40.7128, lng: -74.006 };
      const farAway = { lat: 41.0, lng: -75.0 };
      const radius = 1000; // 1km

      expect(isPointInRadius(farAway, center, radius)).toBe(false);
    });

    it('returns true for center point', () => {
      const center = { lat: 40.7128, lng: -74.006 };
      expect(isPointInRadius(center, center, 1000)).toBe(true);
    });
  });

  describe('isPointInBounds', () => {
    it('returns true for point within bounds', () => {
      const bounds = {
        sw: { lat: 40.0, lng: -75.0 },
        ne: { lat: 41.0, lng: -73.0 },
      };
      const point = { lat: 40.5, lng: -74.0 };

      expect(isPointInBounds(point, bounds)).toBe(true);
    });

    it('returns false for point outside bounds', () => {
      const bounds = {
        sw: { lat: 40.0, lng: -75.0 },
        ne: { lat: 41.0, lng: -73.0 },
      };
      const point = { lat: 42.0, lng: -74.0 };

      expect(isPointInBounds(point, bounds)).toBe(false);
    });

    it('returns true for point on boundary', () => {
      const bounds = {
        sw: { lat: 40.0, lng: -75.0 },
        ne: { lat: 41.0, lng: -73.0 },
      };
      const point = { lat: 40.0, lng: -74.0 };

      expect(isPointInBounds(point, bounds)).toBe(true);
    });
  });

  describe('formatDistance', () => {
    it('formats small distances in meters', () => {
      expect(formatDistance(500)).toBe('500 m');
      expect(formatDistance(999)).toBe('999 m');
    });

    it('formats large distances in kilometers', () => {
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(formatDistance(2500)).toBe('2.5 km');
      expect(formatDistance(10000)).toBe('10.0 km');
    });

    it('rounds meters to nearest integer', () => {
      expect(formatDistance(500.7)).toBe('501 m');
      expect(formatDistance(500.3)).toBe('500 m');
    });

    it('rounds kilometers to one decimal', () => {
      expect(formatDistance(1234)).toBe('1.2 km');
      expect(formatDistance(1567)).toBe('1.6 km');
    });
  });
});
