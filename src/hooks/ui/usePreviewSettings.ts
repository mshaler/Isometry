import { useState, useEffect, useCallback } from 'react';

export type PreviewTab = 'supergrid' | 'network' | 'timeline' | 'data-inspector' | 'web-preview' | 'd3-visualization';

export interface TabConfig {
  lastAccessed: number;
  zoomLevel?: number;
  filterState?: Record<string, unknown>;
  scrollPosition?: { x: number; y: number };
}

export interface PreviewSettings {
  activeTab: PreviewTab;
  tabConfigs: Record<PreviewTab, TabConfig>;
}

const STORAGE_KEY = 'preview-settings';

const VALID_TABS: PreviewTab[] = [
  'supergrid',
  'network',
  'timeline',
  'data-inspector',
  'web-preview',
  'd3-visualization',
];

const DEFAULT_TAB_CONFIG: TabConfig = {
  lastAccessed: 0,
};

function createDefaultSettings(): PreviewSettings {
  const now = Date.now();
  return {
    activeTab: 'supergrid',
    tabConfigs: {
      supergrid: { lastAccessed: now },
      network: { lastAccessed: 0 },
      timeline: { lastAccessed: 0 },
      'data-inspector': { lastAccessed: 0 },
      'web-preview': { lastAccessed: 0 },
      'd3-visualization': { lastAccessed: 0 },
    },
  };
}

function loadFromStorage(): PreviewSettings {
  try {
    // Migrate legacy 'preview-active-tab' key (written by old inline sessionStorage in PreviewComponent)
    const legacyTab = sessionStorage.getItem('preview-active-tab');
    if (legacyTab && VALID_TABS.includes(legacyTab as PreviewTab)) {
      const defaults = createDefaultSettings();
      defaults.activeTab = legacyTab as PreviewTab;
      sessionStorage.removeItem('preview-active-tab');
      saveToStorage(defaults);
      return defaults;
    }

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();

    const parsed = JSON.parse(raw) as Partial<PreviewSettings>;

    // Validate activeTab
    const activeTab = VALID_TABS.includes(parsed.activeTab as PreviewTab)
      ? (parsed.activeTab as PreviewTab)
      : 'supergrid';

    // Merge stored tabConfigs with defaults so new tabs get defaults
    const defaults = createDefaultSettings();
    const tabConfigs = { ...defaults.tabConfigs };
    if (parsed.tabConfigs) {
      for (const tab of VALID_TABS) {
        const stored = parsed.tabConfigs[tab];
        if (stored && typeof stored.lastAccessed === 'number') {
          tabConfigs[tab] = { ...DEFAULT_TAB_CONFIG, ...stored };
        }
      }
    }

    return { activeTab, tabConfigs };
  } catch {
    // sessionStorage unavailable or invalid JSON
    return createDefaultSettings();
  }
}

function saveToStorage(settings: PreviewSettings): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // sessionStorage unavailable (private browsing, quota exceeded) — silently ignore
  }
}

/**
 * Hook to manage Preview pane settings including active tab, per-tab zoom,
 * and per-tab filter state. All state is persisted to sessionStorage.
 */
export function usePreviewSettings() {
  const [settings, setSettings] = useState<PreviewSettings>(loadFromStorage);

  // Persist to sessionStorage whenever settings change
  useEffect(() => {
    saveToStorage(settings);
  }, [settings]);

  const setActiveTab = useCallback((tab: PreviewTab) => {
    setSettings(prev => ({
      ...prev,
      activeTab: tab,
      tabConfigs: {
        ...prev.tabConfigs,
        [tab]: {
          ...prev.tabConfigs[tab],
          lastAccessed: Date.now(),
        },
      },
    }));
  }, []);

  const setTabZoom = useCallback((tab: PreviewTab, zoomLevel: number) => {
    setSettings(prev => ({
      ...prev,
      tabConfigs: {
        ...prev.tabConfigs,
        [tab]: {
          ...prev.tabConfigs[tab],
          zoomLevel,
        },
      },
    }));
  }, []);

  const setTabFilterState = useCallback((tab: PreviewTab, filterState: Record<string, unknown>) => {
    setSettings(prev => ({
      ...prev,
      tabConfigs: {
        ...prev.tabConfigs,
        [tab]: {
          ...prev.tabConfigs[tab],
          filterState,
        },
      },
    }));
  }, []);

  const setTabScrollPosition = useCallback((tab: PreviewTab, scrollPosition: { x: number; y: number }) => {
    setSettings(prev => ({
      ...prev,
      tabConfigs: {
        ...prev.tabConfigs,
        [tab]: {
          ...prev.tabConfigs[tab],
          scrollPosition,
        },
      },
    }));
  }, []);

  const getTabConfig = useCallback(
    (tab: PreviewTab): TabConfig => settings.tabConfigs[tab] ?? DEFAULT_TAB_CONFIG,
    [settings.tabConfigs]
  );

  return {
    activeTab: settings.activeTab,
    tabConfigs: settings.tabConfigs,
    setActiveTab,
    setTabZoom,
    setTabFilterState,
    setTabScrollPosition,
    getTabConfig,
  };
}
