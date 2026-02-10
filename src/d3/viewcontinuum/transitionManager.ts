/**
 * Transition Manager for ViewContinuum
 *
 * Handles view switching and animation coordination
 */

import { ViewType } from '../../types/views';
import type {
  ViewState,
  ViewAxisMapping,
  FlipAnimationConfig,
  ViewTransitionEvent
} from '../../types/views';
import type { Node } from '../../types/node';
import type { ViewConfig } from '../../engine/contracts/ViewConfig';
import { IsometryViewEngine } from '../../engine/IsometryViewEngine';
import { devLogger as d3Logger } from '../../utils/logging/dev-logger';

export class TransitionManager {
  private isTransitioning: boolean = false;

  constructor(
    private viewEngine: IsometryViewEngine,
    private containerElement: HTMLElement,
    private animationConfig: FlipAnimationConfig
  ) {}

  /**
   * Switch to a different view type with optional FLIP animation
   */
  public async switchToView(
    targetView: ViewType,
    viewState: ViewState,
    cachedCards: Node[],
    currentViewConfig: ViewConfig | null,
    trigger: 'user' | 'programmatic' | 'keyboard' = 'programmatic',
    animated: boolean,
    callbacks: {
      saveCurrentViewState: () => void;
      createViewConfig: (viewType: ViewType, axisMapping: ViewAxisMapping) => ViewConfig;
      restoreViewState: () => void;
      saveViewState: () => void;
      emitViewChangeEvent: (event: ViewTransitionEvent) => void;
    }
  ): Promise<{ newViewConfig: ViewConfig; transitionEvent: ViewTransitionEvent }> {
    if (this.isTransitioning) {
      d3Logger.warn('TransitionManager switchToView: Transition already in progress, interrupting');
      this.interruptTransition();
    }

    const fromView = viewState.currentView;
    if (fromView === targetView) {
      d3Logger.info('Already on target view', { view: targetView } as any);
      throw new Error('Already on target view');
    }

    d3Logger.state('View switch initiated', {
      from: fromView,
      to: targetView,
      trigger,
      animated,
      hasData: cachedCards.length > 0
    });

    // Save current view state
    callbacks.saveCurrentViewState();

    // Prepare transition event
    const transitionEvent: ViewTransitionEvent = {
      fromView,
      toView: targetView,
      timestamp: Date.now(),
      trigger,
      preservedState: {
        selectionCount: viewState.selectionState.selectedCardIds.size,
        focusedCardId: viewState.selectionState.lastSelectedId,
        filterCount: viewState.activeFilters.length
      }
    };

    // Update transition state
    viewState.transitionState = {
      fromView,
      toView: targetView,
      isAnimating: animated,
      progress: 0,
      startTime: Date.now()
    };

    try {
      this.isTransitioning = true;

      // Create target view configuration
      const targetMapping = viewState.viewStates[targetView].axisMapping;
      const targetViewConfig = callbacks.createViewConfig(targetView, targetMapping);

      // Use ViewEngine transition if animation enabled, otherwise render directly
      if (animated && currentViewConfig) {
        await this.viewEngine.transition(
          currentViewConfig,
          targetViewConfig,
          this.animationConfig.duration
        );
      } else {
        await this.viewEngine.render(this.containerElement, cachedCards, targetViewConfig);
      }

      // Update current view state
      viewState.currentView = targetView;

      // Load target view state
      callbacks.restoreViewState();

      // Update state and persist
      viewState.lastModified = Date.now();
      callbacks.saveViewState();

      // Emit transition event
      callbacks.emitViewChangeEvent(transitionEvent);

      d3Logger.render('View transition complete', {
        to: targetView,
        duration: Date.now() - transitionEvent.timestamp
      });

      return { newViewConfig: targetViewConfig, transitionEvent };

    } catch (error) {
      d3Logger.error('TransitionManager switchToView transition failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Rollback on error
      viewState.currentView = fromView;

      throw error;
    } finally {
      this.isTransitioning = false;
      viewState.transitionState = undefined;
    }
  }

  /**
   * Get transition state
   */
  public getIsTransitioning(): boolean {
    return this.isTransitioning;
  }

  /**
   * Force interrupt current transition
   */
  public interruptTransition(): void {
    if (!this.isTransitioning) return;

    // Cancel any ongoing animations
    this.isTransitioning = false;

    d3Logger.warn('View transition interrupted');
  }

  /**
   * Update animation configuration
   */
  public updateAnimationConfig(config: FlipAnimationConfig): void {
    this.animationConfig = config;
  }
}