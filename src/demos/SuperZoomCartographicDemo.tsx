/**
 * SuperZoomCartographicDemo - Demonstration of cartographic navigation
 *
 * Shows the SuperZoom cartographic navigation system with separate
 * zoom/pan controls, upper-left anchor behavior, and boundary constraints.
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { SuperZoomCartographic } from '../d3/SuperZoomCartographic';
import { SuperZoomControls } from '../components/SuperZoomControls';
import type { CartographicState, CartographicControlInterface } from '../types/supergrid';

export const SuperZoomCartographicDemo: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cartographicEngine, setCartographicEngine] = useState<CartographicControlInterface | null>(null);
  const [state, setState] = useState<CartographicState | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Create the cartographic navigation engine
    const engine = new SuperZoomCartographic(
      svgRef.current,
      {
        gridDimensions: { width: 1200, height: 800 },
        viewportDimensions: { width: 800, height: 600 },
        anchorMode: 'upper-left',
        enableBoundaryConstraints: true,
        animationDuration: 300,
        enableSmoothing: true,
        elasticBounds: {
          enabled: true,
          resistance: 0.3,
          bounceStrength: 0.5
        }
      },
      {
        onZoomChange: (scale, state) => {
          console.warn('Zoom changed:', scale);
          setState({ ...state });
        },
        onPanChange: (x, y, state) => {
          console.warn('Pan changed:', x, y);
          setState({ ...state });
        },
        onBoundaryHit: (boundary, _state) => {
          console.warn('Hit boundary:', boundary);
        }
      }
    );

    setCartographicEngine(engine);
    setState(engine.getState());

    // Create some demo content
    createDemoContent(svgRef.current);

    return () => {
      engine.destroy();
    };
  }, []);

  const createDemoContent = (svg: SVGSVGElement) => {
    const container = d3.select(svg);

    // Clear existing content
    container.selectAll('*').remove();

    // Create a content group that will be transformed
    const contentGroup = container.append('g').attr('class', 'cartographic-content');

    // Create a grid background
    const gridSize = 50;
    const gridWidth = 1200;
    const gridHeight = 800;

    // Grid lines
    const gridLines = contentGroup.append('g').attr('class', 'grid-lines');

    // Vertical lines
    for (let x = 0; x <= gridWidth; x += gridSize) {
      gridLines.append('line')
        .attr('x1', x)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', gridHeight)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1);
    }

    // Horizontal lines
    for (let y = 0; y <= gridHeight; y += gridSize) {
      gridLines.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', gridWidth)
        .attr('y2', y)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1);
    }

    // Create sample cards
    const cardData = [];
    for (let i = 0; i < 50; i++) {
      cardData.push({
        id: i,
        x: (i % 10) * 120,
        y: Math.floor(i / 10) * 120,
        title: `Card ${i + 1}`,
        content: `Content for card ${i + 1}`
      });
    }

    // Render cards
    const cards = contentGroup.selectAll('.demo-card')
      .data(cardData)
      .enter()
      .append('g')
      .attr('class', 'demo-card')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    // Card background
    cards.append('rect')
      .attr('width', 100)
      .attr('height', 80)
      .attr('rx', 8)
      .attr('fill', '#f8f9fa')
      .attr('stroke', '#dee2e6')
      .attr('stroke-width', 1);

    // Card title
    cards.append('text')
      .attr('x', 50)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#212529')
      .text(d => d.title);

    // Card content
    cards.append('text')
      .attr('x', 50)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#6c757d')
      .text(d => d.content);

    // Add corner marker to show upper-left anchor
    contentGroup.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 8)
      .attr('fill', '#dc3545')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    contentGroup.append('text')
      .attr('x', 15)
      .attr('y', 5)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#dc3545')
      .text('(0,0) - Upper-left anchor');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: '20px' }}>SuperZoom Cartographic Navigation Demo</h1>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Main SVG Canvas */}
        <div style={{ position: 'relative' }}>
          <svg
            ref={svgRef}
            width={800}
            height={600}
            style={{
              border: '2px solid #dee2e6',
              borderRadius: '8px',
              background: 'white'
            }}
          />

          {/* Zoom Controls Overlay */}
          {cartographicEngine && (
            <SuperZoomControls
              cartographic={cartographicEngine}
              position="top-right"
              showZoomControls={true}
              showPanControls={true}
              showStateDisplay={true}
              showBoundaryIndicators={true}
              enableKeyboardShortcuts={true}
            />
          )}
        </div>

        {/* Info Panel */}
        <div style={{ minWidth: '300px' }}>
          <h3>Features Demonstrated</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Upper-left anchor zoom:</strong> Zoom operations pin the (0,0) corner</li>
            <li><strong>Separate controls:</strong> Independent zoom and pan operations</li>
            <li><strong>Boundary constraints:</strong> Can't pan beyond grid boundaries</li>
            <li><strong>Elastic resistance:</strong> Try to pan way beyond boundaries</li>
            <li><strong>Visual feedback:</strong> Boundary indicators when limits are reached</li>
            <li><strong>Smooth animations:</strong> 300ms transitions with cubic-out easing</li>
          </ul>

          <h3>Controls</h3>
          <ul style={{ lineHeight: '1.6' }}>
            <li><strong>Mouse wheel:</strong> Zoom in/out</li>
            <li><strong>Ctrl + / -:</strong> Keyboard zoom</li>
            <li><strong>Arrow keys:</strong> Pan (when controls are focused)</li>
            <li><strong>UI controls:</strong> Use sliders and buttons</li>
          </ul>

          <h3>Current State</h3>
          {state && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              <div>Scale: {state.scale.toFixed(2)}x</div>
              <div>Position: ({state.transform.x.toFixed(0)}, {state.transform.y.toFixed(0)})</div>
              <div>Anchor: ({state.anchorPoint.x}, {state.anchorPoint.y})</div>
              <div>Animating: {state.isAnimating ? 'Yes' : 'No'}</div>
              {state.elasticResistance && (
                <div>Elastic Resistance: {(state.elasticResistance * 100).toFixed(0)}%</div>
              )}
            </div>
          )}

          <h3>Architecture</h3>
          <p style={{ fontSize: '14px', color: '#6c757d', lineHeight: '1.5' }}>
            This demo shows the SuperZoom cartographic navigation system that provides
            Apple Numbers-style zoom behavior with separate zoom/pan controls and
            boundary constraints. The system integrates with SuperGrid to provide
            spreadsheet-like navigation.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Try These Actions:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
          <div>• Zoom in and notice the upper-left corner stays fixed</div>
          <div>• Try to pan beyond the grid boundaries</div>
          <div>• Use keyboard shortcuts (Ctrl+/-, arrows)</div>
          <div>• Reset zoom to 100% and pan to center</div>
        </div>
      </div>
    </div>
  );
};

export default SuperZoomCartographicDemo;