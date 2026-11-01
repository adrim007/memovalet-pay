"use client";

import { createContext, useContext } from "react";
import type { AccountType } from "@/lib/types";

// Lets any client component ask "is this a Personal or Business account?"
// without threading the value through every prop. Defaults to "business"
// so previews and screens outside the app shell keep today's look.
const AccountTypeContext = createContext<AccountType>("business");

export function AccountTypeProvider({
  value,
  children,
}: {
  value: AccountType;
  children: React.ReactNode;
}) {
  return <AccountTypeContext.Provider value={value}>{children}</AccountTypeContext.Provider>;
}

export function useAccountType(): AccountType {
  return useContext(AccountTypeContext);
}

export function useIsPersonal(): boolean {
  return useAccountType() === "personal";
}
