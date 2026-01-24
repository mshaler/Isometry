import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useKeyboardClose } from '@/hooks/useKeyboardClose';

/**
 * OverlayControls - Portal-based overlay container (GridBlock 6)
 *
 * Part of z=2 Overlay Layer. Renders filter controls in a React Portal
 * outside the SVG/React DOM hierarchy with a backdrop.
 *
 * Features:
 * - Portal rendering to document.body
 * - Semi-transparent backdrop
 * - Centered panel positioning
 * - Click-outside-to-close behavior
 * - Esc key to close (via useKeyboardClose)
 * - Smooth enter/exit animations
 * - z-index: 100 (higher than Card Overlay z=50)
 *
 * Architecture:
 * - z=0: SPARSITY (D3 SVG data floor)
 * - z=1: DENSITY (React controls - MiniNav)
 * - z=2: OVERLAY (Card z=50, this component z=100)
 */

interface OverlayControlsProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function OverlayControls({ isOpen, onClose, children }: OverlayControlsProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Handle Esc key to close
  useKeyboardClose(isOpen, onClose);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle click on backdrop (outside panel)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        transition: 'background-color 200ms ease-in-out',
      }}
    >
      <div
        className="relative"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0)' : 'translateY(-20px)',
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
