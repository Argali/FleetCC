import React, { useState, useEffect, useCallback } from "react";
import T from "../theme";
import { useAuth } from "../context/AuthContext";
import { API } from "../api";
import { MODULE_META } from "../constants/moduleMeta";
import Spinner from "./ui/Spinner";

export default function SuperAdminDashboard(){
  const {auth}=useAuth();
  const [tenants,setTenants]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState({});
  const [msg,setMsg]=useState(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await fetch(`${API}/superadmin/tenants`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await r.json();
      if(d.ok)setTenants(d.data);
    }catch{}
    setLoading(false);
  },[auth.token]);

  useEffect(()=>{ load(); },[load]);

  const toggleModule=async(tenantId,mod,current)=>{
    const key=`${tenantId}-${mod}`;
    setSaving(s=>({...s,[key]:true}));
    try{
      const r=await fetch(`${API}/superadmin/tenants/${tenantId}/modules`,{
        method:"PATCH",
        headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},
        body:JSON.stringify({modules:{[mod]:!current}}),
      });
      const d=await r.json();
      if(d.ok){
        setTenants(ts=>ts.map(t=>t.id===tenantId?{...t,modules:{...t.modules,[mod]:!current}}:t));
        setMsg({ok:true,text:`${mod} ${!current?"abilitato":"disabilitato"} per ${tenantId}`});
      } else setMsg({ok:false,text:d.error});
    }catch{ setMsg({ok:false,text:"Errore di rete"}); }
    setSaving(s=>({...s,[key]:false}));
    setTimeout(()=>setMsg(null),3000);
  };

  const toggleTenantActive=async(tenantId,current)=>{
    try{
      const r=await fetch(`${API}/superadmin/tenants/${tenantId}/active`,{
        method:"PATCH",
        headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},
        body:JSON.stringify({active:!current}),
      });
      const d=await r.json();
      if(d.ok) setTenants(ts=>ts.map(t=>t.id===tenantId?{...t,active:!current}:t));
      else setMsg({ok:false,text:d.error});
    }catch{ setMsg({ok:false,text:"Errore di rete"}); }
  };

  const now=Date.now();
  const sevenDays=7*24*60*60*1000;

  if(loading) return <Spinner/>;

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:T.text}}>Gestione Tenant</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{tenants.length} aziende registrate · accesso solo a questa sezione</div>
        </div>
        {msg&&<div style={{fontSize:12,padding:"8px 14px",borderRadius:8,background:msg.ok?"#0a1a0a":"#1a0808",border:`1px solid ${msg.ok?T.green:T.red}`,color:msg.ok?T.green:T.red}}>{msg.text}</div>}
      </div>

      {tenants.map(t=>{
        const inactive=now-new Date(t.last_active).getTime()>sevenDays;
        const daysAgo=Math.floor((now-new Date(t.last_active).getTime())/(24*60*60*1000));
        const enabledCount=Object.values(t.modules).filter(Boolean).length;
        return(
          <div key={t.id} style={{background:T.card,border:`1px solid ${t.active?T.cardBorder:"#3a1a1a"}`,borderRadius:12,padding:"18px 20px",opacity:t.active?1:0.6}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{t.name}</div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:T.navActive,color:T.textSub,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>{t.plan}</span>
                  {inactive&&t.active&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#1a0a0a",color:T.orange,border:`1px solid ${T.orange}44`,fontWeight:600}}>⚠ Inattivo {daysAgo}gg</span>}
                </div>
                <div style={{fontSize:11,color:T.textDim,marginTop:3}}>{t.id} · {enabledCount} moduli attivi · ultimo accesso {daysAgo===0?"oggi":`${daysAgo}gg fa`}</div>
              </div>
              <button onClick={()=>toggleTenantActive(t.id,t.active)}
                style={{fontSize:11,padding:"5px 12px",background:"transparent",border:`1px solid ${t.active?T.red:T.green}44`,borderRadius:6,color:t.active?T.red:T.green,cursor:"pointer",fontFamily:T.font,fontWeight:600}}>
                {t.active?"Sospendi":"Riattiva"}
              </button>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {Object.entries(MODULE_META).map(([mod,meta])=>{
                const enabled=t.modules[mod]??false;
                const key=`${t.id}-${mod}`;
                const isSaving=saving[key];
                return(
                  <button key={mod} onClick={()=>!isSaving&&t.active&&toggleModule(t.id,mod,enabled)}
                    disabled={isSaving||!t.active}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,cursor:t.active?"pointer":"not-allowed",fontFamily:T.font,fontSize:11,fontWeight:600,transition:"all 0.15s",
                      background:enabled?"#0a1a0a":"transparent",
                      border:`1px solid ${enabled?T.green:T.border}`,
                      color:enabled?T.green:T.textDim,
                      opacity:isSaving?0.5:1,
                    }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d={meta.icon}/>
                    </svg>
                    {meta.label}
                    {isSaving&&<span style={{width:8,height:8,border:`1px solid currentColor`,borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 0.6s linear infinite"}}/>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
