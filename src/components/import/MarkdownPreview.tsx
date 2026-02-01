import React, { useState, useCallback, useMemo } from 'react';
import type { SelectedFile } from './ImportWizard';

export interface MarkdownDialect {
  name: string;
  score: number;
  features: string[];
}

export interface FrontmatterData {
  format: 'yaml' | 'toml' | 'json' | null;
  raw: string;
  parsed: Record<string, any>;
  latchMapping: {
    location?: string[];
    alphabet?: string[];
    time?: string[];
    category?: string[];
    hierarchy?: string[];
  };
}

interface MarkdownPreviewProps {
  file: SelectedFile | null;
  files: SelectedFile[];
  onNext: () => void;
  onFileChange: (file: SelectedFile) => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  file,
  files,
  onNext,
  onFileChange,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'frontmatter' | 'relationships'>('preview');

  // Detect markdown dialect for current file
  const dialectInfo = useMemo(() => {
    if (!file) return null;
    return detectMarkdownDialect(file.content);
  }, [file]);

  // Parse frontmatter for current file
  const frontmatterData = useMemo(() => {
    if (!file) return null;
    return parseFrontmatter(file.content);
  }, [file]);

  // Extract potential relationships
  const relationships = useMemo(() => {
    if (!file) return [];
    return extractRelationshipPreview(file.content, dialectInfo);
  }, [file, dialectInfo]);

  const handleFileSelect = useCallback((selectedFile: SelectedFile) => {
    onFileChange(selectedFile);
  }, [onFileChange]);

