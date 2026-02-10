import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SuperGridDemo } from '../SuperGridDemo';
import { SQLiteProvider } from '@/db/SQLiteProvider';
import { PAFVProvider } from '@/state/PAFVContext';

// Mock sql.js
vi.mock('sql.js', () => ({
  default: vi.fn(() => Promise.resolve({
    Database: vi.fn(() => ({
      exec: vi.fn(() => []),
      run: vi.fn(),
      prepare: vi.fn(() => ({
        all: vi.fn(() => []),
        run: vi.fn(),
        finalize: vi.fn()
      }))
    }))
  }))
}));

// Mock D3 SuperGrid
vi.mock('@/d3/SuperGrid', () => ({
  SuperGrid: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    refresh: vi.fn(),
    getStats: vi.fn(() => ({
      cardsVisible: 5,
      gridDimensions: { width: 800, height: 600 },
      layoutType: 'auto-grid'
    })),
    renderWithFilters: vi.fn(),
    renderWithPAFVFilters: vi.fn()
  }))
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SQLiteProvider>
    <PAFVProvider>
      {children}
    </PAFVProvider>
  </SQLiteProvider>
);

describe('SuperGridDemo Modal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(
      <TestWrapper>
        <SuperGridDemo />
      </TestWrapper>
    );

    expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
  });

  it('shows modal integration elements', async () => {
    render(
      <TestWrapper>
        <SuperGridDemo />
      </TestWrapper>
    );

    // Verify modal is not initially visible
    expect(screen.queryByText('Card Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Card')).not.toBeInTheDocument();

    // SuperGrid should be present (via svg element)
    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toBeInTheDocument();
  });

  it('has proper ARIA structure', async () => {
    render(
      <TestWrapper>
        <SuperGridDemo />
      </TestWrapper>
    );

    // Check that the component has proper accessibility structure
    expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
    expect(screen.getByText('Test Controls')).toBeInTheDocument();
    expect(screen.getByText('sql.js Capabilities')).toBeInTheDocument();
  });
});