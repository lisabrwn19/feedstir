import { createContext, useContext, useState, type ReactNode } from 'react';

export type TabName = 'Recipes' | 'Menus' | 'Grocery' | 'Profile';

type ActiveTabContextValue = {
  /** Which bottom tab was last focused — used to label the back button on
   * screens pushed on top of the tab navigator (e.g. "< Grocery"), since
   * the Stack itself only sees one shared "(tabs)" route, not per-tab state. */
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
};

const ActiveTabContext = createContext<ActiveTabContextValue | undefined>(undefined);

export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabName>('Recipes');
  return (
    <ActiveTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </ActiveTabContext.Provider>
  );
}

export function useActiveTab() {
  const context = useContext(ActiveTabContext);
  if (!context) {
    throw new Error('useActiveTab must be used within an ActiveTabProvider');
  }
  return context;
}