  const renderPreview = () => {
    if (!file) return null;

    const content = removeFrontmatter(file.content);

    return (
      <div className="preview-content">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Content Preview</h3>
            <div className="whitespace-pre-wrap font-mono text-sm text-gray-700 dark:text-gray-300 max-h-96 overflow-auto">
              {content.length > 1000
                ? `${content.substring(0, 1000)}...\n\n[Content truncated - ${content.length} total characters]`
                : content
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFrontmatter = () => {
    if (!frontmatterData) {
      return (
        <div className="no-frontmatter text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No frontmatter detected in this file.</p>
        </div>
      );
    }

    return (
      <div className="frontmatter-content space-y-4">
        <div className="format-info">
          <h3 className="text-lg font-semibold mb-2">Format: {frontmatterData.format?.toUpperCase()}</h3>
        </div>

        {/* Raw Frontmatter */}
        <div className="raw-frontmatter">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Raw Frontmatter</h4>
          <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
            {frontmatterData.raw}
          </pre>
        </div>

        {/* Parsed Data */}
        <div className="parsed-data">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Parsed Fields</h4>
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
            {Object.keys(frontmatterData.parsed).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(frontmatterData.parsed).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400 w-24">
                      {key}:
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No parsed fields</p>
            )}
          </div>
        </div>

        {/* LATCH Mapping Preview */}
        <div className="latch-mapping">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">LATCH Property Mapping</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.entries(frontmatterData.latchMapping).map(([category, values]) => (
              <div key={category} className="latch-category">
                <div className="font-semibold text-sm capitalize mb-1 text-gray-700 dark:text-gray-300">
                  {category}
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                  {values && values.length > 0 ? (
                    <ul className="space-y-1">
                      {values.map((value, index) => (
                        <li key={index} className="text-gray-600 dark:text-gray-400">
                          {value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-500">None detected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRelationships = () => {
    if (relationships.length === 0) {
      return (
        <div className="no-relationships text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No relationships detected in this file.</p>
        </div>
      );
    }

    const groupedRelationships = relationships.reduce((acc, rel) => {
      if (!acc[rel.type]) acc[rel.type] = [];
      acc[rel.type].push(rel);
      return acc;
    }, {} as Record<string, typeof relationships>);

    return (
      <div className="relationships-content space-y-4">
        <h3 className="text-lg font-semibold mb-2">
          Detected Relationships ({relationships.length})
        </h3>

        {Object.entries(groupedRelationships).map(([type, rels]) => (
          <div key={type} className="relationship-group">
            <h4 className="font-medium capitalize mb-2 text-gray-700 dark:text-gray-300">
              {type.replace(/([A-Z])/g, ' $1').trim()} ({rels.length})
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <div className="space-y-2">
                {rels.map((rel, index) => (
                  <div key={index} className="relationship-item flex items-start space-x-3">
                    <div className="flex-1">
                      <code className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                        {rel.match}
                      </code>
                      {rel.target && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Target: {rel.target}
                        </div>
                      )}
                      {rel.displayText && rel.displayText !== rel.target && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Display: {rel.displayText}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!file) {
    return (
      <div className="markdown-preview">
        <div className="no-file-selected text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No File Selected
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Select a file from the list below to preview its content and metadata.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="markdown-preview">
      {/* File Selector */}
      <div className="file-selector mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          Preview File ({files.indexOf(file) + 1} of {files.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {files.map((f, index) => (
            <button
              key={index}
              onClick={() => handleFileSelect(f)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                f === file
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dialect Detection */}
      {dialectInfo && (
        <div className="dialect-info mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            Detected Dialect: {dialectInfo.name}
          </h4>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-blue-600 dark:text-blue-300">
              Confidence: {Math.round(dialectInfo.score * 100)}%
            </span>
            {dialectInfo.features.length > 0 && (
              <span className="text-blue-600 dark:text-blue-300">
                Features: {dialectInfo.features.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'preview', label: 'Content Preview' },
              { id: 'frontmatter', label: 'Frontmatter' },
              { id: 'relationships', label: `Relationships (${relationships.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content mb-8">
        {activeTab === 'preview' && renderPreview()}
        {activeTab === 'frontmatter' && renderFrontmatter()}
        {activeTab === 'relationships' && renderRelationships()}
      </div>

      {/* Next Button */}
      <div className="next-action text-center">
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Continue to Field Mapping
        </button>
      </div>
    </div>
  );
};

// Helper Functions

function detectMarkdownDialect(content: string): MarkdownDialect {
  const features: string[] = [];
  let score = 0;

  // Check for wiki-links (Obsidian)
  if (/\[\[.*?\]\]/.test(content)) {
    features.push('wiki-links');
    score += 0.4;
  }

  // Check for hashtags (Obsidian/GitHub)
  if /#[a-zA-Z][a-zA-Z0-9-_]*/.test(content)) {
    features.push('hashtags');
    score += 0.2;
  }

  // Check for tables (GitHub Flavored)
  if (/\|.*\|/.test(content)) {
    features.push('tables');
    score += 0.2;
  }

  // Check for task lists (GitHub Flavored)
  if (/- \[[ x]\]/.test(content)) {
    features.push('task-lists');
    score += 0.2;
  }

  // Check for strikethrough (GitHub Flavored)
  if (/~~.*~~/.test(content)) {
    features.push('strikethrough');
    score += 0.1;
  }

  // Determine dialect based on features
  let dialectName = 'CommonMark';

  if (features.includes('wiki-links') || features.includes('hashtags')) {
    dialectName = 'Obsidian';
    score += 0.1;
  } else if (features.includes('tables') || features.includes('task-lists') || features.includes('strikethrough')) {
    dialectName = 'GitHub Flavored';
    score += 0.1;
  }

  return {
    name: dialectName,
    score: Math.min(score, 1.0),
    features,
  };
}

function parseFrontmatter(content: string): FrontmatterData | null {
  const lines = content.split('\n');

  // Check for YAML frontmatter
  if (lines[0] === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex > 0) {
      const yamlContent = lines.slice(1, endIndex).join('\n');
      const parsed = parseYamlSafe(yamlContent);
      const latchMapping = generateLatchMapping(parsed);

      return {
        format: 'yaml',
        raw: yamlContent,
        parsed,
        latchMapping,
      };
    }
  }

  // Check for TOML frontmatter
  if (lines[0] === '+++') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '+++');
    if (endIndex > 0) {
      const tomlContent = lines.slice(1, endIndex).join('\n');
      const parsed = parseTomlSafe(tomlContent);
      const latchMapping = generateLatchMapping(parsed);

      return {
        format: 'toml',
        raw: tomlContent,
        parsed,
        latchMapping,
      };
    }
  }

  // Check for JSON frontmatter
  if (lines[0] === '{') {
    let braceCount = 0;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      if (braceCount === 0 && i > 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex > 0) {
      const jsonContent = lines.slice(0, endIndex + 1).join('\n');
      const parsed = parseJsonSafe(jsonContent);
      const latchMapping = generateLatchMapping(parsed);

      return {
        format: 'json',
        raw: jsonContent,
        parsed,
        latchMapping,
      };
    }
  }

  return null;
}

function parseYamlSafe(yamlContent: string): Record<string, any> {
  // Simple YAML parser - in real implementation, use a library like js-yaml
  try {
    const result: Record<string, any> = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();

          // Basic type conversion
          if (value === 'true') result[key] = true;
          else if (value === 'false') result[key] = false;
          else if (/^\d+$/.test(value)) result[key] = parseInt(value);
          else if (/^\d+\.\d+$/.test(value)) result[key] = parseFloat(value);
          else result[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

function parseTomlSafe(tomlContent: string): Record<string, any> {
  // Simple TOML parser - in real implementation, use a TOML library
  try {
    const result: Record<string, any> = {};
    const lines = tomlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          const value = trimmed.substring(equalIndex + 1).trim();

          // Basic type conversion
          if (value === 'true') result[key] = true;
          else if (value === 'false') result[key] = false;
          else if (/^\d+$/.test(value)) result[key] = parseInt(value);
          else if (/^\d+\.\d+$/.test(value)) result[key] = parseFloat(value);
          else result[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

function parseJsonSafe(jsonContent: string): Record<string, any> {
  try {
    return JSON.parse(jsonContent);
  } catch {
    return {};
  }
}

function generateLatchMapping(data: Record<string, any>) {
  const mapping = {
    location: [] as string[],
    alphabet: [] as string[],
    time: [] as string[],
    category: [] as string[],
    hierarchy: [] as string[],
  };

  const locationKeys = ['location', 'place', 'geo', 'coordinates', 'address'];
  const alphabetKeys = ['title', 'name', 'label', 'slug', 'id'];
  const timeKeys = ['date', 'created', 'updated', 'modified', 'time', 'published'];
  const categoryKeys = ['category', 'categories', 'tag', 'tags', 'type', 'kind'];
  const hierarchyKeys = ['parent', 'children', 'level', 'depth', 'index', 'order'];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const stringValue = String(value);

    if (locationKeys.some(k => lowerKey.includes(k))) {
      mapping.location.push(`${key}: ${stringValue}`);
    }

    if (alphabetKeys.some(k => lowerKey.includes(k))) {
      mapping.alphabet.push(`${key}: ${stringValue}`);
    }

    if (timeKeys.some(k => lowerKey.includes(k))) {
      mapping.time.push(`${key}: ${stringValue}`);
    }

    if (categoryKeys.some(k => lowerKey.includes(k))) {
      mapping.category.push(`${key}: ${stringValue}`);
    }

    if (hierarchyKeys.some(k => lowerKey.includes(k))) {
      mapping.hierarchy.push(`${key}: ${stringValue}`);
    }
  }

  return mapping;
}

function extractRelationshipPreview(content: string, dialectInfo: MarkdownDialect | null) {
  const relationships: Array<{
    type: string;
    match: string;
    target?: string;
    displayText?: string;
  }> = [];

  // Wiki links (if Obsidian dialect detected or present)
  const wikiLinkMatches = content.match(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g);
  if (wikiLinkMatches) {
    wikiLinkMatches.forEach(match => {
      const components = match.replace(/\[\[|\]\]/g, '').split('|');
      relationships.push({
        type: 'wikiLink',
        match,
        target: components[0],
        displayText: components[1] || components[0],
      });
    });
  }

  // Hashtags
  const hashtagMatches = content.match(/#[a-zA-Z][a-zA-Z0-9-_]*/g);
  if (hashtagMatches) {
    hashtagMatches.forEach(match => {
      relationships.push({
        type: 'tag',
        match,
        target: match.substring(1),
      });
    });
  }

  // Markdown links
  const linkMatches = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
  if (linkMatches) {
    linkMatches.forEach(match => {
      const linkMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        relationships.push({
          type: 'markdownLink',
          match,
          target: linkMatch[2],
          displayText: linkMatch[1],
        });
      }
    });
  }

  // Image references
  const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const imageMatch = match.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imageMatch) {
        relationships.push({
          type: 'imageReference',
          match,
          target: imageMatch[2],
          displayText: imageMatch[1] || 'Image',
        });
      }
    });
  }

  return relationships;
}

function removeFrontmatter(content: string): string {
  const lines = content.split('\n');

  // Remove YAML frontmatter
  if (lines[0] === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex > 0) {
      return lines.slice(endIndex + 1).join('\n').trim();
    }
  }

  // Remove TOML frontmatter
  if (lines[0] === '+++') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '+++');
    if (endIndex > 0) {
      return lines.slice(endIndex + 1).join('\n').trim();
    }
  }

  // Remove JSON frontmatter
  if (lines[0] === '{') {
    let braceCount = 0;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      if (braceCount === 0 && i > 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex > 0) {
      return lines.slice(endIndex + 1).join('\n').trim();
    }
  }

  return content;
}