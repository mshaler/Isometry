import { describe, it, expect } from 'vitest';
import { inferDimensionFromFacet } from '../latch-inference';

describe('inferDimensionFromFacet', () => {
  it('infers time dimension from date-related facets', () => {
    expect(inferDimensionFromFacet('created_at')).toBe('time');
    expect(inferDimensionFromFacet('modified_at')).toBe('time');
    expect(inferDimensionFromFacet('year')).toBe('time');
    expect(inferDimensionFromFacet('month')).toBe('time');
    expect(inferDimensionFromFacet('quarter')).toBe('time');
    expect(inferDimensionFromFacet('week')).toBe('time');
    expect(inferDimensionFromFacet('day')).toBe('time');
    expect(inferDimensionFromFacet('date')).toBe('time');
  });

  it('infers location dimension', () => {
    expect(inferDimensionFromFacet('location')).toBe('location');
    expect(inferDimensionFromFacet('city')).toBe('location');
    expect(inferDimensionFromFacet('country')).toBe('location');
    expect(inferDimensionFromFacet('region')).toBe('location');
    expect(inferDimensionFromFacet('address')).toBe('location');
    expect(inferDimensionFromFacet('place')).toBe('location');
  });

  it('infers hierarchy dimension', () => {
    expect(inferDimensionFromFacet('folder')).toBe('hierarchy');
    expect(inferDimensionFromFacet('priority')).toBe('hierarchy');
    expect(inferDimensionFromFacet('path')).toBe('hierarchy');
    expect(inferDimensionFromFacet('parent')).toBe('hierarchy');
    expect(inferDimensionFromFacet('level')).toBe('hierarchy');
  });

  it('infers alphabet dimension', () => {
    expect(inferDimensionFromFacet('name')).toBe('alphabet');
    expect(inferDimensionFromFacet('title')).toBe('alphabet');
    expect(inferDimensionFromFacet('alphabetical')).toBe('alphabet');
  });

  it('defaults to category for unknown facets', () => {
    expect(inferDimensionFromFacet('status')).toBe('category');
    expect(inferDimensionFromFacet('tags')).toBe('category');
    expect(inferDimensionFromFacet('type')).toBe('category');
    expect(inferDimensionFromFacet('unknown_field')).toBe('category');
  });

  it('handles case insensitivity', () => {
    expect(inferDimensionFromFacet('CREATED_AT')).toBe('time');
    expect(inferDimensionFromFacet('Location')).toBe('location');
    expect(inferDimensionFromFacet('FOLDER')).toBe('hierarchy');
    expect(inferDimensionFromFacet('Name')).toBe('alphabet');
  });
});
