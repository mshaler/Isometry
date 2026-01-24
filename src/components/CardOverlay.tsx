import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from './Card';
import { useCardOverlay } from '@/state/CardOverlayContext';
import { useKeyboardClose } from '@/hooks/useKeyboardClose';
import { useCardPosition, type CellCoordinates } from '@/hooks/useCardPosition';

/**
 * CardOverlay - Portal-based overlay for Card display (GridBlock 5)
 *
 * Part of z=2 Overlay Layer. Renders Card component in a React Portal
 * outside the SVG DOM hierarchy to avoid positioning conflicts.
 *
 * Features:
 * - Portal rendering to document.body
 * - Smart positioning relative to clicked cell
 * - Click-outside-to-close behavior
 * - Esc key to close (via useKeyboardClose)
 * - Smooth enter/exit animations
 *
 * Architecture:
 * - z=0: SPARSITY (D3 SVG data floor)
 * - z=1: DENSITY (React controls - not used for card)
 * - z=2: OVERLAY (this component) ← Card appears here
 */
export function CardOverlay() {
  const { selectedNode, clearSelection } = useCardOverlay();
  const [cellCoords, setCellCoords] = useState<CellCoordinates | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Calculate card position from cell coordinates
  const cardPosition = useCardPosition(cellCoords);

  // Handle Esc key to close
  useKeyboardClose(!!selectedNode, clearSelection);

  // Get cell coordinates when node is selected
  useEffect(() => {
    if (!selectedNode) {
      // Fade out animation before removing
      setIsVisible(false);
      // Clear cell coords after animation completes
      const timer = setTimeout(() => {
        setCellCoords(null);
      }, 150);
      return () => clearTimeout(timer);
    }

    // For now, we'll position the card in the center of the viewport
    // In the future, we'll get actual cell coordinates from the D3 click event
    // TODO: Pass cell coordinates from D3SparsityLayer click handler
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    setCellCoords({
      x: viewportWidth / 2 - 200, // Center horizontally (card is 400px wide)
      y: viewportHeight / 2 - 250, // Center vertically (card is ~500px tall)
      width: 0,
      height: 0,
    });

    // Trigger enter animation
    setIsVisible(true);
  }, [selectedNode]);

  // Handle click on backdrop (outside card)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      clearSelection();
    }
  };

  // Don't render if no node selected
  if (!selectedNode || !cardPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0)',
        transition: 'background-color 150ms ease-in-out',
      }}
    >
      <div
        className="absolute"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.9)',
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        }}
      >
        <Card node={selectedNode} onClose={clearSelection} />
      </div>
    </div>,
    document.body
  );
}
