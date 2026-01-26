import { createContext, useContext, ReactNode, useRef, useCallback, useEffect } from 'react';

export type FocusableComponent = 'capture' | 'shell' | 'preview';

interface FocusContextValue {
  activeComponent: FocusableComponent | null;
  focusComponent: (component: FocusableComponent) => void;
  registerComponent: (component: FocusableComponent, _element: HTMLElement) => void;
  unregisterComponent: (component: FocusableComponent) => void;
  getComponentElement: (component: FocusableComponent) => HTMLElement | null;
  nextComponent: () => void;
  previousComponent: () => void;
}

interface ComponentListeners {
  element: HTMLElement;
  focusHandler: () => void;
  blurHandler: () => void;
  keydownHandler: (event: KeyboardEvent) => void;
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
  const componentListeners = useRef<Map<FocusableComponent, ComponentListeners>>(new Map());
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

  const registerComponent = useCallback((component: FocusableComponent, _element: HTMLElement) => {
    // Clean up existing listeners if component is being re-registered
    const existingListeners = componentListeners.current.get(component);
    if (existingListeners) {
      const { element: oldElement, focusHandler, blurHandler, keydownHandler } = existingListeners;
      oldElement.removeEventListener('focus', focusHandler);
      oldElement.removeEventListener('blur', blurHandler);
      oldElement.removeEventListener('keydown', keydownHandler);
      componentListeners.current.delete(component);
    }

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

    // Create bound event handlers
    const focusHandler = () => {
      if (activeComponent.current !== component) {
        activeComponent.current = component;
        element.classList.add('notebook-focus-active');
      }
    };

    const blurHandler = () => {
      element.classList.remove('notebook-focus-active');
    };

    const keydownHandler = (event: KeyboardEvent) => {
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
    };

    // Add event listeners
    element.addEventListener('focus', focusHandler);
    element.addEventListener('blur', blurHandler);
    element.addEventListener('keydown', keydownHandler);

    // Store listeners for cleanup
    componentListeners.current.set(component, {
      element,
      focusHandler,
      blurHandler,
      keydownHandler
    });
  }, [focusComponent]);

  const unregisterComponent = useCallback((component: FocusableComponent) => {
    // Clean up event listeners first
    const listeners = componentListeners.current.get(component);
    if (listeners) {
      const { element, focusHandler, blurHandler, keydownHandler } = listeners;
      element.removeEventListener('focus', focusHandler);
      element.removeEventListener('blur', blurHandler);
      element.removeEventListener('keydown', keydownHandler);
      componentListeners.current.delete(component);
    }

    // Clean up element tracking
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