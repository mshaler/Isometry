import { useEnvironment } from '../../contexts/EnvironmentContext';

export function EnvironmentDebug() {
  const { environment, isLoading, error } = useEnvironment();

  if (isLoading) {
    return (
      <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-sm z-50">
        <div className="font-medium text-yellow-800">🔍 Environment Detection</div>
        <div className="text-yellow-700">Detecting database environment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-300 rounded-lg p-3 text-sm z-50">
        <div className="font-medium text-red-800">❌ Environment Error</div>
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  const getModeDisplay = () => {
    switch (environment.mode) {
      case 'webview-bridge':
        return { icon: '🌐', label: 'Native Bridge Connected', color: 'green' };
      case 'http-api':
        return { icon: '🔌', label: 'HTTP API Mode', color: 'blue' };
      case 'fallback':
        return { icon: '💾', label: 'Fallback Mode (Local)', color: 'gray' };
      default:
        return { icon: '❓', label: 'Unknown Mode', color: 'red' };
    }
  };

  const { icon, label, color } = getModeDisplay();

  return (
    <div className={`fixed top-4 right-4 bg-${color}-100 border border-${color}-300 rounded-lg p-3 text-sm z-50`}>
      <div className={`font-medium text-${color}-800`}>
        {icon} {label}
      </div>
      <div className={`text-${color}-700 text-xs mt-1`}>
        Platform: {environment.platform} | Performance: {environment.performanceProfile}
      </div>
      {environment.capabilities.hasRealTimeSync && (
        <div className={`text-${color}-600 text-xs`}>
          ✅ Real-time sync available
        </div>
      )}
    </div>
  );
}