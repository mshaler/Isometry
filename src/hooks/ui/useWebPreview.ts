import { useState, useCallback, useRef, useEffect } from 'react';

interface UseWebPreviewOptions {
  allowJavaScript?: boolean;
  allowSameOrigin?: boolean;
  enablePDFViewer?: boolean;
}

interface WebPreviewState {
  content: string | null;
  contentType: 'web' | 'pdf' | 'image' | 'markdown' | 'unknown';
  isLoading: boolean;
  error: string | null;
  zoom: number;
}

interface UseWebPreviewReturn extends WebPreviewState {
  loadUrl: (url: string) => Promise<void>;
  setZoom: (zoom: number) => void;
  refresh: () => Promise<void>;
  resetZoom: () => void;
}

// const DEFAULT_OPTIONS: UseWebPreviewOptions = {
//   allowJavaScript: true,
//   allowSameOrigin: true,
//   enablePDFViewer: true,
// };

const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];

/**
 * Hook for secure web content preview with iframe sandboxing and PDF support
 */
export function useWebPreview(_options: UseWebPreviewOptions = {}): UseWebPreviewReturn {
  // const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<WebPreviewState>({
    content: null,
    contentType: 'unknown',
    isLoading: false,
    error: null,
    zoom: 100,
  });

  const currentUrlRef = useRef<string | null>(null);
  const loadingControllerRef = useRef<AbortController | null>(null);

  // Validate and sanitize URL
  const validateUrl = useCallback((url: string): { valid: boolean; sanitized: string; error?: string } => {
    try {
      // Check for dangerous schemes
      const lowerUrl = url.toLowerCase().trim();
      for (const scheme of DANGEROUS_SCHEMES) {
        if (lowerUrl.startsWith(scheme)) {
          return {
            valid: false,
            sanitized: '',
            error: `Blocked dangerous scheme: ${scheme}`
          };
        }
      }

      // Allow local file URLs for markdown preview (but with security warning)
      if (lowerUrl.startsWith('file://')) {
        console.warn('Loading local file - ensure this is intentional and safe');
        return { valid: true, sanitized: url };
      }

      // Ensure URL has protocol
      if (!url.match(/^https?:\/\//)) {
        // Default to https for security
        const sanitized = `https://${url}`;
        return { valid: true, sanitized };
      }

      // Create URL object for validation
      new URL(url);
      return { valid: true, sanitized: url };
    } catch (error) {
      return {
        valid: false,
        sanitized: '',
        error: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, []);

  // Detect content type from URL
  const detectContentType = useCallback((url: string): WebPreviewState['contentType'] => {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.match(/\.(pdf)(\?.*)?$/)) {
      return 'pdf';
    }

    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/)) {
      return 'image';
    }

    if (lowerUrl.match(/\.(md|markdown)(\?.*)?$/)) {
      return 'markdown';
    }

    if (lowerUrl.startsWith('http')) {
      return 'web';
    }

    return 'unknown';
  }, []);

  // Load URL content
  const loadUrl = useCallback(async (url: string) => {
    // Cancel any existing load operation
    if (loadingControllerRef.current) {
      loadingControllerRef.current.abort();
    }

    const validation = validateUrl(url);
    if (!validation.valid) {
      setState(prev => ({
        ...prev,
        content: null,
        contentType: 'unknown',
        isLoading: false,
        error: validation.error || 'Invalid URL',
      }));
      return;
    }

    const sanitizedUrl = validation.sanitized;
    const contentType = detectContentType(sanitizedUrl);
    currentUrlRef.current = sanitizedUrl;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      contentType,
    }));

    const controller = new AbortController();
    loadingControllerRef.current = controller;

    try {
      // For PDF files, we'll use the browser's built-in PDF viewer
      if (contentType === 'pdf') {
        setState(prev => ({
          ...prev,
          content: sanitizedUrl,
          isLoading: false,
        }));
        return;
      }

      // For images, we can load them directly
      if (contentType === 'image') {
        // Validate image can be loaded
        const img = new Image();
        img.onload = () => {
          if (!controller.signal.aborted) {
            setState(prev => ({
              ...prev,
              content: sanitizedUrl,
              isLoading: false,
            }));
          }
        };
        img.onerror = () => {
          if (!controller.signal.aborted) {
            setState(prev => ({
              ...prev,
              content: null,
              isLoading: false,
              error: 'Failed to load image',
            }));
          }
        };
        img.src = sanitizedUrl;
        return;
      }

      // For markdown files, try to fetch content
      if (contentType === 'markdown') {
        try {
          const response = await fetch(sanitizedUrl, {
            signal: controller.signal,
            mode: 'cors',
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const text = await response.text();

          if (!controller.signal.aborted) {
            setState(prev => ({
              ...prev,
              content: text,
              isLoading: false,
            }));
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setState(prev => ({
              ...prev,
              content: null,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed to fetch markdown',
            }));
          }
        }
        return;
      }

      // For web content, we'll load it in an iframe
      if (contentType === 'web') {
        setState(prev => ({
          ...prev,
          content: sanitizedUrl,
          isLoading: false,
        }));
        return;
      }

      // Unknown content type
      setState(prev => ({
        ...prev,
        content: null,
        isLoading: false,
        error: 'Unsupported content type',
      }));

    } catch (error) {
      if (!controller.signal.aborted) {
        setState(prev => ({
          ...prev,
          content: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load content',
        }));
      }
    }
  }, [validateUrl, detectContentType]);

  // Set zoom level
  const setZoom = useCallback((zoom: number) => {
    const clampedZoom = Math.max(25, Math.min(500, zoom));
    setState(prev => ({ ...prev, zoom: clampedZoom }));
  }, []);

  // Refresh current URL
  const refresh = useCallback(async () => {
    if (currentUrlRef.current) {
      await loadUrl(currentUrlRef.current);
    }
  }, [loadUrl]);

  // Reset zoom to 100%
  const resetZoom = useCallback(() => {
    setZoom(100);
  }, [setZoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadingControllerRef.current) {
        loadingControllerRef.current.abort();
      }
    };
  }, []);

  return {
    content: state.content,
    contentType: state.contentType,
    isLoading: state.isLoading,
    error: state.error,
    zoom: state.zoom,
    loadUrl,
    setZoom,
    refresh,
    resetZoom,
  };
}