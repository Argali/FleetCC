import React, { useState, useEffect, useCallback } from "react";
import T from "@/theme";
import { roleLabel, moduleLabel, levelColor } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { API } from "@/api";
import { MODULE_META } from "@/constants/moduleMeta";
import Spinner from "@/shared/ui/Spinner";

const BUG_STATUS_META={
  new:         {label:"Nuovo",      color:T.blue,   bg:"#0a1a2a"},
  in_progress: {label:"In corso",   color:T.orange, bg:"#1a0f00"},
  resolved:    {label:"Risolto",    color:T.green,  bg:"#0a1a0a"},
  wontfix:     {label:"Non fix",    color:T.textDim,bg:"#1a1a1a"},
};
const BUG_CAT_LABEL={ui:"UI",funzionalita:"Funzionalità",performance:"Performance",errore:"Errore",altro:"Altro"};

function BugReportsPanel({auth}){
  const [bugs,setBugs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("new");

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await fetch(`${API}/bugs`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await r.json();
      if(d.ok)setBugs(d.data);
    }catch{}
    setLoading(false);
  },[auth.token]);

  useEffect(()=>{load();},[load]);

  const setStatus=async(id,status)=>{
    await fetch(`${API}/bugs/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status})});
    load();
  };

  const counts={};
  Object.keys(BUG_STATUS_META).forEach(s=>{counts[s]=bugs.filter(b=>b.status===s).length;});
  const visible=filter==="all"?bugs:bugs.filter(b=>b.status===filter);

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:T.text}}>Bug Report</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{bugs.length} segnalazioni totali</div>
        </div>
        <button onClick={load} style={{fontSize:11,padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,cursor:"pointer",fontFamily:T.font}}>↻ Aggiorna</button>
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {[["all","Tutti",bugs.length],...Object.entries(BUG_STATUS_META).map(([s,m])=>[s,m.label,counts[s]])].map(([s,lbl,cnt])=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:"5px 14px",borderRadius:20,fontSize:12,fontWeight:filter===s?700:400,cursor:"pointer",fontFamily:T.font,border:`1px solid ${filter===s?T.blue:T.border}`,background:filter===s?T.navActive:"transparent",color:filter===s?T.blue:T.textSub}}>
            {lbl} <span style={{opacity:0.7}}>({cnt})</span>
          </button>
        ))}
      </div>

      {loading?<Spinner/>:visible.length===0
        ?<div style={{color:T.textDim,fontSize:13,textAlign:"center",padding:"24px 0"}}>Nessun bug report in questa categoria</div>
        :(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {visible.map(b=>{
              const sm=BUG_STATUS_META[b.status]||BUG_STATUS_META.new;
              return(
                <div key={b.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <span style={{fontSize:14,fontWeight:700,color:T.text}}>{b.title}</span>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#1a2a3a",color:T.blue,fontWeight:600}}>{BUG_CAT_LABEL[b.category]||b.category}</span>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:sm.bg,color:sm.color,fontWeight:600,border:`1px solid ${sm.color}44`}}>{sm.label}</span>
                      </div>
                      <div style={{fontSize:12,color:T.textSub}}>{b.reportedBy?.name} · {b.reportedBy?.email} · {new Date(b.createdAt).toLocaleString("it-IT")}</div>
                    </div>
                  </div>
                  <div style={{fontSize:13,color:T.text,background:T.bg,borderRadius:6,padding:"10px 12px",marginBottom:b.steps?8:12,whiteSpace:"pre-wrap",lineHeight:1.5}}>{b.description}</div>
                  {b.steps&&<div style={{fontSize:12,color:T.textSub,background:T.bg,borderRadius:6,padding:"8px 12px",marginBottom:12,whiteSpace:"pre-wrap"}}>Passi: {b.steps}</div>}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {Object.entries(BUG_STATUS_META).filter(([s])=>s!==b.status).map(([s,m])=>(
                      <button key={s} onClick={()=>setStatus(b.id,s)}
                        style={{fontSize:11,padding:"4px 12px",background:"transparent",border:`1px solid ${m.color}44`,borderRadius:6,color:m.color,cursor:"pointer",fontFamily:T.font}}>
                        → {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

const PERM_MODULES=["gps","navigation","foto_timbrata","cdr","zone","punti","percorsi","pdf_export","workshop","fuel","suppliers","costs"];

function PermissionsPanel({auth}){
  const {matrix,roles,levels,loadPerms}=usePerms();
  const [local,setLocal]=useState(null);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState(null);

  useEffect(()=>{ if(matrix)setLocal(JSON.parse(JSON.stringify(matrix))); },[matrix]);

  const setLevel=(role,mod,level)=>setLocal(m=>({...m,[role]:{...m[role],[mod]:level}}));

  const save=async()=>{
    setSaving(true);setMsg(null);
    try{
      const r=await fetch(`${API}/permissions`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({matrix:local})});
      const d=await r.json();
      if(d.ok){setMsg({ok:true,text:"Permessi salvati"});loadPerms();}
      else setMsg({ok:false,text:d.error});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setSaving(false);setTimeout(()=>setMsg(null),3000);
  };

  if(!local)return <Spinner/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:T.text}}>Permessi Globali</div>
          <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Gestisci i livelli di accesso per ogni ruolo e modulo</div>
        </div>
        {msg&&<div style={{fontSize:12,padding:"8px 14px",borderRadius:8,background:msg.ok?"#0a1a0a":"#1a0808",border:`1px solid ${msg.ok?T.green:T.red}`,color:msg.ok?T.green:T.red}}>{msg.text}</div>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr>
              <th style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`}}>Modulo</th>
              {roles.map(r=><th key={r} style={{padding:"12px 16px",textAlign:"center",color:T.textSub,fontWeight:600,fontSize:11,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{roleLabel[r]||r}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERM_MODULES.map(mod=>(
              <tr key={mod} style={{borderBottom:`1px solid ${T.border}22`}}>
                <td style={{padding:"14px 16px",color:T.text,fontWeight:600,whiteSpace:"nowrap"}}>{moduleLabel[mod]||mod}</td>
                {roles.map(role=>{
                  const current=local[role]?.[mod]||"none";
                  return(
                    <td key={role} style={{padding:"8px 16px",textAlign:"center"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
                        {levels.map(lvl=>(
                          <button key={lvl} onClick={()=>setLevel(role,mod,lvl)}
                            style={{padding:"4px 9px",fontSize:10,borderRadius:6,cursor:"pointer",fontFamily:T.font,fontWeight:current===lvl?700:400,background:current===lvl?levelColor[lvl]+"33":"transparent",border:`1px solid ${current===lvl?levelColor[lvl]:T.border}`,color:current===lvl?levelColor[lvl]:T.textDim,transition:"all 0.1s"}}>
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginTop:4}}>
        <button onClick={save} disabled={saving} style={{padding:"10px 22px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:saving?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
          {saving?"Salvando...":"💾 Salva e applica"}
        </button>
      </div>
      <div style={{display:"flex",gap:16}}>
        {[["none","Nessun accesso"],["view","Solo lettura"],["edit","Modifica"],["full","Accesso completo"]].map(([l,desc])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.textSub}}>
            <div style={{width:8,height:8,borderRadius:2,background:levelColor[l]}}/>{desc}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard(){
  const {auth}=useAuth();
  const [tab,setTab]=useState("tenants");
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

  if(loading&&tab==="tenants") return <Spinner/>;

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:20}}>
      {/* Tab bar */}
      <div style={{display:"flex",gap:4,borderBottom:`1px solid ${T.border}`,paddingBottom:0}}>
        {[["tenants","🏢 Tenant"],["permissions","🔐 Permessi"],["bugs","🐛 Bug Report"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:"8px 18px",background:"transparent",border:"none",borderBottom:tab===id?`2px solid ${T.blue}`:"2px solid transparent",color:tab===id?T.blue:T.textSub,cursor:"pointer",fontFamily:T.font,fontSize:13,fontWeight:tab===id?700:400,marginBottom:-1}}>
            {lbl}
          </button>
        ))}
      </div>

      {tab==="bugs"&&<BugReportsPanel auth={auth}/>}
      {tab==="permissions"&&<PermissionsPanel auth={auth}/>}

      {tab==="tenants"&&<>
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
      </>}
    </div>
  );
}
