import { useEffect } from 'react';

/**
 * useKeyboardClose - Hook to handle Esc key for closing overlays
 *
 * Adds a window-level keyboard event listener that calls the provided
 * callback when Escape is pressed. Automatically cleans up on unmount.
 *
 * @param isOpen - Whether the overlay is currently open
 * @param onClose - Callback to close the overlay
 */
export function useKeyboardClose(isOpen: boolean, _onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
