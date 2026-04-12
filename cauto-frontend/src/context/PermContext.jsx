import React, { useState, useCallback, createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { API } from "../api";

export const PermContext = createContext({});

export function PermProvider({ children }) {
  const { auth } = useAuth();
  const [perms, setPerms] = useState({});
  const [matrix, setMatrix] = useState(null);
  const [roles, setRoles]   = useState([]);
  const [levels, setLevels] = useState([]);
  const loadPerms = useCallback(() => {
    if (!auth?.token) return;
    fetch(`${API}/permissions`, { headers:{ Authorization:`Bearer ${auth.token}` } })
      .then(r=>r.json())
      .then(r=>{ if(r.ok){ setPerms(r.my_access); setMatrix(r.matrix); setRoles(r.roles); setLevels(r.levels); } })
      .catch(()=>{});
  }, [auth?.token]);
  useEffect(() => { loadPerms(); }, [loadPerms]);
  const can = useCallback((module, level="view") => {
    const order = ["none","view","edit","full"];
    return (order.indexOf(perms[module]||"none")) >= (order.indexOf(level));
  }, [perms]);
  return <PermContext.Provider value={{perms,matrix,roles,levels,can,loadPerms,setMatrix}}>{children}</PermContext.Provider>;
}

export function usePerms() { return useContext(PermContext); }
