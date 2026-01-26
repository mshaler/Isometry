import React, { useEffect } from 'react';
import { BaseViewRenderer } from './BaseViewRenderer';
import type {
  ViewComponentProps,
  ViewTransitionState,
  TransitionConfig,
  Dimensions
} from '../../types/view';

/**
 * ReactViewRenderer - Wrapper for React-based view components
 *
 * Bridges the ViewRenderer interface with React components,
 * providing:
 * - React component lifecycle integration
 * - DOM-based transition animations
 * - State preservation between view switches
 * - Performance optimization with React.memo patterns
 */
export abstract class ReactViewRenderer extends BaseViewRenderer {
  public readonly renderMode = 'react' as const;
  protected containerRef: React.RefObject<HTMLElement> | null = null;
  protected componentInstance: React.ComponentType<ViewComponentProps> | null = null;

  // React-specific state
  protected scrollState: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    super();
    this.containerRef = React.createRef<HTMLElement>();
  }

  // Abstract method to be implemented by subclasses
  abstract getComponent(): React.ComponentType<ViewComponentProps>;

  // Render the React component with proper props
  renderComponent(props: ViewComponentProps): React.ReactElement {
    const Component = this.getComponent();

    return React.createElement(ViewRendererWrapper, {
      renderer: this,
      containerRef: this.containerRef,
      ...props
    }, React.createElement(Component, {
      ...props,
      transitionState: this.transitionState
    }));
  }

  // Initialize with DOM container
  initialize(container: HTMLElement): void {
    if (this.containerRef && this.containerRef.current !== container) {
      // Update container reference
      (this.containerRef as any).current = container;
    }
  }

  // Enhanced state management for React views
  saveState(): ViewTransitionState {
    const baseState = super.saveState();

    // Capture scroll position if container exists
    if (this.containerRef?.current) {
      const element = this.containerRef.current;
      this.scrollState = {
        x: element.scrollLeft,
        y: element.scrollTop
      };
    }

    return {
      ...baseState,
      scrollPosition: this.scrollState
    };
  }

  loadState(state: ViewTransitionState): void {
    super.loadState(state);

    if (state.scrollPosition) {
      this.scrollState = state.scrollPosition;

      // Restore scroll position if container is available
      if (this.containerRef?.current) {
        const element = this.containerRef.current;
        element.scrollLeft = this.scrollState.x;
        element.scrollTop = this.scrollState.y;
      }
    }
  }

  // React-specific transition animations
  protected async applyTransition(config: TransitionConfig, type: 'fade-in' | 'fade-out'): Promise<void> {
    if (!this.containerRef?.current) {
      return super.applyTransition(config, type);
    }

    const element = this.containerRef.current;

    return new Promise((resolve) => {
      element.style.transition = `opacity ${config.duration}ms ${config.easing}`;

      if (type === 'fade-out') {
        element.style.opacity = '0';
        setTimeout(() => {
          element.style.opacity = '1';
          element.style.transition = '';
          resolve();
        }, config.duration);
      } else {
        element.style.opacity = '0';
        requestAnimationFrame(() => {
          element.style.opacity = '1';
          setTimeout(() => {
            element.style.transition = '';
            resolve();
          }, config.duration);
        });
      }
    });
  }

  // Resize handling for React components
  onResize(dimensions: Dimensions): void {
    // Trigger re-render with new dimensions
    // This would typically be handled by the parent component updating props
    super.onResize?.(dimensions);
  }

  destroy(): void {
    // Clean up any references
    this.containerRef = null;
    this.componentInstance = null;
  }
}

/**
 * ViewRendererWrapper - React component that handles ViewRenderer lifecycle
 */
interface ViewRendererWrapperProps extends ViewComponentProps {
  renderer: ReactViewRenderer;
  containerRef: React.RefObject<HTMLElement>;
  children: React.ReactElement;
}

const ViewRendererWrapper = React.memo<ViewRendererWrapperProps>(({
  renderer,
  containerRef,
  children
}) => {
  useEffect(() => {
    // Initialize renderer with container when mounted
    if (containerRef.current) {
      renderer.initialize(containerRef.current);
    }

    return () => {
      // Cleanup when unmounted
      renderer.destroy();
    };
  }, [renderer, containerRef]);

  useEffect(() => {
    // Restore scroll position after render
    if (containerRef.current && renderer.transitionState.scrollPosition) {
      const element = containerRef.current;
      element.scrollLeft = renderer.transitionState.scrollPosition.x;
      element.scrollTop = renderer.transitionState.scrollPosition.y;
    }
  });

  return (
    <div ref={containerRef} className="view-renderer-container w-full h-full">
      {children}
    </div>
  );
});

ViewRendererWrapper.displayName = 'ViewRendererWrapper';

export { ViewRendererWrapper };