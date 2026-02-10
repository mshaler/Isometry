import { useState, useRef, useCallback, useEffect } from 'react';
import { Monitor, Minimize2, Maximize2, RotateCcw, Maximize, ArrowLeft, ArrowRight, Download, ZoomIn, ZoomOut, Globe, BarChart3, Grid3x3, Network, Database } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotebook } from '../../contexts/NotebookContext';
import { useWebPreview } from '@/hooks';
import { exportToPDF, exportToHTML, exportToJSON } from '../../utils/import-export/exportUtils';
import { D3VisualizationRenderer } from './D3VisualizationRenderer';
import { SuperGrid } from '../supergrid/SuperGrid';
import { DataInspectorTab } from './preview-tabs/DataInspectorTab';
import { NetworkGraphTab } from './preview-tabs/NetworkGraphTab';
import MDEditor from '@uiw/react-md-editor';

interface PreviewComponentProps {
  className?: string;
}

type PreviewTab = 'supergrid' | 'network' | 'data-inspector' | 'web-preview' | 'd3-visualization';

export function PreviewComponent({ className }: PreviewComponentProps) {
  const { theme } = useTheme();
  const { activeCard, cards, setActiveCard } = useNotebook();
  const [isMinimized, setIsMinimized] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('https://example.com');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>('supergrid');
  const [dataPointCount, setDataPointCount] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const {
    content,
    contentType,
    isLoading,
    error,
    zoom,
    loadUrl,
    setZoom,
    refresh
  } = useWebPreview();

  // Export handlers
  const handleExport = useCallback(async (format: 'pdf' | 'html' | 'json') => {
    if (!activeCard) {
      alert('No active card to export');
      return;
    }

    setIsExporting(true);
    setShowExportDropdown(false);

    try {
      switch (format) {
        case 'pdf':
          await exportToPDF(activeCard, {
            pageSize: 'a4',
            orientation: 'portrait',
            margin: 0.5,
          });
          break;
        case 'html':
          exportToHTML(activeCard, {
            includeCSS: true,
            standalone: true,
            theme: theme,
          });
          break;
        case 'json':
          exportToJSON(activeCard, {
            includeMetadata: true,
            prettyPrint: true,
          });
          break;
      }
    } catch (error) {
      console.error(`Export failed:`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [activeCard, theme]);

  // URL input handler
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewUrl(e.target.value);
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (previewUrl.trim()) {
      loadUrl(previewUrl.trim());
    }
  }, [previewUrl, loadUrl]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(zoom + 25);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(zoom - 25);
  }, [zoom, setZoom]);

  // Tab definitions with icons and labels
  const tabs: Array<{ id: PreviewTab; icon: typeof Grid3x3; label: string; description: string }> = [
    { id: 'supergrid', icon: Grid3x3, label: 'SuperGrid', description: 'Polymorphic data projection' },
    { id: 'network', icon: Network, label: 'Network', description: 'Graph visualization' },
    { id: 'data-inspector', icon: Database, label: 'Inspector', description: 'Data explorer' },
    { id: 'web-preview', icon: Globe, label: 'Web', description: 'Web content preview' },
    { id: 'd3-visualization', icon: BarChart3, label: 'D3 Viz', description: 'Interactive charts' }
  ];

  // Get current tab info
  const currentTab = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const ContentIcon = currentTab.icon;

  // Update data point count when cards change (cross-canvas data flow)
  useEffect(() => {
    setDataPointCount(cards.length);
  }, [cards]);

  if (isMinimized) {
    return (
      <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg`}>
        <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-gray-600" />
            <span className="font-medium text-sm">Preview</span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Maximize"
          >
            <Maximize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg flex flex-col min-w-[300px]`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <ContentIcon size={16} className="text-gray-600" />
          <span className="font-medium text-sm">{currentTab.label}</span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-500">{currentTab.description}</span>
        </div>
        <div className="flex items-center gap-1">

          {/* Export dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={!activeCard || isExporting}
              className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors disabled:opacity-50`}
              title="Export"
            >
              <Download size={14} className="text-gray-600" />
            </button>

            {showExportDropdown && (
              <div className={`absolute top-full right-0 mt-1 ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-200'} border rounded shadow-lg z-50 min-w-[120px]`}>
                <button
                  onClick={() => handleExport('pdf')}
                  className={`w-full text-left px-3 py-2 text-sm hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-100'} transition-colors`}
                >
                  Export PDF
                </button>
                <button
                  onClick={() => handleExport('html')}
                  className={`w-full text-left px-3 py-2 text-sm hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-100'} transition-colors`}
                >
                  Export HTML
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className={`w-full text-left px-3 py-2 text-sm hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-100'} transition-colors`}
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>

          {/* Zoom controls for PDF/images */}
          {(contentType === 'pdf' || contentType === 'image') && (
            <>
              <button
                onClick={handleZoomOut}
                className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
                title="Zoom Out"
              >
                <ZoomOut size={14} className="text-gray-600" />
              </button>
              <span className="text-xs text-gray-600 min-w-[3ch] text-center">
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
                title="Zoom In"
              >
                <ZoomIn size={14} className="text-gray-600" />
              </button>
            </>
          )}

          <button
            onClick={refresh}
            disabled={isLoading}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors disabled:opacity-50`}
            title="Refresh"
          >
            <RotateCcw size={14} className={`text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Fullscreen"
          >
            <Maximize size={14} className="text-gray-600" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Minimize"
          >
            <Minimize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={`border-b flex ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-100'}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border-r transition-colors ${
                isActive
                  ? `${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-white border-gray-300'} text-blue-600 font-medium`
                  : `${theme === 'NeXTSTEP' ? 'hover:bg-[#b0b0b0] border-[#707070]' : 'hover:bg-gray-200 border-gray-200'} text-gray-600 hover:text-gray-900`
              }`}
              title={tab.description}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Address Bar / Context Info */}
      <div className={`border-b ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-white' : 'border-gray-200 bg-gray-50'}`}>
        {activeTab === 'web-preview' ? (
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 p-2">
            <button type="button" className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-gray-200' : 'bg-gray-200'} transition-colors`} title="Back">
              <ArrowLeft size={12} className="text-gray-600" />
            </button>
            <button type="button" className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-gray-200' : 'bg-gray-200'} transition-colors`} title="Forward">
              <ArrowRight size={12} className="text-gray-600" />
            </button>
            <input
              type="text"
              value={previewUrl}
              onChange={handleUrlChange}
              className={`flex-1 px-2 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-white border border-[#707070]' : 'bg-white border border-gray-300'} rounded focus:outline-none focus:ring-1 ${theme === 'NeXTSTEP' ? 'focus:ring-[#707070]' : 'focus:ring-blue-500'}`}
              placeholder="Enter URL to preview..."
            />
          </form>
        ) : activeTab === 'supergrid' ? (
          <div className="flex items-center gap-2 p-2">
            <div className={`flex-1 px-2 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-gray-100 border border-[#707070]' : 'bg-gray-100 border border-gray-300'} rounded text-gray-600`}>
              sql://nodes?filter=active-card-data
            </div>
            {dataPointCount > 0 && (
              <span className="text-xs text-gray-500">
                {dataPointCount} nodes
              </span>
            )}
          </div>
        ) : activeTab === 'network' ? (
          <div className="flex items-center gap-2 p-2">
            <div className={`flex-1 px-2 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-gray-100 border border-[#707070]' : 'bg-gray-100 border border-gray-300'} rounded text-gray-600`}>
              graph://nodes+edges?layout=force-directed
            </div>
          </div>
        ) : activeTab === 'data-inspector' ? (
          <div className="flex items-center gap-2 p-2">
            <div className={`flex-1 px-2 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-gray-100 border border-[#707070]' : 'bg-gray-100 border border-gray-300'} rounded text-gray-600`}>
              inspector://sqlite-schema+data
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <div className={`flex-1 px-2 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-gray-100 border border-[#707070]' : 'bg-gray-100 border border-gray-300'} rounded text-gray-600`}>
              d3://visualization?source=active-card
            </div>
            {dataPointCount > 0 && (
              <span className="text-xs text-gray-500">
                {dataPointCount} points
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 relative">
        {activeTab === 'supergrid' ? (
          /* SuperGrid Tab - Primary Data Projection */
          <SuperGrid
            sql="SELECT * FROM nodes WHERE deleted_at IS NULL LIMIT 100"
            mode="supergrid"
            enableSuperStack={true}
            enableDragDrop={true}
            onCellClick={(node) => {
              // Handle cell selection - update activeCard to trigger cross-canvas updates
              console.warn('SuperGrid cell clicked:', node);
              const card = cards.find(c => c.nodeId === node.id);
              if (card) {
                setActiveCard(card);
              }
            }}
            onHeaderClick={(level, value, axis) => {
              // Handle header filtering
              console.warn('SuperGrid header clicked:', { level, value, axis });
            }}
          />
        ) : activeTab === 'network' ? (
          /* Network Graph Tab - Force-directed GRAPH visualization */
          <NetworkGraphTab
            className="h-full"
            onNodeSelect={(nodeId) => {
              // Find the card associated with this node
              const card = cards.find(c => c.nodeId === nodeId);
              if (card) {
                setActiveCard(card);
              }
            }}
          />
        ) : activeTab === 'data-inspector' ? (
          /* Data Inspector Tab - SQL query interface */
          <DataInspectorTab className="h-full" />
        ) : activeTab === 'd3-visualization' ? (
          /* D3 Visualization Tab */
          <D3VisualizationRenderer
            content={activeCard?.markdownContent || ''}
            width={400}
            height={300}
            className="w-full h-full p-4"
            onDataPointsChange={setDataPointCount}
          />
        ) : (
          /* Web Preview Mode */
          error ? (
            <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded m-4 flex items-center justify-center`}>
              <div className="text-center p-4">
                <div className="text-sm font-medium text-red-600 mb-2">Error Loading Content</div>
                <div className="text-xs text-gray-500">{error}</div>
                <button
                  onClick={refresh}
                  className={`mt-3 px-3 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4] hover:bg-[#b0b0b0] border border-[#707070]' : 'bg-blue-500 hover:bg-blue-600 text-white'} rounded transition-colors`}
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded m-4 flex items-center justify-center`}>
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm text-gray-600">Loading...</div>
              </div>
            </div>
          ) : content ? (
            <div className="h-full p-4">
              {/* Web content iframe */}
              {contentType === 'web' && (
                <iframe
                  ref={iframeRef}
                  src={content}
                  className={`w-full h-full ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-200'} border rounded`}
                  title="Web Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                />
              )}

              {/* PDF content */}
              {contentType === 'pdf' && (
                <iframe
                  src={content}
                  className={`w-full h-full ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-200'} border rounded`}
                  title="PDF Preview"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                />
              )}

              {/* Image content */}
              {contentType === 'image' && (
                <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded flex items-center justify-center overflow-auto`}>
                  <img
                    src={content}
                    alt="Preview"
                    className="max-w-full max-h-full"
                    style={{ transform: `scale(${zoom / 100})` }}
                  />
                </div>
              )}

              {/* Markdown content */}
              {contentType === 'markdown' && (
                <div className={`h-full overflow-auto ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-white border-gray-200'} border rounded`}>
                  <MDEditor.Markdown
                    source={content}
                    style={{ padding: '1rem' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded m-4 flex items-center justify-center`}>
              <div className="text-center">
                <ContentIcon size={48} className="mx-auto mb-3 text-gray-400" />
                <div className="text-sm font-medium text-gray-700 mb-2">Universal Preview</div>
                <div className="text-xs text-gray-500 mb-3">
                  Enter a URL to preview web pages, PDFs, images, or markdown files
                </div>
                <div className="text-xs text-gray-400">
                  Supports: Web pages, PDF documents, images (jpg, png, svg), and markdown files
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Status Bar */}
      <div className={`border-t px-3 py-1 ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-600">
            {activeTab === 'supergrid' ? (
              `SuperGrid • Polymorphic data projection${dataPointCount > 0 ? ` • ${dataPointCount} nodes` : ''}`
            ) : activeTab === 'network' ? (
              'Network Graph • Graph visualization'
            ) : activeTab === 'data-inspector' ? (
              'Data Inspector • SQLite browser'
            ) : activeTab === 'd3-visualization' ? (
              dataPointCount > 0 ? `D3 Visualization • ${dataPointCount} points` : 'D3 ready'
            ) : activeTab === 'web-preview' ? (
              content ? `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} content` : 'No content'
            ) : (
              'Ready'
            )}
            {activeTab === 'web-preview' && (contentType === 'pdf' || contentType === 'image') ? ` • ${zoom}%` : ''}
          </div>
          <div className="text-gray-500">
            {isExporting ? 'Exporting...' : isLoading ? 'Loading...' : 'Ready'}
          </div>
        </div>
      </div>
    </div>
  );
}