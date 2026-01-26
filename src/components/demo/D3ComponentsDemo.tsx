/**
 * D3 Components Demo
 *
 * Visual testing page for Isometry D3 components.
 * Showcases iso-card, iso-canvas, D3ViewWrapper, and LATCH scales.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { DemoSection } from './common/DemoSection';
import { CbCardDemo } from './CbCardDemo';
import { CbCanvasDemo } from './CbCanvasDemo';
import { D3ViewWrapperDemo } from './D3ViewWrapperDemo';
import { LATCHScalesDemo } from './LATCHScalesDemo';

export function D3ComponentsDemo() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`min-h-screen p-6 ${
        theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-gray-50'
      }`}
      data-theme={theme}
    >
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1
            className={`text-2xl font-bold ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-900'
            }`}
          >
            CardBoard D3 Components Demo
          </h1>
          <p
            className={`text-sm mt-1 ${
              theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
            }`}
          >
            Visual testing for cb-card, cb-canvas, D3ViewWrapper, and LATCH scales
          </p>
        </div>

        <button
          onClick={() => setTheme(theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP')}
          className={`px-4 py-2 text-sm font-medium rounded ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-2 border-t-white border-l-white border-b-[#707070] border-r-[#707070]'
              : 'bg-white border border-gray-300 hover:bg-gray-100 shadow-sm'
          }`}
        >
          Switch to {theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP'} Theme
        </button>
      </header>

      <div className="max-w-4xl">
        <DemoSection
          title="cb-card Component"
          description="Card component with four variants: default, glass, elevated, outline. Click to toggle selection."
        >
          <CbCardDemo />
        </DemoSection>

        <DemoSection
          title="cb-canvas Component"
          description="Canvas container with zoom/pan and background patterns. Supports content and overlay layers."
        >
          <CbCanvasDemo />
        </DemoSection>

        <DemoSection
          title="D3ViewWrapper Component"
          description="React-D3 bridge component. Wraps cb-canvas with React lifecycle and callbacks."
        >
          <D3ViewWrapperDemo />
        </DemoSection>

        <DemoSection
          title="LATCH Scale Factories"
          description="Scale factories for mapping LATCH axes (Location, Alphabet, Time, Category, Hierarchy) to visual dimensions."
        >
          <LATCHScalesDemo />
        </DemoSection>
      </div>
    </div>
  );
}