import React, { useState, useEffect, useRef } from 'react';
import type { TransitionConfig } from '../../types/view';

/**
 * ViewTransition - Component for smooth view transitions with animations
 *
 * Features:
 * - Fade in/out transitions
 * - Scale animations for emphasis
 * - Stagger animations for list items
 * - Loading states with skeleton screens
 * - Error handling with recovery animations
 */

export interface ViewTransitionProps {
  /** Unique key for the view being rendered */
  viewKey: string;

  /** Whether the view is currently loading */
  isLoading?: boolean;

  /** Whether there's an error state */
  hasError?: boolean;

  /** Transition configuration */
  config?: TransitionConfig;

  /** Children to render with transition */
  children: React.ReactNode;

  /** Callback when transition completes */
  onTransitionComplete?: () => void;
}

export function ViewTransition({
  viewKey,
  isLoading = false,
  hasError = false,
  config = { duration: 300, easing: 'ease-out' },
  children,
  onTransitionComplete
}: ViewTransitionProps) {
  const [currentKey, setCurrentKey] = useState(viewKey);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'fade-out' | 'fade-in'>('idle');
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Handle view key changes (new view being loaded)
  useEffect(() => {
    if (viewKey !== currentKey && !isTransitioning) {
      startTransition(viewKey);
    }
  }, [viewKey, currentKey, isTransitioning]);

  // Start transition sequence
  const startTransition = (newKey: string) => {
    setIsTransitioning(true);
    setAnimationPhase('fade-out');

    // Phase 1: Fade out current content
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      // Phase 2: Switch content and fade in
      setCurrentKey(newKey);
      setAnimationPhase('fade-in');

      timeoutRef.current = setTimeout(() => {
        // Phase 3: Complete transition
        setAnimationPhase('idle');
        setIsTransitioning(false);
        onTransitionComplete?.();
      }, config.duration);
    }, config.duration);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Calculate opacity based on animation phase
  const getOpacity = () => {
    if (isLoading || hasError) return 1;

    switch (animationPhase) {
      case 'fade-out':
        return 0;
      case 'fade-in':
        return 1;
      case 'idle':
      default:
        return 1;
    }
  };

  // Calculate scale based on animation phase
  const getScale = () => {
    if (isLoading || hasError) return 1;

    switch (animationPhase) {
      case 'fade-out':
        return 0.95;
      case 'fade-in':
        return 1;
      case 'idle':
      default:
        return 1;
    }
  };

  return (
    <div className="view-transition-container w-full h-full relative overflow-hidden">
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-20">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-gray-600 font-medium">Loading view...</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-red-50 bg-opacity-95 flex items-center justify-center z-20">
          <div className="flex flex-col items-center space-y-4 max-w-md text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-red-800 font-medium">View transition failed</div>
            <div className="text-red-600 text-sm">Please try switching views again</div>
          </div>
        </div>
      )}

      {/* Main Content with Transition */}
      <div
        ref={contentRef}
        className="w-full h-full"
        style={{
          opacity: getOpacity(),
          transform: `scale(${getScale()})`,
          transition: `opacity ${config.duration}ms ${config.easing}, transform ${config.duration}ms ${config.easing}`,
        }}
      >
        {currentKey === viewKey ? children : null}
      </div>

      {/* Transition Indicator */}
      {isTransitioning && (
        <div className="absolute bottom-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm z-10">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Switching...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ListItemTransition - Staggered animations for list items
 */
export interface ListItemTransitionProps {
  /** Index of the item for staggered animation */
  index: number;

  /** Whether to animate the entry */
  animate?: boolean;

  /** Stagger delay in ms */
  staggerDelay?: number;

  /** Children to render */
  children: React.ReactNode;
}

export function ListItemTransition({
  index,
  animate = true,
  staggerDelay = 50,
  children
}: ListItemTransitionProps) {
  const [isVisible, setIsVisible] = useState(!animate);

  useEffect(() => {
    if (animate && !isVisible) {
      const delay = index * staggerDelay;
      const timeout = setTimeout(() => {
        setIsVisible(true);
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [animate, isVisible, index, staggerDelay]);

  return (
    <div
      className="list-item-transition"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      }}
    >
      {children}
    </div>
  );
}

/**
 * CardHoverTransition - Micro-animation for card hover effects
 */
export interface CardHoverTransitionProps {
  /** Whether the card is currently hovered */
  isHovered?: boolean;

  /** Children to render */
  children: React.ReactNode;
}

export function CardHoverTransition({
  isHovered = false,
  children
}: CardHoverTransitionProps) {
  return (
    <div
      className="card-hover-transition"
      style={{
        transform: isHovered ? 'scale(1.02) translateY(-2px)' : 'scale(1) translateY(0)',
        boxShadow: isHovered
          ? '0 8px 16px rgba(0, 0, 0, 0.1)'
          : '0 2px 4px rgba(0, 0, 0, 0.05)',
        transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
      }}
    >
      {children}
    </div>
  );
}

/**
 * SkeletonLoader - Loading skeleton for content
 */
export interface SkeletonLoaderProps {
  /** Type of skeleton to show */
  type: 'list' | 'grid' | 'card';

  /** Number of skeleton items */
  count?: number;
}

export function SkeletonLoader({ type, count = 6 }: SkeletonLoaderProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const renderSkeletonItem = (index: number) => {
    const baseClasses = "animate-pulse bg-gray-200 rounded";

    switch (type) {
      case 'list':
        return (
          <div key={index} className="flex space-x-4 p-4">
            <div className={`w-12 h-12 ${baseClasses}`}></div>
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-3/4 ${baseClasses}`}></div>
              <div className={`h-3 w-1/2 ${baseClasses}`}></div>
            </div>
          </div>
        );

      case 'grid':
        return (
          <div key={index} className="p-4 border border-gray-200 rounded-lg">
            <div className={`w-full h-32 mb-3 ${baseClasses}`}></div>
            <div className={`h-4 w-3/4 mb-2 ${baseClasses}`}></div>
            <div className={`h-3 w-1/2 ${baseClasses}`}></div>
          </div>
        );

      case 'card':
        return (
          <div key={index} className="p-4 border border-gray-200 rounded-lg">
            <div className={`h-4 w-full mb-2 ${baseClasses}`}></div>
            <div className={`h-3 w-2/3 mb-2 ${baseClasses}`}></div>
            <div className={`h-3 w-1/2 ${baseClasses}`}></div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`skeleton-loader ${
      type === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'space-y-2'
    }`}>
      {items.map(renderSkeletonItem)}
    </div>
  );
}

export default ViewTransition;