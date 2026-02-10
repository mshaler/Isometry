/**
 * Analytics utilities for user testing and PAFV concept validation
 *
 * Tracks user interactions to understand PAFV spatial projection engagement
 */

import { logger } from './logger';

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

// User Testing Integration Types
interface UserTestingData {
  feedbackEvents: number;
  feedbackSubmissions: number;
  averageRating: number;
  conceptUnderstandingScore: number;
  confusionEvents: number;
  successEvents: number;
  frustrationEvents: number;
  discoveryEvents: number;
}

interface BehavioralInference {
  axisMappingAccuracy: number;
  explorationPatterns: string[];
  helpSystemUsage: number;
  errorRecoveryTime: number;
  heatmapInteractions: Array<{
    x: number;
    y: number;
    action: string;
    timestamp: number;
  }>;
}

interface CrossCanvasFlow {
  captureToShellCount: number;
  shellToPreviewCount: number;
  roundTripCompletions: number;
  averageFlowDuration: number;
  abandonmentRate: number;
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

  // User Testing Analytics
  private userTestingData: UserTestingData = {
    feedbackEvents: 0,
    feedbackSubmissions: 0,
    averageRating: 0,
    conceptUnderstandingScore: 0,
    confusionEvents: 0,
    successEvents: 0,
    frustrationEvents: 0,
    discoveryEvents: 0
  };

  private behavioralInference: BehavioralInference = {
    axisMappingAccuracy: 0,
    explorationPatterns: [],
    helpSystemUsage: 0,
    errorRecoveryTime: 0,
    heatmapInteractions: []
  };

  private crossCanvasFlow: CrossCanvasFlow = {
    captureToShellCount: 0,
    shellToPreviewCount: 0,
    roundTripCompletions: 0,
    averageFlowDuration: 0,
    abandonmentRate: 0
  };

  private feedbackRatings: number[] = [];
  private conceptScores: number[] = [];

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

