import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { API } from "../api";

export function useApi(path, { pollMs=0, skip=false }={}) {
  const { auth, logout } = useAuth();
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  const abortRef=useRef(null);
  const fetch_ = useCallback(()=>{
    if(skip){ setLoading(false); return; }
    if(abortRef.current) abortRef.current.abort();
    abortRef.current=new AbortController();
    const signal=abortRef.current.signal;
    fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${auth?.token}`},signal})
      .then(r=>{ if(r.status===401){logout();throw new Error("Sessione scaduta");} if(!r.ok)throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(r=>{ if(!signal.aborted){setData(r.data);setError(null);} })
      .catch(e=>{ if(!signal.aborted&&e.name!=="AbortError")setError(e.message); })
      .finally(()=>{ if(!signal.aborted)setLoading(false); });
  },[path,auth?.token,logout,skip]);
  useEffect(()=>{
    fetch_();
    if(pollMs>0){const id=setInterval(fetch_,pollMs);return()=>{clearInterval(id);abortRef.current?.abort();};}
    return()=>abortRef.current?.abort();
  },[fetch_,pollMs]);
  return {data,loading,error,refetch:fetch_};
}
