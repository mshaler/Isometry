/**
 * A/B Testing Types
 *
 * Type definitions for A/B testing system
 */

export interface ABTest {
  id: string;
  name: string;
  configuration: ABTestConfiguration;
  status: ExperimentStatus;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  variants: ABTestVariant[];
  userAssignments: Record<string, UserAssignment>;
}

export interface ABTestConfiguration {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  targetAudience: string[];
  inclusionCriteria: UserCriteria[];
  exclusionCriteria: UserCriteria[];
  primaryMetric: string;
  secondaryMetrics: string[];
  expectedDuration: number;
  expectedSampleSize: number;
  significanceLevel: number;
  statisticalPower: number;
  enableStatisticalAnalysis: boolean;
  autoStopOnSignificance: boolean;
  linkedFeatureFlag?: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  allocationPercent: number;
  configOverrides: Record<string, any>;
  featureFlags: Record<string, boolean>;
  customProperties: Record<string, any>;
  isControl: boolean;
}

export interface UserAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: Date;
  reassignedAt?: Date;
  conversionEvents: ConversionEvent[];
  exclusionReason?: string;
}

export interface UserCriteria {
  type: CriteriaType;
  field: string;
  operator: ComparisonOperator;
  value: any;
  description: string;
}

export interface ConversionEvent {
  eventType: string;
  timestamp: Date;
  value: number;
  metadata: Record<string, any>;
}

export interface TestMetrics {
  testId: string;
  variant: ABTestVariant;
  participants: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
  significance: boolean;
  lift: number;
  sampleSize: number;
  metrics: Record<string, MetricValue>;
}

export interface MetricValue {
  name: string;
  value: number;
  confidence: number;
  variance: number;
  standardError: number;
  pValue: number;
}

export interface ExperimentAnalysis {
  testId: string;
  status: AnalysisStatus;
  results: TestMetrics[];
  winner?: string;
  recommendations: string[];
  riskAssessment: RiskLevel;
  nextSteps: string[];
}

export interface ABTestContextValue {
  tests: ABTest[];
  isLoading: boolean;
  error?: Error;
  
  // Core operations
  createTest: (config: ABTestConfiguration) => Promise<ABTest>;
  startTest: (testId: string) => Promise<void>;
  stopTest: (testId: string) => Promise<void>;
  deleteTest: (testId: string) => Promise<void>;
  
  // User assignment
  getUserAssignment: (testId: string, userId: string) => UserAssignment | null;
  assignUser: (testId: string, userId: string) => Promise<UserAssignment>;
  
  // Variant selection
  getVariantForUser: (testId: string, userId: string) => ABTestVariant | null;
  isUserInTest: (testId: string, userId: string) => boolean;
  
  // Metrics
  recordConversion: (testId: string, userId: string, eventType: string, value?: number) => Promise<void>;
  getTestMetrics: (testId: string) => Promise<TestMetrics[]>;
  getTestAnalysis: (testId: string) => Promise<ExperimentAnalysis>;
  
  // Configuration
  updateTestConfiguration: (testId: string, updates: Partial<ABTestConfiguration>) => Promise<void>;
  duplicateTest: (testId: string, newName: string) => Promise<ABTest>;
}

export type ExperimentStatus = 'draft' | 'active' | 'paused' | 'stopped' | 'completed';
export type AnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'error';
export type CriteriaType = 'user_property' | 'session_property' | 'device_property' | 'location' | 'time';
export type ComparisonOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
export type RiskLevel = 'low' | 'medium' | 'high';
