"use client";

import { createContext, useContext } from "react";

// Server components read the visitor's country directly via isUKSpelling()
// in lib/locale.ts. Client components can't call next/headers, so the root
// layout resolves it once server-side and hands it down through this
// context instead of every client component re-deriving it.
const SpellingContext = createContext(false);

export function SpellingProvider({
  useUK,
  children,
}: {
  useUK: boolean;
  children: React.ReactNode;
}) {
  return <SpellingContext.Provider value={useUK}>{children}</SpellingContext.Provider>;
}

export function useSpelling() {
  const useUK = useContext(SpellingContext);
  return {
    useUK,
    pick: (us: string, uk: string) => (useUK ? uk : us),
  };
}