      // User Testing Categories
      case 'User_Testing':
        this.updateUserTestingData(event);
        break;
      case 'Behavioral_Inference':
        this.updateBehavioralInference(event);
        break;
      case 'Cross_Canvas':
        this.updateCrossCanvasFlow(event);
        break;
    }
  }

  private updateUserTestingData(event: AnalyticsEvent): void {
    switch (event.action) {
      case 'feedback_triggered':
        this.userTestingData.feedbackEvents++;
        break;
      case 'feedback_submitted':
        this.userTestingData.feedbackSubmissions++;
        if (event.value) {
          this.feedbackRatings.push(event.value);
          this.userTestingData.averageRating =
            this.feedbackRatings.reduce((a, b) => a + b, 0) / this.feedbackRatings.length;
        }
        break;
      case 'confusion':
        this.userTestingData.confusionEvents++;
        break;
      case 'success':
        this.userTestingData.successEvents++;
        break;
      case 'frustration':
        this.userTestingData.frustrationEvents++;
        break;
      case 'discovery':
        this.userTestingData.discoveryEvents++;
        break;
      case 'concept_understanding':
        if (event.value) {
          this.conceptScores.push(event.value);
          this.userTestingData.conceptUnderstandingScore =
            this.conceptScores.reduce((a, b) => a + b, 0) / this.conceptScores.length;
        }
        break;
    }
  }

  private updateBehavioralInference(event: AnalyticsEvent): void {
    switch (event.action) {
      case 'axis_mapping_accuracy':
        if (event.value !== undefined) {
          this.behavioralInference.axisMappingAccuracy = event.value;
        }
        break;
      case 'exploration_pattern':
        if (event.label && !this.behavioralInference.explorationPatterns.includes(event.label)) {
          this.behavioralInference.explorationPatterns.push(event.label);
        }
        break;
      case 'help_usage':
        this.behavioralInference.helpSystemUsage++;
        break;
      case 'error_recovery':
        if (event.value !== undefined) {
          this.behavioralInference.errorRecoveryTime = event.value;
        }
        break;
      case 'heatmap_interaction':
        // event.label should be "x:y:action" format
        if (event.label) {
          const [x, y, action] = event.label.split(':');
          this.behavioralInference.heatmapInteractions.push({
            x: parseFloat(x),
            y: parseFloat(y),
            action,
            timestamp: event.timestamp
          });
        }
        break;
    }
  }

  private updateCrossCanvasFlow(event: AnalyticsEvent): void {
    switch (event.action) {
      case 'capture_to_shell':
        this.crossCanvasFlow.captureToShellCount++;
        break;
      case 'shell_to_preview':
        this.crossCanvasFlow.shellToPreviewCount++;
        break;
      case 'roundtrip_complete':
        this.crossCanvasFlow.roundTripCompletions++;
        if (event.value !== undefined) {
          // Update average flow duration
          const count = this.crossCanvasFlow.roundTripCompletions;
          const oldAvg = this.crossCanvasFlow.averageFlowDuration;
          this.crossCanvasFlow.averageFlowDuration =
            (oldAvg * (count - 1) + event.value) / count;
        }
        break;
      case 'flow_abandoned': {
        // Calculate abandonment rate (simple ratio for now)
        const totalFlowAttempts = this.crossCanvasFlow.captureToShellCount;
        const abandonments = event.value || 1;
        this.crossCanvasFlow.abandonmentRate =
          totalFlowAttempts > 0 ? abandonments / totalFlowAttempts : 0;
        break;
      }
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
    this.track('concept_understanding', 'User_Testing', level, level === 'confused' ? 1 : level === 'partial' ? 2 : 3);
  }

  // User Testing Methods
  trackFeedbackEvent(type: 'triggered' | 'submitted' | 'dismissed', rating?: number, category?: string): void {
    this.track(`feedback_${type}`, 'User_Testing', category, rating);
  }

  trackUserExperience(type: 'confusion' | 'success' | 'frustration' | 'discovery', context: string): void {
    this.track(type, 'User_Testing', context);
  }

  trackHeatmapInteraction(x: number, y: number, action: string): void {
    this.track('heatmap_interaction', 'Behavioral_Inference', `${x}:${y}:${action}`);
  }

  trackAxisMappingAccuracy(accuracy: number): void {
    this.track('axis_mapping_accuracy', 'Behavioral_Inference', undefined, accuracy);
  }

  trackExplorationPattern(pattern: string): void {
    this.track('exploration_pattern', 'Behavioral_Inference', pattern);
  }

  trackHelpSystemUsage(): void {
    this.track('help_usage', 'Behavioral_Inference');
  }

  trackErrorRecovery(recoveryTimeMs: number): void {
    this.track('error_recovery', 'Behavioral_Inference', undefined, recoveryTimeMs);
  }

  trackCrossCanvasFlow(flowType: 'capture_to_shell' | 'shell_to_preview' | 'roundtrip_complete' | 'flow_abandoned', duration?: number): void {
    this.track(flowType, 'Cross_Canvas', undefined, duration);
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

  getSessionSummary(): PAFVEngagementData & {
    engagementScore: number;
    totalEvents: number;
    userTesting: UserTestingData;
    behavioralInference: BehavioralInference;
    crossCanvasFlow: CrossCanvasFlow;
  } {
    return {
      ...this.pafvEngagement,
      sessionDuration: Date.now() - this.sessionStart,
      engagementScore: this.calculateEngagementScore(),
      totalEvents: this.events.length,
      userTesting: { ...this.userTestingData },
      behavioralInference: {
        ...this.behavioralInference,
        // Limit heatmap data to last 100 interactions for performance
        heatmapInteractions: this.behavioralInference.heatmapInteractions.slice(-100)
      },
      crossCanvasFlow: { ...this.crossCanvasFlow }
    };
  }

  getUserTestingMetrics(): UserTestingData {
    return { ...this.userTestingData };
  }

  getBehavioralMetrics(): BehavioralInference {
    return { ...this.behavioralInference };
  }

  getCrossCanvasMetrics(): CrossCanvasFlow {
    return { ...this.crossCanvasFlow };
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
    // Core tracking
    track: analytics.track.bind(analytics),

    // PAFV tracking
    trackViewSwitch: analytics.trackViewSwitch.bind(analytics),
    trackAxisMapping: analytics.trackAxisMapping.bind(analytics),
    trackSpatialInteraction: analytics.trackSpatialInteraction.bind(analytics),
    trackFeatureDiscovery: analytics.trackFeatureDiscovery.bind(analytics),
    trackConceptUnderstanding: analytics.trackConceptUnderstanding.bind(analytics),

    // User Testing tracking
    trackFeedbackEvent: analytics.trackFeedbackEvent.bind(analytics),
    trackUserExperience: analytics.trackUserExperience.bind(analytics),
    trackHeatmapInteraction: analytics.trackHeatmapInteraction.bind(analytics),
    trackAxisMappingAccuracy: analytics.trackAxisMappingAccuracy.bind(analytics),
    trackExplorationPattern: analytics.trackExplorationPattern.bind(analytics),
    trackHelpSystemUsage: analytics.trackHelpSystemUsage.bind(analytics),
    trackErrorRecovery: analytics.trackErrorRecovery.bind(analytics),
    trackCrossCanvasFlow: analytics.trackCrossCanvasFlow.bind(analytics),

    // Data access
    getSessionSummary: analytics.getSessionSummary.bind(analytics),
    getUserTestingMetrics: analytics.getUserTestingMetrics.bind(analytics),
    getBehavioralMetrics: analytics.getBehavioralMetrics.bind(analytics),
    getCrossCanvasMetrics: analytics.getCrossCanvasMetrics.bind(analytics),
    exportUserData: analytics.exportUserData.bind(analytics)
  };
}