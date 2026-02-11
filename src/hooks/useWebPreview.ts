import { useState, useCallback } from 'react';

export interface PreviewState {
  isLoading: boolean;
  content: string;
  url: string | null;
  error: string | null;
  lastUpdated: Date | null;
}

export interface WebPreview {
  state: PreviewState;
  loadUrl: (url: string) => Promise<void>;
  setContent: (content: string) => void;
  refresh: () => Promise<void>;
  clear: () => void;
}

/**
 * Hook for web preview functionality in notebook components
 * Bridge eliminated - simplified preview handling
 */
export function useWebPreview(): WebPreview {
  const [state, setState] = useState<PreviewState>({
    isLoading: false,
    content: '',
    url: null,
    error: null,
    lastUpdated: null
  });

  const loadUrl = useCallback(async (url: string): Promise<void> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      url
    }));

    try {
      // In v4, web preview would be simplified since there's no bridge
      // For now, just set a placeholder content
      const content = `
        <div style="padding: 2rem; text-align: center; font-family: system-ui;">
          <h2>Web Preview</h2>
          <p>URL: ${url}</p>
          <p style="color: #666;">Bridge eliminated - web preview simplified in v4</p>
        </div>
      `;

      setState(prev => ({
        ...prev,
        isLoading: false,
        content,
        lastUpdated: new Date()
      }));
    } catch (error: unknown) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }, []);

  const setContent = useCallback((content: string) => {
    setState(prev => ({
      ...prev,
      content,
      url: null,
      error: null,
      lastUpdated: new Date()
    }));
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (state.url) {
      await loadUrl(state.url);
    }
  }, [state.url, loadUrl]);

  const clear = useCallback(() => {
    setState({
      isLoading: false,
      content: '',
      url: null,
      error: null,
      lastUpdated: null
    });
  }, []);

  return {
    state,
    loadUrl,
    setContent,
    refresh,
    clear
  };
}