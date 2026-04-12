import React, { useState, useCallback, createContext, useContext } from "react";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => { try { const r=sessionStorage.getItem("cauto_auth"); return r?JSON.parse(r):null; } catch{return null;} });
  const login  = useCallback((token,user,tenant)=>{ const s={token,user,tenant}; sessionStorage.setItem("cauto_auth",JSON.stringify(s)); setAuth(s); },[]);
  const logout = useCallback(()=>{ sessionStorage.removeItem("cauto_auth"); setAuth(null); },[]);
  return <AuthContext.Provider value={{auth,login,logout}}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
