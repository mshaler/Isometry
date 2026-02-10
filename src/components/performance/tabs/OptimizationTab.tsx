/**
 * Performance Optimization Tab
 *
 * Performance presets, auto-optimization controls, and recommendations
 */

import { PERFORMANCE_PRESETS } from '../constants';
import type { OptimizationRecommendation } from '../types';

interface OptimizationTabProps {
  selectedPreset: string;
  autoOptimizeEnabled: boolean;
  recommendations: OptimizationRecommendation[];
  onPresetChange: (presetName: string) => void;
  onAutoOptimizeToggle: (enabled: boolean) => void;
  renderRecommendationCard: (recommendation: OptimizationRecommendation) => JSX.Element;
}

export function OptimizationTab({
  selectedPreset,
  autoOptimizeEnabled,
  recommendations,
  onPresetChange,
  onAutoOptimizeToggle,
  renderRecommendationCard
}: OptimizationTabProps) {
  return (
    <div className="space-y-6">
      {/* Performance Presets */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Presets</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PERFORMANCE_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => onPresetChange(preset.name)}
              className={`text-left p-4 border rounded-lg ${
                selectedPreset === preset.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h5 className="font-medium text-gray-900">{preset.name}</h5>
              <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
              <div className="text-xs text-gray-500 mt-2">
                Target: {preset.targetFPS}fps
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Optimization Toggle */}
      <div className="bg-white rounded-lg shadow p-4 border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Auto-Optimization</h4>
            <p className="text-sm text-gray-600">Automatically adjust settings based on performance</p>
          </div>
          <button
            onClick={() => onAutoOptimizeToggle(!autoOptimizeEnabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              autoOptimizeEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autoOptimizeEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Optimization Recommendations */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h4>
        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.slice(0, 4).map(rec => renderRecommendationCard(rec))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4 border text-center text-gray-500">
            No optimization recommendations at this time
          </div>
        )}
      </div>
    </div>
  );
}