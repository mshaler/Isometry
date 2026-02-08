/**
 * Analytics utilities for user testing and PAFV concept validation
 *
 * Tracks user interactions to understand PAFV spatial projection engagement
 */

import { logger } from './logging/logger';

interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  timestamp: number;
}

interface PAFVEngagementData {
  viewSwitches: number;
  axisMappingChanges: number;
  spatialInteractions: number;
  sessionDuration: number;
  featureDiscovery: string[];
}

class AnalyticsService {
  private isEnabled: boolean;
  private events: AnalyticsEvent[] = [];
  private sessionStart: number;
  private pafvEngagement: PAFVEngagementData = {
    viewSwitches: 0,
    axisMappingChanges: 0,
    spatialInteractions: 0,
    sessionDuration: 0,
    featureDiscovery: []
  };

  constructor() {
    this.isEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
    this.sessionStart = Date.now();

    // Track session duration on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.trackSessionEnd();
      });
    }
  }

  track(action: string, category: string, label?: string, value?: number): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      action,
      category,
      label,
      value,
      timestamp: Date.now()
    };

    this.events.push(event);

    // Update PAFV-specific metrics
    this.updatePAFVEngagement(event);

    // In a real deployment, this would send to analytics service
    if (import.meta.env.DEV) {
      logger.debug('analytics', 'Analytics event', { event });
    }
  }

  private updatePAFVEngagement(event: AnalyticsEvent): void {
    switch (event.category) {
      case 'PAFV_ViewSwitch':
        this.pafvEngagement.viewSwitches++;
        break;
      case 'PAFV_AxisMapping':
        this.pafvEngagement.axisMappingChanges++;
        break;
      case 'PAFV_Interaction':
        this.pafvEngagement.spatialInteractions++;
        break;
      case 'Feature_Discovery':
        if (event.label && !this.pafvEngagement.featureDiscovery.includes(event.label)) {
          this.pafvEngagement.featureDiscovery.push(event.label);
        }
        break;
    }
  }

  // PAFV-specific tracking methods
  trackViewSwitch(fromView: string, toView: string): void {
    this.track('switch', 'PAFV_ViewSwitch', `${fromView}->${toView}`);
  }

  trackAxisMapping(axis: string, facet: string): void {
    this.track('mapping', 'PAFV_AxisMapping', `${axis}:${facet}`);
  }

  trackSpatialInteraction(interaction: string, details?: string): void {
    this.track(interaction, 'PAFV_Interaction', details);
  }

  trackFeatureDiscovery(feature: string): void {
    this.track('discover', 'Feature_Discovery', feature);
  }

  trackConceptUnderstanding(level: 'confused' | 'partial' | 'clear', context?: string): void {
    this.track('understanding', 'PAFV_Concept', context, level === 'confused' ? 1 : level === 'partial' ? 2 : 3);
  }

  private trackSessionEnd(): void {
    this.pafvEngagement.sessionDuration = Date.now() - this.sessionStart;

    // Log comprehensive engagement summary
    if (this.isEnabled) {
      logger.info('analytics', 'PAFV Session Summary', {
        ...this.pafvEngagement,
        totalEvents: this.events.length,
        engagementScore: this.calculateEngagementScore()
      });
    }
  }

  private calculateEngagementScore(): number {
    const base = Math.min(this.pafvEngagement.sessionDuration / (5 * 60 * 1000), 1); // 5 min max
    const interactions = Math.min(this.pafvEngagement.spatialInteractions / 10, 1); // 10 interactions max
    const exploration = Math.min(this.pafvEngagement.viewSwitches / 5, 1); // 5 switches max
    const discovery = Math.min(this.pafvEngagement.featureDiscovery.length / 8, 1); // 8 features max

    return (base * 0.2 + interactions * 0.4 + exploration * 0.3 + discovery * 0.1) * 100;
  }

  getSessionSummary(): PAFVEngagementData & { engagementScore: number; totalEvents: number } {
    return {
      ...this.pafvEngagement,
      sessionDuration: Date.now() - this.sessionStart,
      engagementScore: this.calculateEngagementScore(),
      totalEvents: this.events.length
    };
  }

  exportUserData(): string {
    return JSON.stringify({
      session: this.getSessionSummary(),
      events: this.events
    }, null, 2);
  }
}

// Global analytics instance
export const analytics = new AnalyticsService();

// Hook for React components
export function useAnalytics() {
  return {
    track: analytics.track.bind(analytics),
    trackViewSwitch: analytics.trackViewSwitch.bind(analytics),
    trackAxisMapping: analytics.trackAxisMapping.bind(analytics),
    trackSpatialInteraction: analytics.trackSpatialInteraction.bind(analytics),
    trackFeatureDiscovery: analytics.trackFeatureDiscovery.bind(analytics),
    trackConceptUnderstanding: analytics.trackConceptUnderstanding.bind(analytics),
    getSessionSummary: analytics.getSessionSummary.bind(analytics),
    exportUserData: analytics.exportUserData.bind(analytics)
  };
}