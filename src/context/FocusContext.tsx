import { createContext, useContext, ReactNode, useRef, useCallback, useEffect } from 'react';

export type FocusableComponent = 'capture' | 'shell' | 'preview';

interface FocusContextValue {
  activeComponent: FocusableComponent | null;
  focusComponent: (component: FocusableComponent) => void;
  registerComponent: (component: FocusableComponent, element: HTMLElement) => void;
  unregisterComponent: (component: FocusableComponent) => void;
  getComponentElement: (component: FocusableComponent) => HTMLElement | null;
  nextComponent: () => void;
  previousComponent: () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

interface FocusProviderProps {
  children: ReactNode;
}

/**
 * Focus management context for notebook components
 * Provides keyboard navigation, accessibility support, and focus tracking
 */
export function FocusProvider({ children }: FocusProviderProps) {
  const activeComponent = useRef<FocusableComponent | null>(null);
  const componentElements = useRef<Map<FocusableComponent, HTMLElement>>(new Map());
  const components: FocusableComponent[] = ['capture', 'shell', 'preview'];

  const focusComponent = useCallback((component: FocusableComponent) => {
    const element = componentElements.current.get(component);
    if (element) {
      activeComponent.current = component;

      // Focus the component element
      element.focus();

      // Add visual focus indicator
      element.classList.add('notebook-focus-active');

      // Remove focus from other components
      componentElements.current.forEach((el, comp) => {
        if (comp !== component) {
          el.classList.remove('notebook-focus-active');
        }
      });

      // Announce to screen readers
      const componentNames = {
        capture: 'Capture Component',
        shell: 'Shell Component',
        preview: 'Preview Component'
      };

      // Create an aria-live announcement
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Focused ${componentNames[component]}`;
      document.body.appendChild(announcement);

      // Remove announcement after it's been read
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }, []);

  const registerComponent = useCallback((component: FocusableComponent, element: HTMLElement) => {
    componentElements.current.set(component, element);

    // Make element focusable if not already
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }

    // Add aria-label for accessibility
    const componentLabels = {
      capture: 'Notebook capture component - press Cmd+1 to focus',
      shell: 'Terminal shell component - press Cmd+2 to focus',
      preview: 'Content preview component - press Cmd+3 to focus'
    };
    element.setAttribute('aria-label', componentLabels[component]);

    // Add focus and blur event listeners
    element.addEventListener('focus', () => {
      if (activeComponent.current !== component) {
        activeComponent.current = component;
        element.classList.add('notebook-focus-active');
      }
    });

    element.addEventListener('blur', () => {
      element.classList.remove('notebook-focus-active');
    });

    // Add keyboard navigation within component
    element.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey)) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            focusComponent('capture');
            break;
          case '2':
            event.preventDefault();
            focusComponent('shell');
            break;
          case '3':
            event.preventDefault();
            focusComponent('preview');
            break;
          case 'Tab':
            event.preventDefault();
            if (event.shiftKey) {
              previousComponent();
            } else {
              nextComponent();
            }
            break;
        }
      }
    });
  }, [focusComponent]);

  const unregisterComponent = useCallback((component: FocusableComponent) => {
    const element = componentElements.current.get(component);
    if (element) {
      element.classList.remove('notebook-focus-active');
      componentElements.current.delete(component);
    }

    if (activeComponent.current === component) {
      activeComponent.current = null;
    }
  }, []);

  const getComponentElement = useCallback((component: FocusableComponent): HTMLElement | null => {
    return componentElements.current.get(component) || null;
  }, []);

  const nextComponent = useCallback(() => {
    const currentIndex = activeComponent.current
      ? components.indexOf(activeComponent.current)
      : -1;
    const nextIndex = (currentIndex + 1) % components.length;
    const nextComponent = components[nextIndex];

    if (componentElements.current.has(nextComponent)) {
      focusComponent(nextComponent);
    }
  }, [focusComponent]);

  const previousComponent = useCallback(() => {
    const currentIndex = activeComponent.current
      ? components.indexOf(activeComponent.current)
      : components.length;
    const prevIndex = (currentIndex - 1 + components.length) % components.length;
    const prevComponent = components[prevIndex];

    if (componentElements.current.has(prevComponent)) {
      focusComponent(prevComponent);
    }
  }, [focusComponent]);

  // Initialize focus on first component when components are registered
  useEffect(() => {
    if (componentElements.current.size > 0 && !activeComponent.current) {
      const firstComponent = components.find(comp => componentElements.current.has(comp));
      if (firstComponent) {
        focusComponent(firstComponent);
      }
    }
  });

  return (
    <FocusContext.Provider value={{
      activeComponent: activeComponent.current,
      focusComponent,
      registerComponent,
      unregisterComponent,
      getComponentElement,
      nextComponent,
      previousComponent
    }}>
      {children}
    </FocusContext.Provider>
  );
}

/**
 * Hook to access focus context
 */
export function useFocusContext(): FocusContextValue {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocusContext must be used within a FocusProvider');
  }
  return context;
}

/**
 * Hook to register a component for focus management
 */
export function useFocusableComponent(component: FocusableComponent) {
  const { registerComponent, unregisterComponent } = useFocusContext();

  return useCallback((element: HTMLElement | null) => {
    if (element) {
      registerComponent(component, element);
    } else {
      unregisterComponent(component);
    }
  }, [component, registerComponent, unregisterComponent]);
}