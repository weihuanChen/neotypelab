import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SIDEBAR_STORAGE_KEY = "neotypelab.sidebar.collapsed";

type AppShellState = {
  sidebarCollapsed: boolean;
  sidebarStateReady: boolean;
  toggleSidebar: () => void;
};

const AppShellStateContext = createContext<AppShellState | null>(null);

export function AppShellStateProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarStateReady, setSidebarStateReady] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(
      window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
    );
    const frame = window.requestAnimationFrame(() => setSidebarStateReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const value = useMemo<AppShellState>(
    () => ({
      sidebarCollapsed,
      sidebarStateReady,
      toggleSidebar: () => {
        setSidebarCollapsed((collapsed) => {
          const next = !collapsed;
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
          return next;
        });
      },
    }),
    [sidebarCollapsed, sidebarStateReady]
  );

  return (
    <AppShellStateContext.Provider value={value}>
      {children}
    </AppShellStateContext.Provider>
  );
}

export function useAppShellState() {
  const state = useContext(AppShellStateContext);
  if (state === null) {
    throw new Error("useAppShellState must be used within AppShellStateProvider");
  }
  return state;
}
