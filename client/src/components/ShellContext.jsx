import { createContext, useContext, useState } from 'react';

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('all'); // all | positive | negative
  const [view, setView] = useState('comfortable'); // comfortable | compact
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <ShellContext.Provider value={{
      search, setSearch,
      sentiment, setSentiment,
      view, setView,
      filterOpen, setFilterOpen,
    }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  return useContext(ShellContext);
}
