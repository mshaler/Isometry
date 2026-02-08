import { useState, useEffect } from 'react';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { contextLogger } from '../../utils/dev-logger';

export function WebViewDiagnostic() {
  const { environment } = useEnvironment();
  const [diagnosticData, setDiagnosticData] = useState<any>({});

  useEffect(() => {
    async function runDiagnostics() {
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const hasWebKit = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';
      const hasMessageHandlers = typeof window !== 'undefined' && typeof window.webkit?.messageHandlers !== 'undefined';
      const isIsometryNative = userAgent.includes('IsometryNative');
      const availableHandlers = typeof window !== 'undefined' && window.webkit?.messageHandlers ?
        Object.keys(window.webkit.messageHandlers) : [];

      // Simplified check for sql.js environment
      const immediateCheck = hasWebKit;
      const bridgeWaitResult = environment.mode === 'webview-bridge';

      const data = {
        userAgent,
        hasWebKit,
        hasMessageHandlers,
        isIsometryNative,
        availableHandlers,
        environmentMode: environment.mode,
        windowLocation: window.location.href,
        immediateCheck,
        bridgeWaitResult,
        timestamp: new Date().toISOString()
      };

      setDiagnosticData(data);

      // Also log to console
      contextLogger.inspect('WebView Diagnostic Data', data);
    }

    runDiagnostics();
  }, [environment.mode]);

  return (
    <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg p-4 max-w-md text-xs z-50">
      <h3 className="font-bold text-yellow-800 mb-2">WebView Bridge Diagnostic</h3>
      <div className="space-y-1 text-yellow-700">
        <div><strong>Environment Mode:</strong> {diagnosticData.environmentMode}</div>
        <div><strong>User Agent:</strong> {diagnosticData.userAgent?.substring(0, 50)}...</div>
        <div><strong>Has WebKit:</strong> {diagnosticData.hasWebKit ? '✅' : '❌'}</div>
        <div><strong>Has MessageHandlers:</strong> {diagnosticData.hasMessageHandlers ? '✅' : '❌'}</div>
        <div><strong>IsometryNative in UA:</strong> {diagnosticData.isIsometryNative ? '✅' : '❌'}</div>
        <div><strong>Available Handlers:</strong> {diagnosticData.availableHandlers?.join(', ') || 'None'}</div>
        <div><strong>Immediate Check:</strong> {diagnosticData.immediateCheck ? '✅' : '❌'}</div>
        <div><strong>Bridge Wait Result:</strong> {diagnosticData.bridgeWaitResult ? '✅' : '❌'}</div>
        <div><strong>URL:</strong> {diagnosticData.windowLocation}</div>
      </div>
    </div>
  );
}