import { useState, useEffect, useCallback, createContext, useContext } from "react";

const API = "http://localhost:3001/api";

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => { try { const r=sessionStorage.getItem("cauto_auth"); return r?JSON.parse(r):null; } catch{return null;} });
  const login  = useCallback((token,user,tenant)=>{ const s={token,user,tenant}; sessionStorage.setItem("cauto_auth",JSON.stringify(s)); setAuth(s); },[]);
  const logout = useCallback(()=>{ sessionStorage.removeItem("cauto_auth"); setAuth(null); },[]);
  return <AuthContext.Provider value={{auth,login,logout}}>{children}</AuthContext.Provider>;
}
function useAuth() { return useContext(AuthContext); }

// ─── PERMISSIONS CONTEXT ──────────────────────────────────────────────────────
const PermContext = createContext({});
function PermProvider({ children }) {
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
function usePerms() { return useContext(PermContext); }

// ─── API HOOK ─────────────────────────────────────────────────────────────────
function useApi(path, { pollMs=0, skip=false }={}) {
  const { auth, logout } = useAuth();
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  const fetch_ = useCallback(()=>{
    if(skip){ setLoading(false); return; }
    fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${auth?.token}`}})
      .then(r=>{ if(r.status===401){logout();throw new Error("Sessione scaduta");} if(!r.ok)throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(r=>{ setData(r.data); setError(null); }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[path,auth?.token,logout,skip]);
  useEffect(()=>{ fetch_(); if(pollMs>0){const id=setInterval(fetch_,pollMs);return()=>clearInterval(id);} },[fetch_,pollMs]);
  return {data,loading,error,refetch:fetch_};
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const statusLabel={active:"Attivo",idle:"Fermo",workshop:"Officina",waiting_parts:"Attesa Ricambi",in_progress:"In Corso",done:"Completato"};
const statusColor={active:"#4ade80",idle:"#facc15",workshop:"#f87171",waiting_parts:"#fb923c",in_progress:"#60a5fa",done:"#6ee7b7"};
const roleLabel={"fleet_manager":"Fleet Manager","responsabile_officina":"Resp. Officina","coordinatore_officina":"Coord. Officina","coordinatore_operativo":"Coord. Operativo"};
const moduleLabel={gps:"GPS Live",workshop:"Officina",fuel:"Carburante",suppliers:"Fornitori",costs:"Costi",admin:"Admin"};
const levelColor={none:"#3a3a3a",view:"#60a5fa",edit:"#facc15",full:"#4ade80"};

const Icon=({d,size=18})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
function Spinner(){return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:120,color:"#2a5a2a",fontSize:12}}>Caricamento...</div>;}
function ApiError({error,onRetry}){return<div style={{background:"#1a0a0a",border:"1px solid #4a1a1a",borderRadius:8,padding:"16px 20px",color:"#f87171",fontSize:13}}><div style={{fontWeight:600,marginBottom:4}}>Errore API</div><div style={{fontSize:11,color:"#7a3a3a",marginBottom:10}}>{error}</div>{onRetry&&<button onClick={onRetry} style={{background:"#2a0a0a",border:"1px solid #4a1a1a",borderRadius:4,color:"#f87171",padding:"4px 10px",cursor:"pointer",fontSize:11}}>Riprova</button>}</div>;}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen(){
  const {login}=useAuth();
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(null),[loading,setLoading]=useState(false);
  const handleLogin=async()=>{
    if(!email||!password){setError("Inserisci email e password");return;}
    setLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password})});
      const data=await res.json();
      if(!data.ok){setError(data.error);return;}
      login(data.token,data.user,data.tenant);
    }catch{setError("Impossibile raggiungere il server");}finally{setLoading(false);}
  };
  return(
    <div style={{height:"100vh",background:"#060f06",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New', monospace"}}>
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",opacity:0.04,pointerEvents:"none"}}><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4ade80" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
      <div style={{width:360}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:28,fontWeight:700,color:"#4ade80",letterSpacing:6,textTransform:"uppercase"}}>CAUTO</div>
          <div style={{fontSize:11,color:"#2a5a2a",letterSpacing:2,marginTop:4}}>COMMAND CENTRE</div>
        </div>
        <div style={{background:"#080f08",border:"1px solid #1a3a1a",borderRadius:12,padding:32}}>
          <div style={{fontSize:13,color:"#4a7a4a",marginBottom:24,textAlign:"center"}}>Accesso operatori</div>
          {[["Email","email",email,setEmail],["Password","password",password,setPassword]].map(([label,type,val,set],i)=>(
            <div key={label} style={{marginBottom:i===0?16:24}}>
              <label style={{fontSize:11,color:"#4a7a4a",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>{label}</label>
              <input type={type} value={val} onChange={e=>set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder={i===0?"nome@cauto.it":"••••••••"}
                style={{width:"100%",background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:6,padding:"10px 12px",color:"#d1fae5",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
          ))}
          {error&&<div style={{background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:6,padding:"8px 12px",color:"#f87171",fontSize:12,marginBottom:16}}>{error}</div>}
          <button onClick={handleLogin} disabled={loading} style={{width:"100%",background:loading?"#1a3a1a":"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",padding:"12px",fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",letterSpacing:1}}>
            {loading?"Accesso in corso...":"ACCEDI"}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:10,color:"#1a3a1a"}}>Cauto S.p.A. · Ferrara · v0.1.0</div>
      </div>
    </div>
  );
}

// ─── GPS ─────────────────────────────────────────────────────────────────────
function GPSModule(){
  const {data:vehicles,loading,error,refetch}=useApi("/gps/vehicles",{pollMs:10000});
  const [sel,setSel]=useState(null);
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  return(
    <div style={{display:"flex",gap:16,height:"100%"}}>
      <div style={{flex:1,background:"#0d1f0d",border:"1px solid #1a3a1a",borderRadius:8,position:"relative",overflow:"hidden",minHeight:420}}>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.07}}><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4ade80" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg>
        {vehicles.map((v,i)=>{const x=15+(i*17)%75,y=20+(i*23)%60;return(
          <div key={v.id} onClick={()=>setSel(v.id===sel?null:v.id)} style={{position:"absolute",left:`${x}%`,top:`${y}%`,cursor:"pointer",transform:"translate(-50%,-100%)",zIndex:2}}>
            <div style={{width:12,height:12,borderRadius:"50% 50% 50% 0",background:statusColor[v.status],border:"2px solid #000",transform:"rotate(-45deg)",boxShadow:`0 0 8px ${statusColor[v.status]}`}}/>
            {sel===v.id&&<div style={{position:"absolute",left:16,top:-8,background:"#0f2e0f",border:`1px solid ${statusColor[v.status]}`,borderRadius:6,padding:"4px 8px",whiteSpace:"nowrap",fontSize:11,color:"#d1fae5"}}>{v.name} · {v.plate}{v.speed_kmh>0?` · ${v.speed_kmh}km/h`:""}</div>}
          </div>);})}
        <div style={{position:"absolute",bottom:12,left:12,fontSize:11,color:"#2d6a2d",fontFamily:"monospace"}}>Aggiornamento ogni 10s</div>
        <div style={{position:"absolute",top:12,right:12,fontSize:11,color:"#f87171"}}>Visirun offline — mock</div>
      </div>
      <div style={{width:240,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
        {vehicles.map(v=>(
          <div key={v.id} onClick={()=>setSel(v.id===sel?null:v.id)} style={{background:sel===v.id?"#0f2e0f":"#0a1a0a",border:`1px solid ${sel===v.id?statusColor[v.status]:"#1a3a1a"}`,borderRadius:8,padding:"10px 12px",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{v.name}</span><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:600}}>{statusLabel[v.status]}</span></div>
            <div style={{fontSize:11,color:"#4a7a4a"}}>{v.plate} · {v.sector||"—"}</div>
            {v.fuel_pct!=null&&<><div style={{marginTop:6,height:4,background:"#1a3a1a",borderRadius:2}}><div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?"#f87171":"#4ade80",borderRadius:2}}/></div><div style={{fontSize:10,color:"#3a6a3a",marginTop:2}}>Carburante: {v.fuel_pct}%</div></>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WORKSHOP ────────────────────────────────────────────────────────────────
function WorkshopModule(){
  const {can}=usePerms();
  const {data:orders,loading,error,refetch}=useApi("/workshop/orders");
  const canEdit=can("workshop","edit");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {!canEdit&&<div style={{background:"#0a1200",border:"1px solid #1a3a1a",borderRadius:6,padding:"8px 14px",fontSize:11,color:"#4a7a4a"}}>👁 Solo lettura — il tuo ruolo non permette modifiche</div>}
      <div style={{display:"flex",gap:12,flex:1}}>
        {["waiting_parts","in_progress","done"].map(col=>(
          <div key={col} style={{flex:1,background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{width:8,height:8,borderRadius:"50%",background:statusColor[col]}}/><span style={{fontSize:12,fontWeight:700,color:"#6aaa6a",textTransform:"uppercase",letterSpacing:1}}>{{"waiting_parts":"In Attesa","in_progress":"In Corso","done":"Completato"}[col]}</span><span style={{fontSize:11,color:"#3a6a3a",marginLeft:"auto"}}>{orders.filter(o=>o.status===col).length}</span></div>
            {orders.filter(o=>o.status===col).map(o=>(
              <div key={o.id} style={{background:"#0d1f0d",border:"1px solid #1a3a1a",borderRadius:6,padding:10,marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:600,color:"#d1fae5",marginBottom:4}}>{o.vehicle}</div>
                <div style={{fontSize:11,color:"#4a7a4a",marginBottom:6}}>{o.plate} · {o.type}</div>
                <div style={{fontSize:11,color:"#d1fae5aa"}}>{o.notes}</div>
                {o.mechanic&&<div style={{fontSize:10,color:"#3a6a3a",marginTop:4}}>👤 {o.mechanic}{o.eta?` · ETA ${o.eta}`:""}</div>}
                {canEdit&&col!=="done"&&(
                  <button onClick={async()=>{
                    const next=col==="waiting_parts"?"in_progress":"done";
                    await fetch(`${API}/workshop/orders/${o.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${useAuth().auth?.token}`,"Content-Type":"application/json"},body:JSON.stringify({status:next})});
                    refetch();
                  }} style={{marginTop:8,fontSize:10,padding:"3px 8px",background:"#1a3a1a",border:"1px solid #2a6a2a",borderRadius:4,color:"#4ade80",cursor:"pointer"}}>
                    → {col==="waiting_parts"?"Inizia":"Completa"}
                  </button>
                )}
              </div>
            ))}
            {orders.filter(o=>o.status===col).length===0&&<div style={{fontSize:12,color:"#2a4a2a",textAlign:"center",paddingTop:24}}>Nessun ordine</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FUEL ────────────────────────────────────────────────────────────────────
function FuelModule(){
  const {data:entries,loading:lE,error:eE,refetch:rE}=useApi("/fuel/entries");
  const {data:summary,loading:lS,error:eS,refetch:rS}=useApi("/fuel/summary");
  if(lE||lS)return<Spinner/>;if(eE)return<ApiError error={eE} onRetry={rE}/>;if(eS)return<ApiError error={eS} onRetry={rS}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:12}}>
        {[["Litri Totali",`${summary.total_liters} L`],["Costo Totale",`€${summary.total_cost_eur.toFixed(2)}`],["KM Totali",`${summary.total_km} km`],["L/100 km",`${summary.avg_consumption_l100}`]].map(([l,v])=>(
          <div key={l} style={{flex:1,background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{fontSize:11,color:"#4a7a4a",marginBottom:4}}>{l}</div><div style={{fontSize:20,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>{v}</div></div>
        ))}
      </div>
      <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#0d1f0d"}}>{["Data","Veicolo","Litri","Costo","KM","Stazione"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",color:"#4a7a4a",fontWeight:600,fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>{entries.map((e,i)=><tr key={i} style={{borderTop:"1px solid #1a3a1a"}}><td style={{padding:"10px 14px",color:"#6aaa6a",fontFamily:"monospace",fontSize:12}}>{e.date}</td><td style={{padding:"10px 14px",color:"#d1fae5"}}>{e.vehicle}</td><td style={{padding:"10px 14px",color:"#4ade80",fontFamily:"monospace"}}>{e.liters} L</td><td style={{padding:"10px 14px",color:"#4ade80",fontFamily:"monospace"}}>€{e.cost_eur}</td><td style={{padding:"10px 14px",color:"#d1fae5aa",fontFamily:"monospace"}}>{e.km}</td><td style={{padding:"10px 14px",color:"#4a7a4a"}}>{e.station}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────
function SuppliersModule(){
  const {data:suppliers,loading,error,refetch}=useApi("/suppliers");
  const [search,setSearch]=useState("");
  const catColors={Carburante:"#60a5fa",Ricambi:"#f87171",Pneumatici:"#facc15",Lubrificanti:"#4ade80"};
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  const filtered=suppliers.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.category.toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca fornitore o categoria..." style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:6,padding:"10px 14px",color:"#d1fae5",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:10}}>
        {filtered.map(s=><div key={s.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:14,fontWeight:600,color:"#d1fae5"}}>{s.name}</div><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:(catColors[s.category]||"#4ade80")+"22",color:catColors[s.category]||"#4ade80",fontWeight:600}}>{s.category}</span></div><div style={{fontSize:12,color:"#4a7a4a",marginBottom:4}}>📞 {s.contact}</div><div style={{fontSize:12,color:"#4a7a4a"}}>✉ {s.email}</div>{s.notes&&<div style={{fontSize:11,color:"#3a6a3a",marginTop:6,fontStyle:"italic"}}>{s.notes}</div>}</div>)}
      </div>
    </div>
  );
}

// ─── COSTS ───────────────────────────────────────────────────────────────────
function CostsModule(){
  const {data:costs,loading,error,refetch}=useApi("/costs/monthly");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  const max=Math.max(...costs.map(c=>c.total));
  return(
    <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:20}}>
      <div style={{fontSize:12,color:"#4a7a4a",marginBottom:16,textTransform:"uppercase",letterSpacing:0.5}}>Costi Mensili 2026</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:16,height:180}}>
        {costs.map(c=>{const s=v=>`${(v/max)*160}px`;return(
          <div key={c.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:11,color:"#4ade80",fontFamily:"monospace",marginBottom:4}}>€{c.total}</div>
            <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:160,gap:2}}>
              {[[c.fuel,"#4ade80"],[c.maintenance,"#60a5fa"],[c.other,"#facc15"]].map(([v,col],i)=><div key={i} style={{width:"100%",height:s(v),background:col+"88",borderRadius:3}}/>)}
            </div>
            <div style={{fontSize:12,color:"#4a7a4a",marginTop:4}}>{c.month.slice(5)}/{c.month.slice(2,4)}</div>
          </div>);})}
      </div>
      <div style={{display:"flex",gap:16,marginTop:16}}>{[["#4ade80","Carburante"],["#60a5fa","Manutenzione"],["#facc15","Altro"]].map(([col,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#6aaa6a"}}><div style={{width:10,height:10,borderRadius:2,background:col}}/>{l}</div>)}</div>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel(){
  const {auth}=useAuth();
  const {matrix,roles,levels,loadPerms}=usePerms();
  const [tab,setTab]=useState("permissions");
  const [localMatrix,setLocalMatrix]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);

  // Users state
  const [users,setUsers]=useState([]);
  const [usersLoading,setUsersLoading]=useState(false);
  const [showNewUser,setShowNewUser]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",password:"",role:"coordinatore_operativo"});
  const [userMsg,setUserMsg]=useState(null);

  const modules=["gps","workshop","fuel","suppliers","costs"];

  useEffect(()=>{ if(matrix)setLocalMatrix(JSON.parse(JSON.stringify(matrix))); },[matrix]);

  const loadUsers=useCallback(async()=>{
    setUsersLoading(true);
    const res=await fetch(`${API}/admin/users`,{headers:{Authorization:`Bearer ${auth.token}`}});
    const d=await res.json();
    if(d.ok)setUsers(d.data);
    setUsersLoading(false);
  },[auth.token]);

  useEffect(()=>{ if(tab==="users")loadUsers(); },[tab,loadUsers]);

  const saveMatrix=async()=>{
    setSaving(true);setSaveMsg(null);
    try{
      const res=await fetch(`${API}/permissions`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({matrix:localMatrix})});
      const d=await res.json();
      if(d.ok){setSaveMsg({ok:true,text:"Permessi salvati e attivi immediatamente"});loadPerms();}
      else setSaveMsg({ok:false,text:d.error});
    }catch{setSaveMsg({ok:false,text:"Errore di rete"});}
    setSaving(false);
    setTimeout(()=>setSaveMsg(null),3000);
  };

  const setLevel=(role,mod,level)=>{
    setLocalMatrix(m=>({...m,[role]:{...m[role],[mod]:level}}));
  };

  const createUser=async()=>{
    if(!newUser.name||!newUser.email||!newUser.password){setUserMsg({ok:false,text:"Tutti i campi sono obbligatori"});return;}
    const res=await fetch(`${API}/admin/users`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
    const d=await res.json();
    if(d.ok){setUserMsg({ok:true,text:"Utente creato"});setShowNewUser(false);setNewUser({name:"",email:"",password:"",role:"coordinatore_operativo"});loadUsers();}
    else setUserMsg({ok:false,text:d.error});
    setTimeout(()=>setUserMsg(null),3000);
  };

  const toggleUser=async(id,active)=>{
    await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({active})});
    loadUsers();
  };

  const changeRole=async(id,role)=>{
    await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({role})});
    loadUsers();
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Tabs */}
      <div style={{display:"flex",gap:8}}>
        {[["permissions","🔒 Permessi"],["users","👤 Utenti"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 16px",background:tab===id?"#0d2e0d":"#0a1a0a",border:`1px solid ${tab===id?"#2a6a2a":"#1a3a1a"}`,borderRadius:6,color:tab===id?"#4ade80":"#4a7a4a",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PERMISSIONS TAB ── */}
      {tab==="permissions"&&localMatrix&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr>
                  <th style={{padding:"10px 14px",textAlign:"left",color:"#4a7a4a",fontWeight:600,fontSize:11,borderBottom:"1px solid #1a3a1a"}}>Modulo</th>
                  {roles.map(r=><th key={r} style={{padding:"10px 14px",textAlign:"center",color:"#4a7a4a",fontWeight:600,fontSize:11,borderBottom:"1px solid #1a3a1a",whiteSpace:"nowrap"}}>{roleLabel[r]||r}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map(mod=>(
                  <tr key={mod} style={{borderBottom:"1px solid #0f1f0f"}}>
                    <td style={{padding:"12px 14px",color:"#d1fae5",fontWeight:600}}>{moduleLabel[mod]||mod}</td>
                    {roles.map(role=>{
                      const current=localMatrix[role]?.[mod]||"none";
                      return(
                        <td key={role} style={{padding:"8px 14px",textAlign:"center"}}>
                          <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
                            {levels.map(lvl=>(
                              <button key={lvl} onClick={()=>setLevel(role,mod,lvl)}
                                style={{padding:"3px 8px",fontSize:10,borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontWeight:current===lvl?700:400,background:current===lvl?levelColor[lvl]+"33":"transparent",border:`1px solid ${current===lvl?levelColor[lvl]:"#1a3a1a"}`,color:current===lvl?levelColor[lvl]:"#3a6a3a",transition:"all 0.1s"}}>
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

          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}>
            <button onClick={saveMatrix} disabled={saving} style={{padding:"10px 20px",background:"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",cursor:saving?"not-allowed":"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}}>
              {saving?"Salvando...":"💾 Salva e applica"}
            </button>
            {saveMsg&&<div style={{fontSize:12,color:saveMsg.ok?"#4ade80":"#f87171"}}>{saveMsg.text}</div>}
          </div>

          {/* Legend */}
          <div style={{display:"flex",gap:16,marginTop:12}}>
            {[["none","Nessun accesso"],["view","Solo lettura"],["edit","Modifica"],["full","Accesso completo"]].map(([l,desc])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#4a7a4a"}}>
                <div style={{width:8,height:8,borderRadius:2,background:levelColor[l]}}/>{desc}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab==="users"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:"#4a7a4a"}}>{users.length} utenti</div>
            <button onClick={()=>setShowNewUser(v=>!v)} style={{padding:"8px 14px",background:"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
              {showNewUser?"✕ Annulla":"+ Nuovo utente"}
            </button>
          </div>

          {userMsg&&<div style={{fontSize:12,padding:"8px 12px",borderRadius:6,background:userMsg.ok?"#0a1a0a":"#1a0a0a",border:`1px solid ${userMsg.ok?"#2a6a2a":"#4a1a1a"}`,color:userMsg.ok?"#4ade80":"#f87171"}}>{userMsg.text}</div>}

          {/* New user form */}
          {showNewUser&&(
            <div style={{background:"#0a1a0a",border:"1px solid #2a6a2a",borderRadius:8,padding:16,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:13,color:"#4ade80",fontWeight:600,marginBottom:4}}>Nuovo utente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["Nome","text",newUser.name,v=>setNewUser(u=>({...u,name:v}))],["Email","email",newUser.email,v=>setNewUser(u=>({...u,email:v}))],["Password","password",newUser.password,v=>setNewUser(u=>({...u,password:v}))]].map(([label,type,val,set])=>(
                  <div key={label}>
                    <label style={{fontSize:11,color:"#4a7a4a",display:"block",marginBottom:4}}>{label}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,padding:"8px 10px",color:"#d1fae5",fontSize:12,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:"#4a7a4a",display:"block",marginBottom:4}}>Ruolo</label>
                  <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={{width:"100%",background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,padding:"8px 10px",color:"#d1fae5",fontSize:12,outline:"none",fontFamily:"inherit"}}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createUser} style={{alignSelf:"flex-start",padding:"8px 16px",background:"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600}}>
                Crea utente
              </button>
            </div>
          )}

          {/* User list */}
          {usersLoading?<Spinner/>:
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.map(u=>(
                <div key={u.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,opacity:u.active?1:0.5}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{u.name}</div>
                    <div style={{fontSize:11,color:"#4a7a4a",marginTop:2}}>{u.email}</div>
                  </div>
                  <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} style={{background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,padding:"5px 8px",color:"#d1fae5",fontSize:11,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                  <div style={{width:8,height:8,borderRadius:"50%",background:u.active?"#4ade80":"#3a3a3a",flexShrink:0}}/>
                  <button onClick={()=>toggleUser(u.id,!u.active)} style={{fontSize:11,padding:"4px 10px",background:"transparent",border:"1px solid #1a3a1a",borderRadius:4,color:u.active?"#f87171":"#4ade80",cursor:"pointer",fontFamily:"inherit"}}>
                    {u.active?"Disattiva":"Riattiva"}
                  </button>
                </div>
              ))}
            </div>
          }
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const NAV_DEF=[
  {id:"gps",      label:"GPS Live",   icon:"M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13 M15 7v13",        module:"gps"},
  {id:"workshop", label:"Officina",   icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z", module:"workshop"},
  {id:"fuel",     label:"Carburante", icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6",                           module:"fuel"},
  {id:"suppliers",label:"Fornitori",  icon:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", module:"suppliers"},
  {id:"costs",    label:"Costi",      icon:"M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",                        module:"costs"},
  {id:"admin",    label:"Admin",      icon:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z", module:"admin"},
];

function Dashboard(){
  const {auth,logout}=useAuth();
  const {can}=usePerms();
  const [active,setActive]=useState("gps");
  const {data:vehicles}=useApi("/gps/vehicles",{pollMs:10000,skip:!can("gps")});

  // Filter nav by permissions
  const nav=NAV_DEF.filter(n=>can(n.module));

  // If current active tab is no longer accessible, switch to first available
  useEffect(()=>{ if(nav.length&&!nav.find(n=>n.id===active))setActive(nav[0].id); },[nav,active]);

  const counts=vehicles?{active:vehicles.filter(v=>v.status==="active").length,idle:vehicles.filter(v=>v.status==="idle").length,workshop:vehicles.filter(v=>v.status==="workshop").length}:{active:"—",idle:"—",workshop:"—"};

  const renderModule=()=>({gps:<GPSModule/>,workshop:<WorkshopModule/>,fuel:<FuelModule/>,suppliers:<SuppliersModule/>,costs:<CostsModule/>,admin:<AdminPanel/>}[active]||null);

  const handleLogout=async()=>{try{await fetch(`${API}/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`}});}catch{}logout();};

  return(
    <div style={{display:"flex",height:"100vh",background:"#060f06",fontFamily:"'Courier New', monospace",color:"#d1fae5"}}>
      <div style={{width:220,background:"#080f08",borderRight:"1px solid #1a3a1a",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid #1a3a1a"}}><div style={{fontSize:16,fontWeight:700,color:"#4ade80",letterSpacing:2,textTransform:"uppercase"}}>CAUTO</div><div style={{fontSize:10,color:"#2a5a2a",letterSpacing:1,marginTop:2}}>COMMAND CENTRE</div></div>
        <div style={{padding:"10px 20px",borderBottom:"1px solid #1a3a1a"}}><div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>{auth.user.name}</div><div style={{fontSize:10,color:"#2a5a2a",marginTop:2}}>{roleLabel[auth.user.role]||auth.user.role}</div></div>
        <nav style={{flex:1,padding:"12px 12px"}}>
          {nav.map(n=><button key={n.id} onClick={()=>setActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:6,border:"none",cursor:"pointer",marginBottom:2,background:active===n.id?"#0d2e0d":"transparent",color:active===n.id?"#4ade80":"#3a6a3a",transition:"all 0.15s",textAlign:"left"}}><Icon d={n.icon} size={15}/><span style={{fontSize:13,fontWeight:active===n.id?600:400}}>{n.label}</span></button>)}
        </nav>
        {can("gps")&&<div style={{padding:"12px 20px",borderTop:"1px solid #1a3a1a"}}><div style={{fontSize:10,color:"#2a5a2a",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Flotta</div>{[["active","Attivi"],["idle","Fermi"],["workshop","Officina"]].map(([k,l])=><div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#3a6a3a"}}>{l}</span><span style={{fontSize:11,color:statusColor[k],fontFamily:"monospace"}}>{counts[k]}</span></div>)}</div>}
        <button onClick={handleLogout} style={{margin:"0 12px 12px",padding:"8px 12px",background:"transparent",border:"1px solid #1a3a1a",borderRadius:6,color:"#2a5a2a",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:12}}><Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" size={14}/>Esci</button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"14px 24px",borderBottom:"1px solid #1a3a1a",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#080f08"}}>
          <div><div style={{fontSize:16,fontWeight:700,color:"#d1fae5"}}>{nav.find(n=>n.id===active)?.label}</div><div style={{fontSize:11,color:"#3a6a3a"}}>{auth.tenant.name} · {auth.tenant.city}</div></div>
          <div style={{fontSize:11,color:"#3a6a3a",fontFamily:"monospace"}}>{new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>
        <div style={{flex:1,padding:24,overflowY:"auto"}}>{renderModule()}</div>
      </div>
    </div>
  );
}

function AppInner(){const{auth}=useAuth();return auth?<Dashboard/>:<LoginScreen/>;}

export default function App(){
  return(
    <AuthProvider>
      <PermProvider>
        <AppInner/>
      </PermProvider>
    </AuthProvider>
  );
}
