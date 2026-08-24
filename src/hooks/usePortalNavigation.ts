import { useState, useEffect, useCallback, useRef } from 'react';

export interface UsePortalNavigationOptions<T extends string> {
  portalKey: string;
  defaultTab: T;
  storageKey?: string;
  onTabChange?: (newTab: T) => void;
}

export function usePortalNavigation<T extends string>({
  portalKey,
  defaultTab,
  storageKey,
  onTabChange,
}: UsePortalNavigationOptions<T>) {
  const [activeTab, setActiveTabState] = useState<T>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey) as T | null;
      if (saved) return saved;
    }
    return defaultTab;
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAppMode, setIsAppMode] = useState(false);
  const historyStackRef = useRef<T[]>([activeTab]);
  const isNavigatingRef = useRef(false);

  // App mode detection (Standalone PWA, Android App referrer, or touch mobile app context)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAppMode = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isFullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const isAndroidApp = document.referrer.includes('android-app://');
      const isAppQuery = window.location.search.includes('app=true') || window.location.search.includes('pwa=true');
      const isMobileAppViewport = window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

      const appMode = isStandaloneMedia || isFullscreenMedia || isIOSStandalone || isAndroidApp || isAppQuery || isMobileAppViewport;
      setIsAppMode(appMode);
    };

    checkAppMode();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => checkAppMode();

    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      mediaQuery.addListener(handleMediaChange);
    }

    window.addEventListener('resize', checkAppMode);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        mediaQuery.removeListener(handleMediaChange);
      }
      window.removeEventListener('resize', checkAppMode);
    };
  }, []);

  // Save to localStorage and reset scroll to top whenever activeTab changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, activeTab);
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const scrollContainers = document.querySelectorAll('main, .overflow-y-auto, [data-scroll-container]');
      scrollContainers.forEach(el => {
        el.scrollTop = 0;
      });
    }
  }, [activeTab, storageKey]);

  // Set up sentinel history entry on mount so mobile hardware back button stays within portal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push initial portal root state
    const currentHash = window.location.hash.replace('#', '');
    const initialTab = (currentHash as T) || activeTab;

    window.history.replaceState(
      { portal: portalKey, tab: initialTab, isRoot: true, timestamp: Date.now() },
      '',
      `#${initialTab}`
    );

    const handlePopState = (event: PopStateEvent) => {
      // 1. If drawer menu is open, close it first and prevent screen switch
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        // Re-push current state to maintain history position
        window.history.pushState(
          { portal: portalKey, tab: activeTab, timestamp: Date.now() },
          '',
          `#${activeTab}`
        );
        return;
      }

      // 2. If event has state for this portal, restore that tab
      const state = event.state;
      if (state && state.portal === portalKey && state.tab) {
        isNavigatingRef.current = true;
        setActiveTabState(state.tab as T);
        if (onTabChange) onTabChange(state.tab as T);
        if (storageKey) localStorage.setItem(storageKey, state.tab);

        // Update history stack
        const stack = historyStackRef.current;
        if (stack.length > 1) {
          stack.pop();
        }
        isNavigatingRef.current = false;
        return;
      }

      // 3. If history popped to pre-portal or root, navigate to default tab instead of login page
      const stack = historyStackRef.current;
      if (stack.length > 1) {
        stack.pop();
        const prevTab = stack[stack.length - 1] || defaultTab;
        isNavigatingRef.current = true;
        setActiveTabState(prevTab);
        if (onTabChange) onTabChange(prevTab);
        if (storageKey) localStorage.setItem(storageKey, prevTab);
        isNavigatingRef.current = false;

        // Push state so subsequent back presses are also caught
        window.history.pushState(
          { portal: portalKey, tab: prevTab, timestamp: Date.now() },
          '',
          `#${prevTab}`
        );
      } else {
        // At root tab — keep user safely on default tab
        setActiveTabState(defaultTab);
        if (onTabChange) onTabChange(defaultTab);
        window.history.pushState(
          { portal: portalKey, tab: defaultTab, isRoot: true, timestamp: Date.now() },
          '',
          `#${defaultTab}`
        );
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [portalKey, defaultTab, activeTab, isMobileMenuOpen, onTabChange, storageKey]);

  // Tab change function that pushes to history
  const handleTabChange = useCallback((tab: T) => {
    if (tab === activeTab) {
      setIsMobileMenuOpen(false);
      return;
    }

    if (!isNavigatingRef.current && typeof window !== 'undefined') {
      historyStackRef.current.push(tab);
      window.history.pushState(
        { portal: portalKey, tab, timestamp: Date.now() },
        '',
        `#${tab}`
      );
    }

    setActiveTabState(tab);
    setIsMobileMenuOpen(false);
    if (onTabChange) onTabChange(tab);
    if (storageKey) localStorage.setItem(storageKey, tab);
  }, [activeTab, portalKey, onTabChange, storageKey]);

  // In-App & Website Go Back Handler
  const handleGoBack = useCallback(() => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      return;
    }

    const stack = historyStackRef.current;
    if (stack.length > 1) {
      stack.pop();
      const prevTab = stack[stack.length - 1] || defaultTab;
      isNavigatingRef.current = true;
      setActiveTabState(prevTab);
      if (onTabChange) onTabChange(prevTab);
      if (storageKey) localStorage.setItem(storageKey, prevTab);

      if (typeof window !== 'undefined') {
        window.history.pushState(
          { portal: portalKey, tab: prevTab, timestamp: Date.now() },
          '',
          `#${prevTab}`
        );
      }
      isNavigatingRef.current = false;
    } else {
      // Directly return to the default overview dashboard
      historyStackRef.current = [defaultTab];
      handleTabChange(defaultTab);
    }
  }, [defaultTab, handleTabChange, isMobileMenuOpen, onTabChange, portalKey, storageKey]);

  // Only show Back button when currently under a feature dashboard (not on the default root overview)
  const canGoBack = activeTab !== defaultTab;

  return {
    activeTab,
    setActiveTab: handleTabChange,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isAppMode,
    canGoBack,
    handleGoBack,
  };
}
