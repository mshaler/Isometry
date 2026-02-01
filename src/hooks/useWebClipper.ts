import { useState, useCallback } from 'react';

interface ExtractedContent {
  title: string;
  content: string;
  summary?: string;
  url: string;
  metadata: {
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    author?: string;
    publishedDate?: Date;
    tags?: string[];
  };
}

interface ExtractionProgress {
  step: string;
  percentage: number;
  details?: string;
}

export const useWebClipper = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);

  const simulateProgress = useCallback((steps: { step: string; duration: number; details?: string }[]) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0;

      const processStep = () => {
        if (currentIndex >= steps.length) {
          resolve();
          return;
        }

        const step = steps[currentIndex];
        setProgress({
          step: step.step,
          percentage: ((currentIndex + 1) / steps.length) * 100,
          details: step.details,
        });

        setTimeout(() => {
          currentIndex++;
          processStep();
        }, step.duration);
      };

      processStep();
    });
  }, []);

  const extractContent = useCallback(async (url: string): Promise<void> => {
    setIsExtracting(true);
    setError(null);
    setProgress(null);
    setExtractedContent(null);

    try {
      // Simulate the extraction process steps
      const extractionSteps = [
        { step: 'checking-robots', duration: 800, details: 'Verifying crawling permissions...' },
        { step: 'downloading', duration: 1200, details: 'Fetching page content...' },
        { step: 'extracting-content', duration: 1500, details: 'Applying readability algorithm...' },
        { step: 'processing-images', duration: 1000, details: 'Caching images locally...' },
        { step: 'extracting-metadata', duration: 600, details: 'Parsing metadata and tags...' },
        { step: 'cleaning-content', duration: 700, details: 'Removing tracking and ads...' },
        { step: 'finalizing', duration: 400, details: 'Preparing content...' },
      ];

      await simulateProgress(extractionSteps);

      // Simulate API call to native web clipper
      // In real implementation, this would call the native WebClipperActor
      const response = await fetch('/api/webclip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`Failed to extract content: ${response.statusText}`);
      }

      const result = await response.json();

      // For demo purposes, create mock content if API isn't available
      const mockContent: ExtractedContent = {
        title: result.title || 'Sample Article Title',
        content: result.content || `
          <h1>Sample Article Content</h1>
          <p>This is a sample extracted article demonstrating the web clipping functionality. In a real implementation, this would be the actual content extracted from the web page at <strong>${url}</strong>.</p>
          <p>The content extraction process includes:</p>
          <ul>
            <li>Removing navigation, ads, and clutter</li>
            <li>Preserving the main article text and images</li>
            <li>Extracting metadata and structured data</li>
            <li>Applying privacy protection measures</li>
          </ul>
          <p>Images are cached locally and tracking elements are stripped to protect your privacy while preserving the essential content.</p>
        `,
        summary: result.summary || 'A sample article demonstrating web clipping functionality with content extraction and privacy protection.',
        url,
        metadata: {
          title: result.metadata?.title || 'Sample Article Title',
          description: result.metadata?.description || 'A sample article for demonstrating web clipping',
          siteName: result.metadata?.siteName || new URL(url).hostname,
          author: result.metadata?.author || 'Unknown Author',
          publishedDate: result.metadata?.publishedDate ? new Date(result.metadata.publishedDate) : new Date(),
          tags: result.metadata?.tags || ['web-clip', 'article', 'sample'],
          imageUrl: result.metadata?.imageUrl,
        },
      };

      setExtractedContent(mockContent);
    } catch (err) {
      console.error('Web clipping failed:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setIsExtracting(false);
      setProgress(null);
    }
  }, [simulateProgress]);

  const saveContent = useCallback(async (): Promise<void> => {
    if (!extractedContent) {
      throw new Error('No content to save');
    }

    setIsSaving(true);
    setError(null);

    try {
      // Simulate API call to save content
      // In real implementation, this would call the database to save the Node
      const response = await fetch('/api/webclip/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractedContent),
      });

      if (!response.ok) {
        throw new Error(`Failed to save content: ${response.statusText}`);
      }

      // For demo purposes, just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Content saved successfully');
    } catch (err) {
      console.error('Failed to save content:', err);
      setError(err instanceof Error ? err : new Error('Failed to save content'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [extractedContent]);

  const reset = useCallback(() => {
    setIsExtracting(false);
    setIsSaving(false);
    setExtractedContent(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    isExtracting,
    isSaving,
    extractedContent,
    error,
    progress,
    extractContent,
    saveContent,
    reset,
  };
};