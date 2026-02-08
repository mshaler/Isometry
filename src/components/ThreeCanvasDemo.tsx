/**
 * Three-Canvas Notebook Integration Demo
 *
 * Showcases the complete three-canvas notebook system:
 * 1. Capture Canvas - TipTap editor with /save-card and /send-to-shell commands
 * 2. Shell Canvas - Claude AI, Terminal, and GSD GUI tabs
 * 3. Preview Canvas - SuperGrid, Network, Data Inspector, Web, and D3 Viz tabs
 *
 * Demonstrates cross-canvas data flow where changes in one canvas
 * immediately reflect in others via shared NotebookContext.
 */

import { useEffect, useState } from 'react';
import { Grid3x3, Terminal, Edit3, ArrowRight, Check, ExternalLink } from 'lucide-react';

interface DemoStep {
  title: string;
  description: string;
  action: string;
  canvas: 'capture' | 'shell' | 'preview';
}

const demoSteps: DemoStep[] = [
  {
    title: 'Create a Card in Capture',
    description: 'Type content in the Capture canvas and use `/save-card` to create a new card',
    action: 'Try typing: "# Test Card\nThis is a test" then /save-card',
    canvas: 'capture'
  },
  {
    title: 'See Live Updates in Preview',
    description: 'Watch the SuperGrid in Preview canvas update immediately with the new card',
    action: 'Check the SuperGrid tab - your card should appear instantly',
    canvas: 'preview'
  },
  {
    title: 'Select Card in SuperGrid',
    description: 'Click on a card in SuperGrid to see it load in Capture for editing',
    action: 'Click any cell in the SuperGrid to select that card',
    canvas: 'preview'
  },
  {
    title: 'Use Shell Commands',
    description: 'Send commands to the shell using the `/send-to-shell` command in Capture',
    action: 'Type: ```bash\nls -la\n``` then /send-to-shell',
    canvas: 'capture'
  },
  {
    title: 'Switch Shell Tabs',
    description: 'Explore the three shell tabs: Claude AI, Terminal, and GSD GUI',
    action: 'Click between the Claude AI, Terminal, and GSD GUI tabs in Shell canvas',
    canvas: 'shell'
  },
  {
    title: 'Explore Preview Tabs',
    description: 'Try the different visualization modes in the Preview canvas',
    action: 'Switch between SuperGrid, Network, Data Inspector, Web, and D3 Viz tabs',
    canvas: 'preview'
  }
];

export function ThreeCanvasDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const markStepComplete = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps(prev => [...prev, step]);
    }
  };

  const getCanvasIcon = (canvas: DemoStep['canvas']) => {
    switch (canvas) {
      case 'capture': return <Edit3 size={16} className="text-blue-500" />;
      case 'shell': return <Terminal size={16} className="text-green-500" />;
      case 'preview': return <Grid3x3 size={16} className="text-purple-500" />;
    }
  };

  const getCanvasColor = (canvas: DemoStep['canvas']) => {
    switch (canvas) {
      case 'capture': return 'bg-blue-50 border-blue-200';
      case 'shell': return 'bg-green-50 border-green-200';
      case 'preview': return 'bg-purple-50 border-purple-200';
    }
  };

  return (
    <div className="fixed top-4 right-4 w-96 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
      <div className="p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1">
            <Edit3 size={16} className="text-blue-500" />
            <Terminal size={16} className="text-green-500" />
            <Grid3x3 size={16} className="text-purple-500" />
          </div>
          <h3 className="font-medium">Three-Canvas Demo</h3>
        </div>
        <p className="text-sm text-gray-600">
          Follow these steps to explore the integrated three-canvas notebook system.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {demoSteps.map((step, index) => (
          <div
            key={index}
            className={`p-3 rounded border transition-colors ${
              completedSteps.includes(index)
                ? 'bg-green-50 border-green-200'
                : index === currentStep
                ? getCanvasColor(step.canvas)
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-shrink-0 mt-0.5">
                {completedSteps.includes(index) ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <>
                    {getCanvasIcon(step.canvas)}
                  </>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">{step.title}</h4>
                <p className="text-xs text-gray-600 mt-1">{step.description}</p>
              </div>
            </div>

            <div className="bg-white rounded p-2 border text-xs font-mono">
              {step.action}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-1 rounded capitalize ${
                step.canvas === 'capture'
                  ? 'bg-blue-100 text-blue-700'
                  : step.canvas === 'shell'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {step.canvas} canvas
              </span>

              {!completedSteps.includes(index) && (
                <button
                  onClick={() => markStepComplete(index)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Mark Done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Progress: {completedSteps.length}/{demoSteps.length}
          </span>
          <div className="flex gap-2">
            <a
              href="?test=p0"
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors inline-flex items-center gap-1"
            >
              P0 Test
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}