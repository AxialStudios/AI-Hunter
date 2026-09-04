import { createContext, useContext, useState } from 'react';

const ProContext = createContext({ isPro: false, setIsPro: () => {} });

export function ProProvider({ children }) {
  const [isPro, setIsPro] = useState(false); // Toggle true to test Pro UI
  return (
    <ProContext.Provider value={{ isPro, setIsPro }}>
      {children}
    </ProContext.Provider>
  );
}

export function useProStatus() {
  return useContext(ProContext);
}
