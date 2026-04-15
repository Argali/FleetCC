import React, { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo } from "react";
import { msalInstance, loginRequest } from "./msalConfig.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Stage, Layer, Rect as KonvaRect, Ellipse as KonvaEllipse, Line as KonvaLine, Text as KonvaText, Transformer as KonvaTransformer } from "react-konva";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const BASE_URL = API.replace(/\/api$/, "");

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  sidebar:   "#0a1628",   // darkest layer
  bg:        "#1a2332",   // content area background
  card:      "#243447",   // card background
  cardBorder:"#2e4a6a",   // card border
  border:    "#263d5a",   // general border
  text:      "#e2eaf5",
  textSub:   "#7a9bbf",
  textDim:   "#3d5a7a",
  green:     "#4ade80",
  blue:      "#60a5fa",
  orange:    "#fb923c",
  red:       "#f87171",
  yellow:    "#facc15",
  teal:      "#34d399",
  navActive: "#0f2540",
  tabLine:   "#3a7bd5",
  font:      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  mono:      "'JetBrains Mono', Consolas, monospace",
};

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

// ─── MOBILE BREAKPOINT ────────────────────────────────────────────────────────
function useIsMobile(){
  const [mob,setMob]=useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setMob(window.innerWidth<768);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);
  return mob;
}

// ─── GEOLOCATION HOOK ─────────────────────────────────────────────────────────
function useGeolocation(){
  const [pos,setPos]=useState(null);
  const [geoError,setGeoError]=useState(null);
  const watchRef=useRef(null);
  const start=useCallback(()=>{
    if(!navigator.geolocation){setGeoError("Geolocalizzazione non supportata dal browser");return;}
    setGeoError(null);
    watchRef.current=navigator.geolocation.watchPosition(
      p=>setPos([p.coords.latitude,p.coords.longitude]),
      e=>setGeoError(e.code===1?"Permesso negato":e.message),
      {enableHighAccuracy:true,maximumAge:10000,timeout:15000}
    );
  },[]);
  const stop=useCallback(()=>{
    if(watchRef.current!=null){navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;}
    setPos(null);setGeoError(null);
  },[]);
  useEffect(()=>()=>{if(watchRef.current!=null)navigator.geolocation.clearWatch(watchRef.current);},[]);
  return{pos,geoError,start,stop};
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const statusLabel={active:"Attivo",idle:"Fermo",workshop:"Officina",waiting_parts:"Attesa Ricambi",in_progress:"In Corso",done:"Completato"};
const statusColor={active:"#4ade80",idle:"#facc15",workshop:"#f87171",waiting_parts:"#fb923c",in_progress:"#60a5fa",done:"#6ee7b7"};
const roleLabel={"superadmin":"Super Admin","company_admin":"Admin Azienda","fleet_manager":"Fleet Manager","responsabile_officina":"Resp. Officina","coordinatore_officina":"Coord. Officina","coordinatore_operativo":"Coord. Operativo"};
const moduleLabel={gps:"GPS Live",workshop:"Officina",fuel:"Carburante",suppliers:"Fornitori",costs:"Costi",admin:"Admin"};
const levelColor={none:"#3a5a7a",view:"#60a5fa",edit:"#facc15",full:"#4ade80"};

const Icon=({d,size=18})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
function Spinner(){return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:120,color:T.textSub,fontSize:13,fontFamily:T.font}}>Caricamento...</div>;}
function ApiError({error,onRetry}){return<div style={{background:"#1a0a0a",border:"1px solid #4a1a1a",borderRadius:10,padding:"16px 20px",color:T.red,fontSize:13,fontFamily:T.font}}><div style={{fontWeight:600,marginBottom:4}}>Errore API</div><div style={{fontSize:11,color:"#7a3a3a",marginBottom:10}}>{error}</div>{onRetry&&<button onClick={onRetry} style={{background:"#2a0a0a",border:"1px solid #4a1a1a",borderRadius:6,color:T.red,padding:"5px 12px",cursor:"pointer",fontSize:12}}>Riprova</button>}</div>;}

// ─── FLEETCC LOGO ─────────────────────────────────────────────────────────────
function FleetLogo({size=36}){
  const uid=React.useId().replace(/:/g,"");
  const id=`grad-${uid}`;
  return(
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
      <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill={`url(#${id})`}/>
      <circle cx="58" cy="34" r="12" fill="white"/>
      <circle cx="58" cy="34" r="5" fill={`url(#${id})`}/>
      <line x1="58" y1="46" x2="58" y2="56" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="36" cy="52" r="6" fill="white"/>
      <path d="M30 64 Q36 58 42 64" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M18,82 Q50,64 82,74" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ─── TAB BAR ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,marginBottom:20,flexShrink:0}}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{
            padding:"10px 20px 11px",
            background:"transparent",
            border:"none",
            borderBottom: active===t.id ? `2px solid ${T.tabLine}` : "2px solid transparent",
            color: active===t.id ? T.blue : T.textSub,
            cursor:"pointer",
            fontSize:14,
            fontFamily:T.font,
            fontWeight: active===t.id ? 600 : 400,
            marginBottom:-1,
            transition:"color 0.15s, border-color 0.15s",
            display:"flex",
            alignItems:"center",
            gap:7,
            position:"relative",
          }}>
          {t.icon && <span style={{opacity:active===t.id?1:0.6}}><Icon d={t.icon} size={14}/></span>}
          {t.label}
          {t.badge > 0 && (
            <span style={{background:T.orange,color:"#000",fontSize:9,fontWeight:700,borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({label,value,sub,color=T.green,alert=false,icon}){
  return(
    <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"18px 20px",display:"flex",flexDirection:"column",gap:6,fontFamily:T.font,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{label}</div>
        {icon&&<div style={{color:T.textDim}}><Icon d={icon} size={16}/></div>}
      </div>
      <div style={{fontSize:28,fontWeight:700,color:alert?T.orange:color,fontFamily:T.mono,lineHeight:1}}>{value??<span style={{color:T.textDim}}>—</span>}</div>
      {sub&&<div style={{fontSize:11,color:alert?"#7a4a2a":T.textSub}}>{sub}</div>}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen(){
  const {login}=useAuth();
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const [adminEmail,setAdminEmail]=useState("");
  const [adminPwd,setAdminPwd]=useState("");
  const [adminLoading,setAdminLoading]=useState(false);

  const handleMicrosoftLogin=async()=>{
    setLoading(true);setError(null);
    try{ await msalInstance.loginRedirect(loginRequest); }
    catch(e){ setError(e?.message||e?.errorCode||"Accesso non riuscito"); setLoading(false); }
  };

  const handleAdminLogin=async(e)=>{
    e.preventDefault();
    setAdminLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:adminEmail,password:adminPwd})});
      const d=await res.json();
      if(d.ok){ login(d.token,d.user,d.tenant); }
      else setError(d.error||"Credenziali non valide");
    }catch{ setError("Errore di rete"); }
    setAdminLoading(false);
  };

  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};

  return(
    <div style={{height:"100vh",background:T.sidebar,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",opacity:0.03,pointerEvents:"none"}}><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#60a5fa" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
      <div style={{width:400}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:14}}>
            <FleetLogo size={52}/>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:26,fontWeight:800,color:T.text,letterSpacing:-0.5}}>Fleet<span style={{color:T.green}}>CC</span></div>
              <div style={{fontSize:11,color:T.textSub,letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>Fleet Command Center</div>
            </div>
          </div>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:16,padding:32,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:6}}>Accesso operatori</div>
          <div style={{fontSize:13,color:T.textSub,marginBottom:28}}>Usa il tuo account Microsoft aziendale</div>
          {error&&<div style={{background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:8,padding:"10px 14px",color:T.red,fontSize:13,marginBottom:16}}>{error}</div>}
          <button onClick={handleMicrosoftLogin} disabled={loading}
            style={{width:"100%",background:loading?"#1a2a3a":T.navActive,border:`1px solid ${T.blue}44`,borderRadius:10,color:loading?T.textDim:T.blue,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:T.font,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            {!loading&&<svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>}
            {loading?"Accesso in corso...":"Accedi con Microsoft"}
          </button>

          {/* Admin password login — collapsed by default */}
          <div style={{marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <button onClick={()=>{setShowAdmin(v=>!v);setError(null);}}
              style={{background:"transparent",border:"none",color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:T.font,padding:0}}>
              {showAdmin?"▲ Nascondi":"▼ Accesso amministratore"}
            </button>
            {showAdmin&&(
              <form onSubmit={handleAdminLogin} style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>
                <input type="email" placeholder="Email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} required style={inp}/>
                <input type="password" placeholder="Password" value={adminPwd} onChange={e=>setAdminPwd(e.target.value)} required style={inp}/>
                <button type="submit" disabled={adminLoading}
                  style={{padding:"10px",background:T.navActive,border:`1px solid ${T.textDim}44`,borderRadius:8,color:T.textSub,cursor:adminLoading?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                  {adminLoading?"Accesso...":"Accedi"}
                </button>
              </form>
            )}
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:T.textDim}}>FleetCC · Ferrara · v0.2.0</div>
      </div>
    </div>
  );
}

// ─── VEHICLE DETAIL ───────────────────────────────────────────────────────────
function VehicleDetail({vehicle,onBack}){
  const {can}=usePerms();
  const {data:orders}=useApi("/workshop/orders",{skip:!can("workshop")});
  const {data:fuelEntries}=useApi("/fuel/entries",{skip:!can("fuel")});
  const vOrders=orders?orders.filter(o=>o.plate===vehicle.plate):[];
  const vFuel=fuelEntries?fuelEntries.filter(e=>e.vehicle===vehicle.name):[];
  const totalFuelCost=vFuel.reduce((s,e)=>s+parseFloat(e.cost_eur||0),0);
  const totalLiters=vFuel.reduce((s,e)=>s+parseFloat(e.liters||0),0);
  const sc=statusColor[vehicle.status]||T.green;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20,fontFamily:T.font}}>
      <button onClick={onBack} style={{alignSelf:"flex-start",display:"flex",alignItems:"center",gap:6,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSub,padding:"7px 14px",cursor:"pointer",fontSize:13}}>
        <Icon d="M19 12H5 M12 19l-7-7 7-7" size={14}/> Torna indietro
      </button>
      <div style={{background:T.card,border:`1px solid ${sc}33`,borderRadius:14,padding:"22px 26px",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:T.text}}>{vehicle.name}</div>
            <div style={{fontSize:13,color:T.textSub,marginTop:4,fontFamily:T.mono}}>{vehicle.plate}</div>
          </div>
          <span style={{fontSize:12,padding:"5px 14px",borderRadius:20,background:sc+"22",color:sc,fontWeight:700,border:`1px solid ${sc}44`}}>{statusLabel[vehicle.status]}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginTop:20}}>
          {[["Settore",vehicle.sector||"—"],["Velocità",vehicle.speed_kmh>0?`${vehicle.speed_kmh} km/h`:"Fermo"],["Coordinate",vehicle.lat&&vehicle.lng?`${vehicle.lat.toFixed(3)}, ${vehicle.lng.toFixed(3)}`:"—"]].map(([label,value])=>(
            <div key={label} style={{background:T.bg,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
              <div style={{fontSize:13,color:T.text,fontFamily:T.mono}}>{value}</div>
            </div>
          ))}
          {vehicle.fuel_pct!=null&&(
            <div style={{background:T.bg,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,color:T.textDim,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Carburante</div>
              <div style={{height:6,background:T.border,borderRadius:3,marginBottom:4}}>
                <div style={{height:"100%",width:`${vehicle.fuel_pct}%`,background:vehicle.fuel_pct<20?T.red:T.green,borderRadius:3}}/>
              </div>
              <div style={{fontSize:13,color:vehicle.fuel_pct<20?T.red:T.green,fontFamily:T.mono}}>{vehicle.fuel_pct}%</div>
            </div>
          )}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {can("workshop")&&(
          <div>
            <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:600}}>Storico officina</div>
            {vOrders.length===0
              ?<div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"20px",fontSize:13,color:T.textDim,textAlign:"center"}}>Nessun ordine trovato</div>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {vOrders.map(o=>(
                  <div key={o.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:600,color:T.text}}>{o.type}</span>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:statusColor[o.status]+"22",color:statusColor[o.status],fontWeight:600}}>{statusLabel[o.status]}</span>
                    </div>
                    <div style={{fontSize:12,color:T.textSub,marginBottom:4}}>{o.notes}</div>
                    <div style={{fontSize:11,color:T.textDim}}>{o.mechanic?`👤 ${o.mechanic}`:""}{o.eta?` · ETA ${o.eta}`:""}</div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
        {can("fuel")&&(
          <div>
            <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:600}}>Storico carburante</div>
            {vFuel.length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1,background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>Litri totali</div>
                  <div style={{fontSize:18,fontWeight:700,color:T.green,fontFamily:T.mono}}>{totalLiters} L</div>
                </div>
                <div style={{flex:1,background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>Costo totale</div>
                  <div style={{fontSize:18,fontWeight:700,color:T.green,fontFamily:T.mono}}>€{totalFuelCost.toFixed(2)}</div>
                </div>
              </div>
            )}
            {vFuel.length===0
              ?<div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"20px",fontSize:13,color:T.textDim,textAlign:"center"}}>Nessun rifornimento trovato</div>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {vFuel.map((e,i)=>(
                  <div key={i} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:12,color:T.text,fontFamily:T.mono}}>{e.date}</div>
                      <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{e.station}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.green,fontFamily:T.mono}}>{e.liters} L</div>
                      <div style={{fontSize:11,color:T.textDim}}>€{e.cost_eur}</div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GPS MAP ──────────────────────────────────────────────────────────────────
function FleetMap({vehicles,routes,visibleRoutes,editMode,editWaypoints,editColor,zones,punti,onMapClick,onWaypointMove,onWaypointDelete,searchMarkerRef,snappedSegments,snapMode,onPathClick,annotations=[],cdr=[],onCdrClick}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const routeLayerRef=useRef(null);
  const vehicleLayerRef=useRef(null);
  const editLayerRef=useRef(null);
  const zoneLayerRef=useRef(null);
  const puntiLayerRef=useRef(null);
  const annotLayerRef=useRef(null);
  const cdrLayerRef=useRef(null);
  const cbClick=useRef(onMapClick);
  const cbMove=useRef(onWaypointMove);
  const cbDel=useRef(onWaypointDelete);
  const cbPathClick=useRef(onPathClick);
  const cbCdrClick=useRef(onCdrClick);
  useEffect(()=>{cbClick.current=onMapClick;},[onMapClick]);
  useEffect(()=>{cbMove.current=onWaypointMove;},[onWaypointMove]);
  useEffect(()=>{cbDel.current=onWaypointDelete;},[onWaypointDelete]);
  useEffect(()=>{cbPathClick.current=onPathClick;},[onPathClick]);
  useEffect(()=>{cbCdrClick.current=onCdrClick;},[onCdrClick]);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);
    routeLayerRef.current=L.layerGroup().addTo(map);
    zoneLayerRef.current=L.layerGroup().addTo(map);
    puntiLayerRef.current=L.layerGroup().addTo(map);
    annotLayerRef.current=L.layerGroup().addTo(map);
    cdrLayerRef.current=L.layerGroup().addTo(map);
    vehicleLayerRef.current=L.layerGroup().addTo(map);
    editLayerRef.current=L.layerGroup().addTo(map);
    map.on("click",(e)=>{ if(cbClick.current)cbClick.current([e.latlng.lat,e.latlng.lng]); });
    mapRef.current=map;
    if(searchMarkerRef)searchMarkerRef.current=map;
    return()=>{map.remove();mapRef.current=null;if(searchMarkerRef)searchMarkerRef.current=null;};
  },[]);// eslint-disable-line

  useEffect(()=>{
    if(!mapRef.current)return;
    mapRef.current.getContainer().style.cursor=editMode?"crosshair":"";
  },[editMode]);

  useEffect(()=>{
    if(!mapRef.current||!routes||!routeLayerRef.current)return;
    routeLayerRef.current.clearLayers();
    routes.forEach(r=>{
      const opacity=editMode?0.2:(visibleRoutes[r.id]?(r.opacity??0.85):0);
      if(opacity===0)return;
      const line=L.polyline(r.waypoints,{color:r.color,weight:4,opacity,dashArray:r.status==="pianificato"?"10 7":null});
      if(!editMode)line.bindTooltip(`<b>${r.name}</b>${r.comune?`<br>${r.comune}`:""}`,{sticky:true});
      routeLayerRef.current.addLayer(line);
    });
  },[routes,visibleRoutes,editMode]);

  // zones overlay
  useEffect(()=>{
    if(!mapRef.current||!zoneLayerRef.current)return;
    zoneLayerRef.current.clearLayers();
    (zones||[]).forEach(z=>{
      const style={fillColor:z.fillColor,fillOpacity:z.fillOpacity,color:z.borderColor,weight:2,opacity:1};
      let shape;
      if(z.type==="circle")shape=L.circle(z.center,{radius:z.radius,...style});
      else if(z.type==="square")shape=L.rectangle(z.bounds,style);
      else shape=L.polygon(z.vertices,style);
      if(z.name)shape.bindTooltip(z.name,{sticky:false});
      zoneLayerRef.current.addLayer(shape);
    });
  },[zones]);

  // punti overlay
  useEffect(()=>{
    if(!mapRef.current||!puntiLayerRef.current)return;
    puntiLayerRef.current.clearLayers();
    (punti||[]).forEach(p=>{
      const m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:"",html:`<div style="width:16px;height:16px;background:${p.color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.5)"></div>`,iconSize:[16,16],iconAnchor:[8,8]})});
      const sub=[p.comune,p.materiale,p.sector].filter(Boolean).join(" · ");
      if(p.nome||sub)m.bindTooltip(`<b>${p.nome||""}</b>${sub?`<br><span style="font-size:10px;color:#888">${sub}</span>`:""}`,{sticky:false});
      puntiLayerRef.current.addLayer(m);
    });
  },[punti]);

  // CDR markers (geolocated centres)
  useEffect(()=>{
    if(!mapRef.current||!cdrLayerRef.current)return;
    cdrLayerRef.current.clearLayers();
    (cdr||[]).filter(c=>c.lat&&c.lng).forEach(c=>{
      const icon=L.divIcon({
        className:"",
        html:`<div title="${c.name}" style="width:30px;height:30px;background:${c.color};border:2.5px solid #fff;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;">♻</div>`,
        iconSize:[30,30],iconAnchor:[15,15],
      });
      const m=L.marker([c.lat,c.lng],{icon,zIndexOffset:500});
      const sub=[c.comune,c.materiale,c.sector].filter(Boolean).join(" · ");
      m.bindTooltip(`<b>${c.name}</b>${c.address?`<br><span style="font-size:10px;color:#aaa">${c.address}</span>`:""}${sub?`<br><span style="font-size:10px;color:#888">${sub}</span>`:""}`,{sticky:false});
      m.on("click",()=>{ if(cbCdrClick.current)cbCdrClick.current(c); });
      cdrLayerRef.current.addLayer(m);
    });
  },[cdr]);

  useEffect(()=>{
    if(!mapRef.current||!annotLayerRef.current)return;
    annotLayerRef.current.clearLayers();
    (annotations||[]).forEach(a=>{
      if(!a.lat||!a.lng)return;
      const m=L.marker([a.lat,a.lng],{
        icon:L.divIcon({
          className:"",
          html:`<div style="background:${a.color||"#facc15"};color:#000;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:1.5px solid rgba(0,0,0,0.3);max-width:160px;overflow:hidden;text-overflow:ellipsis;">${a.text||"📌"}</div>`,
          iconAnchor:[0,10],
        }),
        interactive:false,
        zIndexOffset:2000,
      });
      annotLayerRef.current.addLayer(m);
    });
  },[annotations]);

  useEffect(()=>{
    if(!mapRef.current||!vehicles||!vehicleLayerRef.current)return;
    vehicleLayerRef.current.clearLayers();
    if(editMode)return;
    vehicles.forEach(v=>{
      const color=statusColor[v.status]||T.green;
      const m=L.circleMarker([v.lat,v.lng],{radius:9,fillColor:color,fillOpacity:1,color:"#000",weight:1.5});
      m.bindPopup(`<div style="font-family:system-ui;font-size:12px;min-width:160px"><div style="font-weight:700;margin-bottom:4px">${v.name}</div><div style="color:#666;margin-bottom:6px">${v.plate} · ${v.sector}</div>${v.speed_kmh>0?`<div style="margin-bottom:4px">${v.speed_kmh} km/h</div>`:""}<div style="height:4px;background:#eee;border-radius:2px;margin-bottom:2px"><div style="height:100%;width:${v.fuel_pct}%;background:${v.fuel_pct<20?"#f87171":"#4ade80"};border-radius:2px"></div></div><div style="font-size:10px;color:#888">Carburante: ${v.fuel_pct}%</div></div>`);
      vehicleLayerRef.current.addLayer(m);
    });
  },[vehicles,editMode]);

  useEffect(()=>{
    if(!mapRef.current||!editLayerRef.current)return;
    editLayerRef.current.clearLayers();
    if(!editMode||!editWaypoints||editWaypoints.length===0)return;
    const color=editColor||T.green;
    // Draw path: snapped if available, else raw control points
    const pathPts=snappedSegments?snappedSegments.flat():editWaypoints;
    const line=L.polyline(pathPts,{color,weight:4,opacity:0.9,interactive:!!snappedSegments});
    if(snappedSegments&&cbPathClick.current){
      line.on("click",(e)=>{
        L.DomEvent.stopPropagation(e);
        const click=[e.latlng.lat,e.latlng.lng];
        // Find closest control-point segment to determine insert position
        let bestSeg=0,bestDist=Infinity;
        for(let i=0;i<editWaypoints.length-1;i++){
          const a=editWaypoints[i],b=editWaypoints[i+1];
          const dx=b[0]-a[0],dy=b[1]-a[1];
          const d2=dx*dx+dy*dy;
          let t=d2>0?((click[0]-a[0])*dx+(click[1]-a[1])*dy)/d2:0;
          t=Math.max(0,Math.min(1,t));
          const dist=Math.hypot(click[0]-(a[0]+t*dx),click[1]-(a[1]+t*dy));
          if(dist<bestDist){bestDist=dist;bestSeg=i;}
        }
        cbPathClick.current(bestSeg+1,click);
      });
    }
    editLayerRef.current.addLayer(line);
    editWaypoints.forEach((wp,idx)=>{
      const m=L.marker([wp[0],wp[1]],{
        icon:L.divIcon({className:"",html:`<div style="width:18px;height:18px;background:${color};border:2px solid #000;border-radius:50%;cursor:grab;box-shadow:0 0 6px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#000">${idx+1}</div>`,iconSize:[18,18],iconAnchor:[9,9]}),
        draggable:true,zIndexOffset:1000,
      });
      m.on("dragend",(e)=>{ const{lat,lng}=e.target.getLatLng(); if(cbMove.current)cbMove.current(idx,[lat,lng]); });
      if(snapMode){
        m.on("contextmenu",(e)=>{ L.DomEvent.stopPropagation(e); if(cbDel.current)cbDel.current(idx); });
      } else {
        m.on("click",(e)=>{ L.DomEvent.stopPropagation(e); if(cbDel.current)cbDel.current(idx); });
      }
      editLayerRef.current.addLayer(m);
    });
  },[editMode,editWaypoints,editColor,snappedSegments,snapMode]);

  return <div ref={containerRef} style={{height:"100%",width:"100%"}}/>;
}

// ─── ZONE MAP (multi-click draw) ──────────────────────────────────────────────
const ZONE_CLICKS={circle:2,square:2,triangle:3,parallelogram:4};

function ZoneMap({zones,drawMode,zoneConfig,onShapeComplete,onZoneDelete}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const zoneLayerRef=useRef(null);
  const previewLayerRef=useRef(null);
  const cbComplete=useRef(onShapeComplete);
  const cbDel=useRef(onZoneDelete);
  const cfgRef=useRef(zoneConfig);
  const drawRef=useRef(drawMode);
  const clickVerts=useRef([]);
  const cursorPos=useRef(null);
  useEffect(()=>{cbComplete.current=onShapeComplete;},[onShapeComplete]);
  useEffect(()=>{cbDel.current=onZoneDelete;},[onZoneDelete]);
  useEffect(()=>{cfgRef.current=zoneConfig;clickVerts.current=[];if(previewLayerRef.current)previewLayerRef.current.clearLayers();},[zoneConfig]);
  useEffect(()=>{
    drawRef.current=drawMode;
    if(!drawMode){clickVerts.current=[];cursorPos.current=null;if(previewLayerRef.current)previewLayerRef.current.clearLayers();}
  },[drawMode]);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
    zoneLayerRef.current=L.layerGroup().addTo(map);
    previewLayerRef.current=L.layerGroup().addTo(map);

    const refreshPreview=()=>{
      const prev=previewLayerRef.current;if(!prev)return;
      prev.clearLayers();
      const cfg=cfgRef.current;
      const verts=clickVerts.current;
      const cur=cursorPos.current;
      const needed=ZONE_CLICKS[cfg.type]||2;
      if(!verts.length&&!cur)return;
      const style={fillColor:cfg.fillColor,fillOpacity:cfg.fillOpacity*0.5,color:cfg.borderColor,weight:2,opacity:0.7,dashArray:"6 4"};
      verts.forEach((v,i)=>L.circleMarker(v,{radius:5,fillColor:cfg.borderColor,fillOpacity:1,color:"#fff",weight:1.5}).bindTooltip(`${i+1}`).addTo(prev));
      const all=[...verts,...(cur&&verts.length<needed?[cur]:[])];
      if(cfg.type==="circle"&&all.length>=2){
        const r=L.latLng(all[0]).distanceTo(L.latLng(all[1]));
        L.circle(all[0],{radius:r,...style}).addTo(prev);
        L.polyline([all[0],all[1]],{color:cfg.borderColor,weight:1,dashArray:"4 4",opacity:0.5}).addTo(prev);
      }else if(cfg.type==="square"&&all.length>=2){
        L.rectangle([all[0],all[1]],style).addTo(prev);
      }else if((cfg.type==="triangle"||cfg.type==="parallelogram")&&all.length>=2){
        L.polyline(all,{color:cfg.borderColor,weight:2,dashArray:"6 4"}).addTo(prev);
        if(all.length>=3)L.polygon(all,{...style,dashArray:null}).addTo(prev);
      }
    };

    map.on("mousemove",(e)=>{
      if(!drawRef.current)return;
      cursorPos.current=[e.latlng.lat,e.latlng.lng];
      refreshPreview();
    });

    map.on("click",(e)=>{
      if(!drawRef.current)return;
      const cfg=cfgRef.current;
      const latlng=[e.latlng.lat,e.latlng.lng];
      clickVerts.current=[...clickVerts.current,latlng];
      const needed=ZONE_CLICKS[cfg.type]||2;
      if(clickVerts.current.length>=needed){
        const verts=[...clickVerts.current];
        clickVerts.current=[];cursorPos.current=null;
        previewLayerRef.current.clearLayers();
        const id=crypto.randomUUID();
        const base={id,name:cfg.name,comune:cfg.comune||"",materiale:cfg.materiale||"",sector:cfg.sector||"",fillColor:cfg.fillColor,fillOpacity:cfg.fillOpacity,borderColor:cfg.borderColor};
        if(cfg.type==="circle"){ const radius=L.latLng(verts[0]).distanceTo(L.latLng(verts[1])); cbComplete.current({...base,type:"circle",center:verts[0],radius}); }
        else if(cfg.type==="square"){ cbComplete.current({...base,type:"square",bounds:verts}); }
        else{ cbComplete.current({...base,type:cfg.type,vertices:verts}); }
      }else{ refreshPreview(); }
    });

    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    if(!mapRef.current)return;
    mapRef.current.getContainer().style.cursor=drawMode?"crosshair":"";
  },[drawMode]);

  useEffect(()=>{
    if(!mapRef.current||!zoneLayerRef.current)return;
    zoneLayerRef.current.clearLayers();
    zones.forEach(z=>{
      const style={fillColor:z.fillColor,fillOpacity:z.fillOpacity,color:z.borderColor,weight:2,opacity:1};
      let shape;
      if(z.type==="circle")shape=L.circle(z.center,{radius:z.radius,...style});
      else if(z.type==="square")shape=L.rectangle(z.bounds,style);
      else shape=L.polygon(z.vertices,style);
      if(z.name)shape.bindTooltip(z.name,{sticky:false});
      shape.on("click",(e)=>{L.DomEvent.stopPropagation(e);if(window.confirm(`Eliminare "${z.name||z.type}"?`))cbDel.current(z.id);});
      zoneLayerRef.current.addLayer(shape);
    });
  },[zones]);

  return <div ref={containerRef} style={{height:"100%",width:"100%"}}/>;
}

// ─── PUNTI MAP ────────────────────────────────────────────────────────────────
function PuntiMap({punti,drawMode,onMapClick,onPuntoDelete}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const layerRef=useRef(null);
  const cbClick=useRef(onMapClick);
  const cbDel=useRef(onPuntoDelete);
  useEffect(()=>{cbClick.current=onMapClick;},[onMapClick]);
  useEffect(()=>{cbDel.current=onPuntoDelete;},[onPuntoDelete]);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
    layerRef.current=L.layerGroup().addTo(map);
    map.on("click",(e)=>{ if(cbClick.current)cbClick.current([e.latlng.lat,e.latlng.lng]); });
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    if(!mapRef.current)return;
    mapRef.current.getContainer().style.cursor=drawMode?"crosshair":"";
  },[drawMode]);

  useEffect(()=>{
    if(!mapRef.current||!layerRef.current)return;
    layerRef.current.clearLayers();
    punti.forEach(p=>{
      const m=L.marker([p.lat,p.lng],{
        icon:L.divIcon({className:"",html:`<div style="width:20px;height:20px;background:${p.color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;cursor:pointer;"></div>`,iconSize:[20,20],iconAnchor:[10,10]}),
      });
      const lbl=p.nome?`<b style="font-size:13px">${p.nome}</b><br>`:"";
      const sub=[p.comune,p.materiale,p.sector].filter(Boolean).join(" · ");
      const btnId=`del-punto-${p.id}`;
      m.bindPopup(`<div style="font-family:system-ui;min-width:130px">${lbl}${sub?`<div style="font-size:11px;color:#888;margin-bottom:4px">${sub}</div>`:""}<span style="font-size:11px;color:#666">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span><br><button id="${btnId}" style="margin-top:6px;font-size:11px;padding:3px 8px;background:#fee;border:1px solid #fcc;border-radius:4px;cursor:pointer;color:#c00">Elimina</button></div>`);
      m.on("popupopen",()=>{
        document.getElementById(btnId)?.addEventListener("click",()=>{ if(cbDel.current)cbDel.current(p.id); });
      });
      if(p.nome)m.bindTooltip(p.nome);
      layerRef.current.addLayer(m);
    });
  },[punti]);

  return <div ref={containerRef} style={{height:"100%",width:"100%"}}/>;
}

// ─── GPS MODULE ───────────────────────────────────────────────────────────────
const EMPTY_META={name:"",color:"#4ade80",opacity:0.85,comune:"",materiale:"",sector:""};

const EMPTY_ZONE_CFG={type:"circle",name:"",comune:"",materiale:"",sector:"",fillColor:"#60a5fa",fillOpacity:0.3,borderColor:"#3a7bd5"};
const EMPTY_PUNTO_CFG={nome:"",comune:"",materiale:"",sector:"",color:"#f87171"};
const EMPTY_GRUPPO_CFG={name:"",color:"#60a5fa",routeIds:[],zoneIds:[],puntiIds:[]};
const EMPTY_CDR_META={name:"",comune:"",materiale:"",sector:"",address:"",lat:null,lng:null,color:"#60a5fa",opacity:0.5};

function GPSModule({onSelectVehicle,mode="live"}){
  const {auth}=useAuth();
  const {can}=usePerms();
  const isMobile=useIsMobile();
  const {pos:myPos,geoError,start:startGeo,stop:stopGeo}=useGeolocation();
  const [sharing,setSharing]=useState(false);
  const [driverLocs,setDriverLocs]=useState([]);
  const centeredRef=useRef(false); // auto-center only once
  const [showCamera,setShowCamera]=useState(false);
  const [showMobileTabPicker,setShowMobileTabPicker]=useState(false);
  // ── Navigation state ────────────────────────────────────────────────────────
  const [showNavPanel,setShowNavPanel]=useState(false);
  const [navStatus,setNavStatus]=useState("idle"); // idle|loading|active|arrived
  const [navRoute,setNavRoute]=useState(null);     // {shape,maneuvers,distance,duration}
  const [navStep,setNavStep]=useState(0);
  const [navCosting,setNavCosting]=useState("auto");
  const [navDestQuery,setNavDestQuery]=useState("");
  const [navDestResults,setNavDestResults]=useState([]);
  const [navDestLoading,setNavDestLoading]=useState(false);
  const [navDest,setNavDest]=useState(null);       // {lat,lng,name}
  const [navError,setNavError]=useState(null);
  const navPolyRef=useRef(null);
  const navAbortRef=useRef(null);
  const {data:vehicles,loading,error,refetch}=useApi("/gps/vehicles",{pollMs:10000});
  const [routes,setRoutes]=useState(null);
  const [visibleRoutes,setVisibleRoutes]=useState({});
  const [tab,setTab]=useState(mode==="editors"?"editor":"live");
  const [editingId,setEditingId]=useState(null);
  const [editWaypoints,setEditWaypoints]=useState([]);
  const [meta,setMeta]=useState(EMPTY_META);
  const [saving,setSaving]=useState(false);
  const [snappedSegments,setSnappedSegments]=useState(null); // null=free hand | array=snapped
  const [snapLoading,setSnapLoading]=useState(false);
  const [snapCosting,setSnapCosting]=useState("auto");
  const [snapPopup,setSnapPopup]=useState(null);

  const snapMode=snappedSegments!==null;
  const snappedPath=snappedSegments?snappedSegments.flat():null;

  // ── PDF export state ──────────────────────────────────────────────────────
  const [pdfPanel,setPdfPanel]=useState(false);
  const [pdfMode,setPdfMode]=useState("tutto");
  const [pdfTitle,setPdfTitle]=useState("");
  const [pdfExporting,setPdfExporting]=useState(false);
  const mapContainerRef=useRef(null);

  useEffect(()=>{
    const labels={percorso:"Percorsi",zona:"Zone",punti:"Punti",tutto:"Vista Completa"};
    setPdfTitle(labels[pdfMode]||"FleetCC");
  },[pdfMode]);

  const handleExportPdf=async()=>{
    if(!mapContainerRef.current)return;
    setPdfExporting(true);
    try{
      const [html2canvas,{jsPDF}]=await Promise.all([
        import("html2canvas").then(m=>m.default),
        import("jspdf"),
      ]);
      const canvas=await html2canvas(mapContainerRef.current,{useCORS:true,scale:2,logging:false});
      const imgData=canvas.toDataURL("image/jpeg",0.92);
      const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
      const pw=pdf.internal.pageSize.getWidth();
      const ph=pdf.internal.pageSize.getHeight();
      pdf.setFillColor(10,22,40);
      pdf.rect(0,0,pw,14,"F");
      pdf.setTextColor(226,234,245);
      pdf.setFontSize(10);
      pdf.setFont("helvetica","bold");
      pdf.text(pdfTitle||"FleetCC Export",8,9);
      pdf.setFont("helvetica","normal");
      pdf.setFontSize(8);
      pdf.text(new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"}),pw-8,9,{align:"right"});
      const imgH=ph-16;
      const imgW=pw;
      pdf.addImage(imgData,"JPEG",0,14,imgW,imgH);
      pdf.save(`${(pdfTitle||"fleetcc").replace(/\s+/g,"-").toLowerCase()}.pdf`);
      setPdfPanel(false);
    }catch(e){
      alert("Errore export PDF: "+e.message);
    }finally{
      setPdfExporting(false);
    }
  };

  // ── annotation state ──────────────────────────────────────────────────────
  const [editAnnotations,setEditAnnotations]=useState([]);
  const [annotMode,setAnnotMode]=useState(false);
  const [annotEditId,setAnnotEditId]=useState(null);

  // ── zone editor state ─────────────────────────────────────────────────────
  const [zones,setZones]=useState(()=>{ try{return JSON.parse(localStorage.getItem("fleetcc_zones")||"[]");}catch{return[];} });
  const [visibleZones,setVisibleZones]=useState({});
  const [zoneCfg,setZoneCfg]=useState(EMPTY_ZONE_CFG);
  const [drawingZone,setDrawingZone]=useState(false);
  const [editingZone,setEditingZone]=useState(false);
  const [legendOpen,setLegendOpen]=useState({live:true,zone:true,punti:true});
  // GPS Live panel state
  const [livePanelOpen,setLivePanelOpen]=useState(!isMobile);
  const [filterComune,setFilterComune]=useState("");
  const [filterSettore,setFilterSettore]=useState("");
  const [searchAddr,setSearchAddr]=useState("");
  const [searchResults,setSearchResults]=useState([]);
  const [searchLoading,setSearchLoading]=useState(false);
  const [selectedSearchResult,setSelectedSearchResult]=useState(null); // {lat,lng,address}
  const [segTerritorio,setSegTerritorio]=useState({tipo:"",note:""});
  const [segTerritorioMsg,setSegTerritorioMsg]=useState(null);
  const [segTerritorioSending,setSegTerritorioSending]=useState(false);
  const liveMapRef=useRef(null);
  const searchPinRef=useRef(null);
  const nominatimAbortRef=useRef(null);
  useEffect(()=>{ localStorage.setItem("fleetcc_zones",JSON.stringify(zones)); },[zones]);
  useEffect(()=>{ setVisibleZones(prev=>{ const n={...prev}; zones.forEach(z=>{ if(!(z.id in n))n[z.id]=true; }); return n; }); },[zones]);
  const toggleZone=(id)=>setVisibleZones(prev=>({...prev,[id]:!prev[id]}));

  const handleShapeComplete=useCallback((shape)=>{ setZones(prev=>[...prev,shape]); setDrawingZone(false); setEditingZone(false); },[]);
  const deleteZone=useCallback((id)=>setZones(prev=>prev.filter(z=>z.id!==id)),[]);
  const cancelZoneDraw=()=>{ setDrawingZone(false); setEditingZone(false); setZoneCfg(EMPTY_ZONE_CFG); };

  // ── punti editor state ───────────────────────────────────────────────────
  const [punti,setPunti]=useState(()=>{ try{return JSON.parse(localStorage.getItem("fleetcc_punti")||"[]");}catch{return[];} });
  const [visiblePunti,setVisiblePunti]=useState({});
  const [puntoCfg,setPuntoCfg]=useState(EMPTY_PUNTO_CFG);
  const [drawingPunti,setDrawingPunti]=useState(false);
  const [editingPunto,setEditingPunto]=useState(false);
  useEffect(()=>{ localStorage.setItem("fleetcc_punti",JSON.stringify(punti)); },[punti]);
  useEffect(()=>{ setVisiblePunti(prev=>{ const n={...prev}; punti.forEach(p=>{ if(!(p.id in n))n[p.id]=true; }); return n; }); },[punti]);
  const togglePunto=(id)=>setVisiblePunti(prev=>({...prev,[id]:!prev[id]}));

  const handlePuntiMapClick=useCallback((latlng)=>{
    if(!drawingPunti)return;
    setPuntoCfg(cfg=>{
      const id=crypto.randomUUID();
      setPunti(prev=>[...prev,{id,lat:latlng[0],lng:latlng[1],nome:cfg.nome,comune:cfg.comune,materiale:cfg.materiale,sector:cfg.sector,color:cfg.color}]);
      return cfg;
    });
  },[drawingPunti]);

  const deletePunto=useCallback((id)=>setPunti(prev=>prev.filter(p=>p.id!==id)),[]);
  const cancelPuntoEdit=()=>{ setDrawingPunti(false); setEditingPunto(false); setPuntoCfg(EMPTY_PUNTO_CFG); };

  // ── gruppi state ─────────────────────────────────────────────────────────
  const [gruppi,setGruppi]=useState(()=>{ try{return JSON.parse(localStorage.getItem("fleetcc_gruppi")||"[]");}catch{return[];} });
  const [percorsiViewMode,setPercorsiViewMode]=useState("items"); // "items" | "gruppi"
  const [zoneViewMode,setZoneViewMode]=useState("items");         // "items" | "gruppi"
  const [puntiViewMode,setPuntiViewMode]=useState("items");       // "items" | "gruppi"
  const [editingGruppo,setEditingGruppo]=useState(false);
  const [gruppoCfg,setGruppoCfg]=useState(EMPTY_GRUPPO_CFG);
  useEffect(()=>{ localStorage.setItem("fleetcc_gruppi",JSON.stringify(gruppi)); },[gruppi]);
  const saveGruppo=()=>{
    if(!gruppoCfg.name.trim())return;
    setGruppi(prev=>[...prev,{...gruppoCfg,id:crypto.randomUUID()}]);
    setEditingGruppo(false);
    setGruppoCfg(EMPTY_GRUPPO_CFG);
  };
  const deleteGruppo=useCallback((id)=>setGruppi(prev=>prev.filter(g=>g.id!==id)),[]);
  const toggleGruppoItem=(field,id)=>setGruppoCfg(c=>({...c,[field]:c[field].includes(id)?c[field].filter(x=>x!==id):[...c[field],id]}));

  // ── centri di raccolta state ──────────────────────────────────────────────
  const [cdr,setCdr]=useState(()=>{try{return JSON.parse(localStorage.getItem("fleetcc_cdr")||"[]");}catch{return[];}});
  const [editingCdr,setEditingCdr]=useState(null);
  const [cdrMeta,setCdrMeta]=useState(EMPTY_CDR_META);
  const [cdrShapes,setCdrShapes]=useState([]);
  useEffect(()=>{localStorage.setItem("fleetcc_cdr",JSON.stringify(cdr));},[cdr]);
  const startNewCdr=()=>{setEditingCdr("new");setCdrMeta({...EMPTY_CDR_META});setCdrShapes([]);};
  const editCdrItem=(c)=>{setEditingCdr(c.id);setCdrMeta({name:c.name,comune:c.comune||"",materiale:c.materiale||"",sector:c.sector||"",address:c.address||"",lat:c.lat||null,lng:c.lng||null,color:c.color,opacity:c.opacity??0.5});setCdrShapes(c.shapes||[]);};
  const cancelCdrEdit=()=>{setEditingCdr(null);setCdrMeta(EMPTY_CDR_META);setCdrShapes([]);};
  const saveCdr=()=>{
    if(!cdrMeta.name.trim())return;
    const entry={...cdrMeta,shapes:cdrShapes};
    if(editingCdr==="new")setCdr(prev=>[...prev,{id:crypto.randomUUID(),...entry}]);
    else setCdr(prev=>prev.map(c=>c.id===editingCdr?{...c,...entry}:c));
    cancelCdrEdit();
  };
  const deleteCdr=(id)=>{if(window.confirm("Eliminare questo centro di raccolta?"))setCdr(prev=>prev.filter(c=>c.id!==id));};

  // ── CDR geocoding ─────────────────────────────────────────────────────────
  const [cdrGeoLoading,setCdrGeoLoading]=useState(false);
  const cdrGeoAbortRef=useRef(null);
  const geocodeCdrAddress=useCallback(async(addr)=>{
    const q=(addr||cdrMeta.address||"").trim();
    if(!q)return;
    if(cdrGeoAbortRef.current)cdrGeoAbortRef.current.abort();
    cdrGeoAbortRef.current=new AbortController();
    setCdrGeoLoading(true);
    try{
      const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,{headers:{"Accept-Language":"it"},signal:cdrGeoAbortRef.current.signal});
      const data=await res.json();
      if(data.length>0)setCdrMeta(m=>({...m,lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon)}));
    }catch(e){if(e.name!=="AbortError")setCdrMeta(m=>({...m,lat:null,lng:null}));}
    setCdrGeoLoading(false);
  },[cdrMeta.address]);

  // ── Navigation functions ────────────────────────────────────────────────────
  const searchNavDest=useCallback(async(q)=>{
    if(!q.trim()){setNavDestResults([]);return;}
    if(navAbortRef.current)navAbortRef.current.abort();
    navAbortRef.current=new AbortController();
    setNavDestLoading(true);
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,{headers:{"Accept-Language":"it"},signal:navAbortRef.current.signal});
      const d=await r.json();
      if(!navAbortRef.current?.signal.aborted)setNavDestResults(d);
    }catch(e){if(e.name!=="AbortError")setNavDestResults([]);}
    setNavDestLoading(false);
  },[]);

  const startNavigation=useCallback(async(dest)=>{
    if(!myPos){setNavError("Posizione GPS non disponibile.");return;}
    setNavStatus("loading");setNavError(null);setNavDest(dest);setShowNavPanel(false);
    try{
      const r=await fetch(`${API}/gps/navigate`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({from:myPos,to:[dest.lat,dest.lng],costing:navCosting})});
      const d=await r.json();
      if(!d.ok){setNavError(d.error||"Errore calcolo percorso");setNavStatus("idle");return;}
      setNavRoute(d.data);setNavStep(0);setNavStatus("active");
      // Draw route on map
      if(liveMapRef.current){
        if(navPolyRef.current){navPolyRef.current.remove();navPolyRef.current=null;}
        navPolyRef.current=L.polyline(d.data.shape,{color:"#3b82f6",weight:7,opacity:0.85}).addTo(liveMapRef.current);
        liveMapRef.current.fitBounds(navPolyRef.current.getBounds(),{padding:[60,60]});
      }
    }catch{setNavError("Errore di rete");setNavStatus("idle");}
  },[myPos,auth?.token,navCosting]);

  const stopNavigation=useCallback(()=>{
    setNavStatus("idle");setNavRoute(null);setNavStep(0);setNavDest(null);setNavError(null);
    setNavDestQuery("");setNavDestResults([]);
    if(navPolyRef.current){navPolyRef.current.remove();navPolyRef.current=null;}
  },[]);

  // Auto-advance nav step as user moves
  useEffect(()=>{
    if(navStatus!=="active"||!myPos||!navRoute)return;
    const m=navRoute.maneuvers[navStep];
    if(!m)return;
    const endPt=navRoute.shape[m.end_shape_index];
    if(!endPt)return;
    const dist=distanceM(myPos,endPt);
    const isLast=navStep>=navRoute.maneuvers.length-1;
    if(dist<25){
      if(isLast){setNavStatus("arrived");setTimeout(stopNavigation,4000);}
      else setNavStep(s=>s+1);
    }
  },[myPos,navStatus,navRoute,navStep,stopNavigation]);

  const searchAddress=useCallback(async(q)=>{
    if(!q.trim()){setSearchResults([]);return;}
    if(nominatimAbortRef.current) nominatimAbortRef.current.abort();
    nominatimAbortRef.current=new AbortController();
    const signal=nominatimAbortRef.current.signal;
    setSearchLoading(true);
    try{
      const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,{headers:{"Accept-Language":"it"},signal});
      const data=await res.json();
      if(!signal.aborted) setSearchResults(data);
    }catch(e){ if(e.name!=="AbortError") setSearchResults([]); }
    if(!signal.aborted) setSearchLoading(false);
  },[]);

  const flyToResult=useCallback((r)=>{
    if(!liveMapRef.current)return;
    const map=liveMapRef.current;
    const lat=parseFloat(r.lat),lng=parseFloat(r.lon);
    map.flyTo([lat,lng],16,{animate:true,duration:1.2});
    if(searchPinRef.current){searchPinRef.current.remove();searchPinRef.current=null;}
    searchPinRef.current=L.marker([lat,lng],{icon:L.divIcon({className:"",html:`<div style="width:22px;height:22px;background:#f87171;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(0,0,0,0.6)"></div>`,iconSize:[22,22],iconAnchor:[11,11]})})
      .addTo(map).bindPopup(`<b style="font-size:12px">${r.display_name}</b>`).openPopup();
    setSearchResults([]);setSearchAddr(r.display_name);
    setSelectedSearchResult({lat,lng,address:r.display_name});
    setSegTerritorio({tipo:"",note:""});setSegTerritorioMsg(null);
  },[]);

  const submitSegTerritorio=useCallback(async()=>{
    if(!segTerritorio.tipo){setSegTerritorioMsg({ok:false,text:"Seleziona un tipo"});return;}
    if(segTerritorio.tipo==="altro"&&!segTerritorio.note.trim()){setSegTerritorioMsg({ok:false,text:"Aggiungi una nota per 'Altro'"});return;}
    setSegTerritorioSending(true);setSegTerritorioMsg(null);
    try{
      const res=await fetch(`${API}/segnalazioni-territorio`,{
        method:"POST",
        headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          tipo:segTerritorio.tipo,
          note:segTerritorio.note||null,
          address:selectedSearchResult?.address||null,
          lat:selectedSearchResult?.lat??null,
          lng:selectedSearchResult?.lng??null,
        }),
      });
      const d=await res.json();
      if(d.ok){
        setSegTerritorioMsg({ok:true,text:"Segnalazione inviata"});
        setSegTerritorio({tipo:"",note:""});
        setTimeout(()=>{setSegTerritorioMsg(null);setSelectedSearchResult(null);},2000);
      } else {
        setSegTerritorioMsg({ok:false,text:d.error||"Errore"});
      }
    }catch{setSegTerritorioMsg({ok:false,text:"Errore di rete"});}
    setSegTerritorioSending(false);
  },[segTerritorio,selectedSearchResult,auth.token]);

  const loadRoutes=useCallback(async()=>{
    try{
      const r=await fetch(`${API}/gps/routes`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await r.json();
      if(d.ok){setRoutes(d.data);setVisibleRoutes(prev=>{const n={...prev};d.data.forEach(r=>{if(!(r.id in n))n[r.id]=true;});return n;});}
    }catch{}
  },[auth.token]);
  useEffect(()=>{loadRoutes();},[loadRoutes]);

  const toggleRoute=(id)=>setVisibleRoutes(prev=>({...prev,[id]:!prev[id]}));
  const startEdit=(r)=>{setEditingId(r.id);setEditWaypoints(r.waypoints.map(wp=>[...wp]));setMeta({name:r.name,color:r.color,opacity:r.opacity??0.85,comune:r.comune||"",materiale:r.materiale||"",sector:r.sector||""});setSnappedSegments(null);setEditAnnotations(r.annotations||[]);setAnnotMode(false);setAnnotEditId(null);};
  const startNew=()=>{setEditingId("new");setEditWaypoints([]);setMeta({...EMPTY_META});setSnappedSegments(null);setEditAnnotations([]);setAnnotMode(false);setAnnotEditId(null);};
  const cancelEdit=()=>{setEditingId(null);setEditWaypoints([]);setMeta(EMPTY_META);setSnappedSegments(null);setEditAnnotations([]);setAnnotMode(false);setAnnotEditId(null);};

  // ── Snap-to-roads ──────────────────────────────────────────────────────────
  const reSnapSegments=useCallback(async(controlPts,segStart,segEnd)=>{
    const n=controlPts.length;
    if(n<2)return;
    const s=Math.max(0,segStart),e=Math.min(n-2,segEnd);
    if(s>e)return;
    const sub=controlPts.slice(s,e+2);
    try{
      const res=await fetch(`${API}/gps/routes/snap-to-roads`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth?.token}`},
        body:JSON.stringify({waypoints:sub,costing:snapCosting}),
      });
      const json=await res.json();
      if(json.ok){
        setSnappedSegments(prev=>{
          if(!prev)return prev;
          const next=[...prev];
          next.splice(s,e-s+1,...json.data.segments);
          return next;
        });
      }
    }catch{/* silent fail — control points already updated visually */}
  },[auth?.token,snapCosting]);

  const handleSnapToRoads=useCallback(async()=>{
    if(editWaypoints.length<2)return;
    setSnapLoading(true);
    try{
      const res=await fetch(`${API}/gps/routes/snap-to-roads`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth?.token}`},
        body:JSON.stringify({waypoints:editWaypoints,costing:snapCosting}),
      });
      const json=await res.json();
      if(!json.ok){
        setCsvError(json.error||"Errore snap-to-roads");
        setTimeout(()=>setCsvError(null),8000);
      } else {
        setSnappedSegments(json.data.segments);
        if(json.data.unmatched?.length)setSnapPopup(json.data.unmatched);
      }
    }catch{
      setCsvError("Valhalla non disponibile. Avvia il server di routing.");
      setTimeout(()=>setCsvError(null),8000);
    }finally{
      setSnapLoading(false);
    }
  },[editWaypoints,auth?.token,snapCosting]);

  const handleInsertControlPoint=useCallback((insertIdx,latlng)=>{
    const newPts=[...editWaypoints.slice(0,insertIdx),latlng,...editWaypoints.slice(insertIdx)];
    setEditWaypoints(newPts);
    reSnapSegments(newPts,insertIdx-1,insertIdx);
  },[editWaypoints,reSnapSegments]);

  // ── CSV / Excel import ────────────────────────────────────────────────────
  const csvInputRef=useRef(null);
  const excelInputRef=useRef(null);
  const [csvError,setCsvError]=useState(null);
  const [excelLoading,setExcelLoading]=useState(false);
  const [excelPopup,setExcelPopup]=useState(null); // null | [{address,reason}]

  const parseCSVCoords=(text)=>{
    const sep=text.includes(";")?";":","
    const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<1)return null;
    // detect header vs pure numeric first row
    const firstCells=lines[0].split(sep).map(c=>c.trim().replace(/['"]/g,""));
    const firstIsData=firstCells.every(c=>!isNaN(parseFloat(c))&&c!=="");
    let latIdx=-1,lngIdx=-1,dataStart=1,defaultName="";
    if(firstIsData){
      // no header: assume first two columns are lat,lng
      latIdx=0;lngIdx=1;dataStart=0;
    } else {
      const header=firstCells.map(h=>h.toLowerCase());
      latIdx=header.findIndex(h=>["lat","latitude","y","nord","n"].includes(h));
      lngIdx=header.findIndex(h=>["lon","lng","longitude","x","est","e"].includes(h));
      if(latIdx===-1||lngIdx===-1)return null;
      const nameIdx=header.findIndex(h=>["name","nome","percorso"].includes(h));
      if(nameIdx!==-1)defaultName=lines[1]?.split(sep)[nameIdx]?.trim().replace(/['"]/g,"")||"";
    }
    const coords=[];
    for(let i=dataStart;i<lines.length;i++){
      const parts=lines[i].split(sep).map(p=>p.trim().replace(/['"]/g,""));
      const lat=parseFloat(parts[latIdx]),lng=parseFloat(parts[lngIdx]);
      if(!isNaN(lat)&&!isNaN(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180)coords.push([lat,lng]);
    }
    return coords.length>=2?{coords,defaultName}:null;
  };

  const handleCSVFile=(e)=>{
    const file=e.target.files[0];if(!file)return;
    e.target.value="";
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const result=parseCSVCoords(ev.target.result);
      if(!result){
        setCsvError("CSV non valido. Servono colonne lat/lng (o latitude/longitude). Min. 2 punti.");
        setTimeout(()=>setCsvError(null),6000);return;
      }
      const {coords,defaultName}=result;
      const name=defaultName||(file.name.replace(/\.[^.]+$/,""));
      setEditingId("new");
      setEditWaypoints(coords);
      setMeta({...EMPTY_META,name});
    };
    reader.readAsText(file);
  };
  // ── Excel import ──────────────────────────────────────────────────────────
  const handleExcelFile=async(e)=>{
    const file=e.target.files[0]; if(!file)return;
    e.target.value="";
    setExcelLoading(true);
    try{
      const fd=new FormData();
      fd.append("file",file);
      const res=await fetch(`${API}/gps/routes/import-excel`,{
        method:"POST",
        headers:{Authorization:`Bearer ${auth?.token}`},
        body:fd,
      });
      const json=await res.json();
      if(!json.ok){
        setCsvError(json.error||"Errore importazione Excel");
        setTimeout(()=>setCsvError(null),8000);
        if(json.unrecognized?.length)setExcelPopup(json.unrecognized);
      } else {
        const{waypoints,unrecognized}=json.data;
        const name=file.name.replace(/\.[^.]+$/,"");
        setEditingId("new");
        setEditWaypoints(waypoints);
        setMeta({...EMPTY_META,name});
        if(unrecognized?.length)setExcelPopup(unrecognized);
      }
    }catch{
      setCsvError("Errore di rete durante l'importazione Excel");
      setTimeout(()=>setCsvError(null),6000);
    }finally{
      setExcelLoading(false);
    }
  };

  const handleMapClick=useCallback((latlng)=>{
    if(editingId!==null&&annotMode){
      const id=crypto.randomUUID();
      setEditAnnotations(prev=>[...prev,{id,lat:latlng[0],lng:latlng[1],text:"",color:"#facc15"}]);
      setAnnotEditId(id);
      setAnnotMode(false);
      return;
    }
    if(editingId!==null&&!snapMode)setEditWaypoints(prev=>[...prev,latlng]);
  },[editingId,annotMode,snapMode]);
  const handleWaypointMove=useCallback((idx,latlng)=>{
    const newPts=editWaypoints.map((wp,i)=>i===idx?latlng:wp);
    setEditWaypoints(newPts);
    if(snappedSegments!==null)reSnapSegments(newPts,Math.max(0,idx-1),Math.min(newPts.length-2,idx));
  },[editWaypoints,snappedSegments,reSnapSegments]);
  const handleWaypointDelete=useCallback((idx)=>{
    const newPts=editWaypoints.filter((_,i)=>i!==idx);
    setEditWaypoints(newPts);
    if(snappedSegments!==null){
      if(newPts.length<2)setSnappedSegments(null);
      else reSnapSegments(newPts,Math.max(0,idx-1),Math.min(newPts.length-2,idx-1));
    }
  },[editWaypoints,snappedSegments,reSnapSegments]);

  const saveRoute=async()=>{
    if(!meta.name.trim()||editWaypoints.length<2)return;
    setSaving(true);
    try{
      const body={...meta,waypoints:snappedPath||editWaypoints,opacity:Number(meta.opacity),annotations:editAnnotations};
      const url=editingId==="new"?`${API}/gps/routes`:`${API}/gps/routes/${editingId}`;
      const method=editingId==="new"?"POST":"PUT";
      const d=await(await fetch(url,{method,headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(body)})).json();
      if(d.ok){cancelEdit();await loadRoutes();}
    }catch{}
    setSaving(false);
  };
  const deleteRoute=async(id)=>{
    if(!window.confirm("Eliminare questo percorso?"))return;
    await fetch(`${API}/gps/routes/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}});
    await loadRoutes();
  };

  const canEdit=can("gps","edit");
  const editorActive=tab==="editor"&&editingId!==null;

  // ── Geolocation: share position to backend ────────────────────────────────
  const toggleSharing=useCallback(()=>{
    if(!sharing){
      startGeo();
      setSharing(true);
    } else {
      stopGeo();
      setSharing(false);
      // tell backend we stopped
      fetch(`${API}/gps/driver-location`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}}).catch(()=>{});
    }
  },[sharing,startGeo,stopGeo,auth.token]);

  // Auto-center map on first GPS fix
  useEffect(()=>{
    if(!myPos||centeredRef.current)return;
    if(liveMapRef.current){liveMapRef.current.flyTo(myPos,16);centeredRef.current=true;}
  },[myPos]);

  // POST position every 30s while sharing
  useEffect(()=>{
    if(!sharing||!myPos)return;
    const send=()=>fetch(`${API}/gps/driver-location`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({lat:myPos[0],lng:myPos[1]})}).catch(()=>{});
    send();
    const id=setInterval(send,30000);
    return()=>clearInterval(id);
  },[sharing,myPos,auth.token]);

  // Poll other drivers' positions (every 30s) when on live tab
  useEffect(()=>{
    if(tab!=="live")return;
    const poll=()=>fetch(`${API}/gps/driver-locations`,{headers:{Authorization:`Bearer ${auth.token}`}})
      .then(r=>r.json()).then(d=>{if(d.ok)setDriverLocs(d.data);}).catch(()=>{});
    poll();
    const id=setInterval(poll,30000);
    return()=>clearInterval(id);
  },[tab,auth.token]);
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"};

  const visibleAnnotations=useMemo(()=>{
    const out=[];
    if(editingId!==null){
      editAnnotations.forEach(a=>out.push(a));
    } else {
      (routes||[]).forEach(r=>{ if(visibleRoutes[r.id]!==false)(r.annotations||[]).forEach(a=>out.push(a)); });
      zones.forEach(z=>{ if(visibleZones[z.id]!==false)(z.annotations||[]).forEach(a=>out.push(a)); });
      punti.forEach(p=>{ if(visiblePunti[p.id]!==false&&p.annotation)out.push({id:p.id,lat:p.lat,lng:p.lng,text:p.annotation,color:p.color}); });
    }
    return out;
  },[routes,zones,punti,visibleRoutes,visibleZones,visiblePunti,editAnnotations,editingId]);

  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;

  const ALL_GPS_TABS=[
    {id:"live",    label:"GPS Live",            icon:"M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0 M12 7v5l3 3",                                                        modes:["live"]},
    {id:"cdr",     label:"Centri di Raccolta",  icon:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",                                           modes:["live","editors"]},
    {id:"editor",  label:"Percorsi",            icon:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",                                             modes:["editors"]},
    {id:"zone",    label:"Zone",                icon:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",                                                 modes:["editors"]},
    {id:"punti",   label:"Punti",               icon:"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",                modes:["editors"]},
  ];
  const gpsTabs=ALL_GPS_TABS.filter(t=>t.modes.includes(mode));

  // On mobile + live tab: fullscreen map (only bottom app tab bar eats space)
  const mobileFullscreen = isMobile && tab === "live";

  return(
    <div style={{display:"flex",flexDirection:"column",height:mobileFullscreen?"calc(100dvh - 60px)":isMobile?"calc(100dvh - 144px)":"calc(100vh - 130px)",fontFamily:T.font}}>
      <div style={{display:mobileFullscreen?"none":"flex",alignItems:"center",gap:0,flexShrink:0}}>
        <TabBar tabs={gpsTabs} active={tab} onChange={(t)=>{setTab(t);cancelEdit();cancelCdrEdit();}}/>
        <div style={{marginLeft:"auto",marginBottom:20,display:"flex",gap:8}}>
          {tab==="editor"&&canEdit&&!editingId&&(
            <>
              <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{display:"none"}}/>
              <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.ods" onChange={handleExcelFile} style={{display:"none"}}/>
              <button onClick={()=>csvInputRef.current.click()} style={{padding:"7px 16px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,color:T.textSub,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>↑ Importa CSV</button>
              <button onClick={()=>excelInputRef.current.click()} disabled={excelLoading} style={{padding:"7px 16px",background:excelLoading?T.bg:T.bg,border:`1px solid ${excelLoading?T.border:T.green+"55"}`,borderRadius:8,color:excelLoading?T.textDim:T.green,cursor:excelLoading?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                {excelLoading&&<span style={{display:"inline-block",width:11,height:11,border:`2px solid ${T.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>}
                {excelLoading?"Geocodifica…":"↑ Importa Excel"}
              </button>
              <button onClick={startNew} style={{padding:"7px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Nuovo percorso</button>
            </>
          )}
          {tab==="editor"&&editingId&&(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {!snapMode&&editWaypoints.length>=2&&(
                <>
                  <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:`1px solid ${T.border}`}}>
                    {[["auto","🚗 Pat. B"],["truck","🚛 Pat. C"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setSnapCosting(v)} style={{padding:"5px 12px",background:snapCosting===v?T.navActive:T.bg,color:snapCosting===v?T.blue:T.textSub,border:"none",cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600}}>{l}</button>
                    ))}
                  </div>
                  <button onClick={handleSnapToRoads} disabled={snapLoading} style={{padding:"7px 14px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:snapLoading?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                    {snapLoading&&<span style={{display:"inline-block",width:11,height:11,border:`2px solid ${T.blue}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>}
                    {snapLoading?"Calcolo…":"🛣 Segui le strade"}
                  </button>
                </>
              )}
              {snapMode&&(
                <>
                  <span style={{fontSize:11,color:T.teal,fontWeight:600}}>✓ Su strada</span>
                  <span style={{fontSize:11,color:T.textSub}}>Click linea → aggiungi · Tasto dx punto → rimuovi · Trascina → sposta</span>
                  <button onClick={()=>setSnappedSegments(null)} style={{padding:"4px 10px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,cursor:"pointer",fontSize:11,fontFamily:T.font}}>↩ Mano libera</button>
                </>
              )}
              {!snapMode&&editWaypoints.length<2&&(
                <span style={{fontSize:11,color:T.textSub}}>Click mappa → aggiungi · Click punto → rimuovi · Trascina → sposta</span>
              )}
            </div>
          )}
          {tab==="editor"&&csvError&&(
            <span style={{fontSize:11,color:T.red,display:"flex",alignItems:"center",maxWidth:340}}>{csvError}</span>
          )}
          {tab==="zone"&&!editingZone&&(
            <button onClick={()=>setEditingZone(true)} style={{padding:"7px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Nuova zona</button>
          )}
          {tab==="zone"&&editingZone&&drawingZone&&(
            <span style={{fontSize:11,color:T.textSub,display:"flex",alignItems:"center"}}>
              {{circle:"Click 1=centro · Click 2=bordo",square:"Click 1=angolo A · Click 2=angolo B",triangle:"3 click per i vertici",parallelogram:"4 click per i vertici"}[zoneCfg.type]}
            </span>
          )}
          {tab==="punti"&&!editingPunto&&(
            <button onClick={()=>setEditingPunto(true)} style={{padding:"7px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Nuovo punto</button>
          )}
          {tab==="punti"&&editingPunto&&drawingPunti&&(
            <span style={{fontSize:11,color:T.textSub,display:"flex",alignItems:"center"}}>Modalità attiva — click sulla mappa per aggiungere</span>
          )}
          {tab==="cdr"&&canEdit&&!editingCdr&&(
            <button onClick={startNewCdr} style={{padding:"7px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Nuovo Centro</button>
          )}
          {tab==="cdr"&&editingCdr&&(
            <span style={{fontSize:11,color:T.textSub,display:"flex",alignItems:"center"}}>Disegna la planimetria del centro — usa gli strumenti nella toolbar</span>
          )}
        </div>
      </div>

      <div style={{display:"flex",gap:16,flex:1,minHeight:0}}>

        {/* ── GPS Live: collapsible left vehicle panel (hidden on mobile fullscreen) ── */}
        {tab==="live"&&!mobileFullscreen&&(
          <div style={{display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s ease",width:livePanelOpen?260:40,overflow:"hidden"}}>
            {/* toggle tab */}
            <div onClick={()=>setLivePanelOpen(o=>!o)}
              style={{display:"flex",alignItems:"center",justifyContent:livePanelOpen?"space-between":"center",gap:6,padding:"8px 10px",background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,cursor:"pointer",marginBottom:8,flexShrink:0}}>
              {livePanelOpen&&<span style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8}}>Veicoli</span>}
              <span style={{fontSize:16,color:T.textSub,lineHeight:1}}>{livePanelOpen?"◀":"▶"}</span>
            </div>

            {livePanelOpen&&<>
              {/* address search */}
              <div style={{marginBottom:8,position:"relative"}}>
                <div style={{display:"flex",gap:0,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,overflow:"hidden"}}>
                  <input value={searchAddr} onChange={e=>{setSearchAddr(e.target.value);if(e.target.value.length<2)setSearchResults([]);}}
                    onKeyDown={e=>{if(e.key==="Enter")searchAddress(searchAddr);}}
                    placeholder="Cerca indirizzo..." style={{flex:1,background:"transparent",border:"none",color:T.text,padding:"7px 10px",fontSize:12,fontFamily:T.font,outline:"none"}}/>
                  <button onClick={()=>searchAddress(searchAddr)} style={{background:T.navActive,border:"none",borderLeft:`1px solid ${T.border}`,color:T.blue,padding:"7px 11px",cursor:"pointer",fontSize:13}}>
                    {searchLoading?"…":"🔍"}
                  </button>
                </div>
                {searchResults.length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:2000,background:T.card,border:`1px solid ${T.border}`,borderRadius:7,boxShadow:"0 6px 20px rgba(0,0,0,0.4)",marginTop:3,maxHeight:200,overflowY:"auto"}}>
                    {searchResults.map((r,i)=>(
                      <div key={i} onClick={()=>flyToResult(r)} style={{padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,fontSize:11,color:T.text,lineHeight:1.4}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        {r.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Segnalazione territorio (visible after address picked) ── */}
              {selectedSearchResult&&(
                <div style={{background:T.card,border:`1px solid ${T.orange}44`,borderRadius:10,padding:"12px 13px",marginBottom:10,flexShrink:0}}>
                  {/* header */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.orange} strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <span style={{fontSize:11,fontWeight:700,color:T.orange,textTransform:"uppercase",letterSpacing:0.8}}>Segnalazione</span>
                    </div>
                    <button onClick={()=>{setSelectedSearchResult(null);setSegTerritorio({tipo:"",note:""});setSegTerritorioMsg(null);}}
                      style={{background:"transparent",border:"none",color:T.textDim,cursor:"pointer",fontSize:15,lineHeight:1,padding:2}}>×</button>
                  </div>
                  {/* address chip */}
                  <div style={{fontSize:10,color:T.textDim,background:T.bg,borderRadius:6,padding:"5px 8px",marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    📍 {selectedSearchResult.address}
                  </div>
                  {/* tipo bullets */}
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
                    {[
                      {id:"mancata_raccolta", label:"Mancata raccolta", color:T.red},
                      {id:"abbandono",        label:"Abbandoni",        color:T.orange},
                      {id:"da_pulire",        label:"Da pulire",        color:T.yellow},
                      {id:"altro",            label:"Altro",            color:T.textSub},
                    ].map(opt=>{
                      const active=segTerritorio.tipo===opt.id;
                      return(
                        <button key={opt.id} onClick={()=>setSegTerritorio(s=>({...s,tipo:opt.id,note:opt.id!=="altro"?"":s.note}))}
                          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:7,border:`1px solid ${active?opt.color+"88":T.border}`,background:active?opt.color+"18":T.bg,cursor:"pointer",textAlign:"left",fontFamily:T.font,transition:"all 0.12s"}}>
                          <div style={{width:12,height:12,borderRadius:"50%",border:`2px solid ${active?opt.color:T.textDim}`,background:active?opt.color:"transparent",flexShrink:0,transition:"all 0.12s"}}/>
                          <span style={{fontSize:12,color:active?opt.color:T.textSub,fontWeight:active?700:400}}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* note field (always shown for "altro", optional otherwise) */}
                  {segTerritorio.tipo&&(
                    <textarea value={segTerritorio.note} onChange={e=>setSegTerritorio(s=>({...s,note:e.target.value}))}
                      placeholder={segTerritorio.tipo==="altro"?"Descrivi il problema…":"Note aggiuntive (opzionale)…"}
                      rows={2}
                      style={{width:"100%",background:T.bg,border:`1px solid ${segTerritorio.tipo==="altro"&&!segTerritorio.note.trim()?T.red+"66":T.border}`,borderRadius:7,color:T.text,padding:"7px 9px",fontSize:11,fontFamily:T.font,outline:"none",resize:"vertical",boxSizing:"border-box",marginBottom:8}}/>
                  )}
                  {/* feedback */}
                  {segTerritorioMsg&&(
                    <div style={{fontSize:11,color:segTerritorioMsg.ok?T.green:T.red,marginBottom:8,padding:"5px 8px",background:segTerritorioMsg.ok?"#0a1a0a":"#1a0a0a",borderRadius:6,border:`1px solid ${segTerritorioMsg.ok?T.green+"44":T.red+"44"}`}}>
                      {segTerritorioMsg.text}
                    </div>
                  )}
                  <button onClick={submitSegTerritorio} disabled={segTerritorioSending||!segTerritorio.tipo}
                    style={{width:"100%",padding:"8px",background:segTerritorio.tipo?T.navActive:T.bg,border:`1px solid ${segTerritorio.tipo?T.orange+"66":T.border}`,borderRadius:7,color:segTerritorio.tipo?T.orange:T.textDim,cursor:segTerritorio.tipo&&!segTerritorioSending?"pointer":"not-allowed",fontSize:12,fontFamily:T.font,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.12s"}}>
                    {segTerritorioSending&&<span style={{display:"inline-block",width:10,height:10,border:`2px solid ${T.orange}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>}
                    {segTerritorioSending?"Invio…":"Invia segnalazione"}
                  </button>
                </div>
              )}

              {/* filters */}
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <input value={filterComune} onChange={e=>setFilterComune(e.target.value)} placeholder="Comune…"
                  style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"6px 8px",fontSize:11,fontFamily:T.font,outline:"none"}}/>
                <input value={filterSettore} onChange={e=>setFilterSettore(e.target.value)} placeholder="Settore…"
                  style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"6px 8px",fontSize:11,fontFamily:T.font,outline:"none"}}/>
              </div>
              {(filterComune||filterSettore)&&<div style={{fontSize:10,color:T.textDim,marginBottom:6,paddingLeft:2}}>
                {(vehicles||[]).filter(v=>
                  (!filterComune||v.name?.toLowerCase().includes(filterComune.toLowerCase())||(v.comune||"").toLowerCase().includes(filterComune.toLowerCase()))&&
                  (!filterSettore||(v.sector||"").toLowerCase().includes(filterSettore.toLowerCase()))
                ).length} veicoli mostrati
              </div>}

              {/* vehicle cards */}
              <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
                {(vehicles||[])
                  .filter(v=>
                    (!filterComune||v.name?.toLowerCase().includes(filterComune.toLowerCase())||(v.comune||"").toLowerCase().includes(filterComune.toLowerCase()))&&
                    (!filterSettore||(v.sector||"").toLowerCase().includes(filterSettore.toLowerCase()))
                  )
                  .map(v=>(
                  <div key={v.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:9,padding:"11px 12px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:700,color:T.text,lineHeight:1.2}}>{v.name}</span>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:9,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:700,flexShrink:0,marginLeft:4}}>{statusLabel[v.status]}</span>
                    </div>
                    <div style={{fontSize:10,color:T.textSub,marginBottom:6}}>{v.plate}{v.sector?` · ${v.sector}`:""}</div>
                    {v.fuel_pct!=null&&<>
                      <div style={{height:3,background:T.border,borderRadius:2,marginBottom:2}}>
                        <div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?T.red:T.green,borderRadius:2}}/>
                      </div>
                      <div style={{fontSize:9,color:v.fuel_pct<20?T.red:T.textDim,marginBottom:6}}>⛽ {v.fuel_pct}%</div>
                    </>}
                    <button onClick={()=>onSelectVehicle(v)} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:5,color:T.text,padding:"5px",cursor:"pointer",fontSize:11,fontFamily:T.font}}>Dettaglio →</button>
                  </div>
                ))}
              </div>
            </>}
          </div>
        )}

        <div ref={mapContainerRef} style={{flex:1,borderRadius:12,border:`1px solid ${T.border}`,position:"relative",overflow:"hidden"}}>
          {(tab==="live"||tab==="editor")&&<FleetMap
            vehicles={vehicles} routes={routes||[]} visibleRoutes={visibleRoutes}
            zones={tab==="live"?zones.filter(z=>visibleZones[z.id]!==false):[]} punti={tab==="live"?punti.filter(p=>visiblePunti[p.id]!==false):[]}
            editMode={editorActive} editWaypoints={editWaypoints} editColor={meta.color}
            snappedSegments={snappedSegments} snapMode={snapMode}
            onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onWaypointDelete={handleWaypointDelete} onPathClick={handleInsertControlPoint}
            searchMarkerRef={tab==="live"?liveMapRef:null}
            annotations={visibleAnnotations}
            cdr={tab==="live"?cdr.filter(c=>c.lat&&c.lng):[]}
            onCdrClick={tab==="live"?(c)=>{setTab("cdr");editCdrItem(c);}:null}
            myPosition={tab==="live"?myPos:null}
            driverLocations={tab==="live"?driverLocs:[]}
          />}
          {tab==="zone"&&<ZoneMap zones={zones} drawMode={drawingZone} zoneConfig={zoneCfg} onShapeComplete={handleShapeComplete} onZoneDelete={deleteZone}/>}
          {tab==="punti"&&<PuntiMap punti={punti} drawMode={drawingPunti} onMapClick={handlePuntiMapClick} onPuntoDelete={deletePunto}/>}
          {/* ── unified floating legend (live tab) ── */}
          {tab==="live"&&((routes&&routes.length>0)||zones.length>0||punti.length>0)&&(
            <div style={{position:"absolute",top:12,right:12,zIndex:1000,background:"rgba(13,27,42,0.82)",border:`1px solid ${T.border}`,borderRadius:10,minWidth:210,maxWidth:240,backdropFilter:"blur(8px)",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
              {/* Percorsi section */}
              {routes&&routes.length>0&&(
                <>
                  <div onClick={()=>setLegendOpen(o=>({...o,live:!o.live}))} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",userSelect:"none",borderBottom:legendOpen.live?`1px solid ${T.border}`:"none"}}>
                    <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:1,fontWeight:700,flex:1}}>Percorsi ({routes.length})</div>
                    <span style={{fontSize:12,color:T.textDim}}>{legendOpen.live?"▲":"▼"}</span>
                  </div>
                  {legendOpen.live&&<div style={{padding:"8px 14px",borderBottom:zones.length>0||punti.length>0?`1px solid ${T.border}`:"none"}}>
                    {routes.map(r=>(
                      <div key={r.id} onClick={()=>toggleRoute(r.id)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",opacity:visibleRoutes[r.id]?1:0.3,transition:"opacity 0.15s"}}>
                        <div style={{width:22,height:3,background:r.color,borderRadius:2,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,color:T.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</div>
                          {(r.comune||r.materiale)&&<div style={{fontSize:9,color:T.textDim}}>{[r.comune,r.materiale].filter(Boolean).join(" · ")}</div>}
                        </div>
                      </div>
                    ))}
                  </div>}
                </>
              )}
              {/* Zone section */}
              {zones.length>0&&(
                <>
                  <div onClick={()=>setLegendOpen(o=>({...o,zone:!o.zone}))} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",userSelect:"none",borderBottom:legendOpen.zone?`1px solid ${T.border}`:"none"}}>
                    <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:1,fontWeight:700,flex:1}}>Zone ({zones.length})</div>
                    <span style={{fontSize:12,color:T.textDim}}>{legendOpen.zone?"▲":"▼"}</span>
                  </div>
                  {legendOpen.zone&&<div style={{padding:"8px 14px",borderBottom:punti.length>0?`1px solid ${T.border}`:"none"}}>
                    {zones.map(z=>(
                      <div key={z.id} onClick={()=>toggleZone(z.id)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",opacity:visibleZones[z.id]!==false?1:0.3,transition:"opacity 0.15s"}}>
                        <div style={{width:14,height:14,flexShrink:0,background:z.fillColor,opacity:Math.max(z.fillOpacity,0.5),border:`2px solid ${z.borderColor}`,borderRadius:z.type==="circle"?"50%":"2px",clipPath:z.type==="triangle"?"polygon(50% 0%,0% 100%,100% 100%)":z.type==="parallelogram"?"polygon(25% 0%,100% 0%,75% 100%,0% 100%)":undefined}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,color:T.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{z.name||z.type}</div>
                          {(z.comune||z.materiale)&&<div style={{fontSize:9,color:T.textDim}}>{[z.comune,z.materiale].filter(Boolean).join(" · ")}</div>}
                        </div>
                        <span style={{fontSize:9,color:T.textDim,flexShrink:0}}>{z.type==="circle"?`${Math.round(z.radius)}m`:z.type.slice(0,3)}</span>
                      </div>
                    ))}
                  </div>}
                </>
              )}
              {/* Punti section */}
              {punti.length>0&&(
                <>
                  <div onClick={()=>setLegendOpen(o=>({...o,punti:!o.punti}))} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",userSelect:"none",borderBottom:legendOpen.punti?`1px solid ${T.border}`:"none"}}>
                    <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:1,fontWeight:700,flex:1}}>Punti ({punti.length})</div>
                    <span style={{fontSize:12,color:T.textDim}}>{legendOpen.punti?"▲":"▼"}</span>
                  </div>
                  {legendOpen.punti&&<div style={{padding:"8px 14px"}}>
                    {punti.map(p=>(
                      <div key={p.id} onClick={()=>togglePunto(p.id)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",opacity:visiblePunti[p.id]!==false?1:0.3,transition:"opacity 0.15s"}}>
                        <div style={{width:11,height:11,borderRadius:"50%",background:p.color,flexShrink:0,border:"2px solid #fff",boxShadow:"0 1px 3px rgba(0,0,0,0.4)"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,color:T.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nome||"—"}</div>
                          {(p.comune||p.materiale)&&<div style={{fontSize:9,color:T.textDim}}>{[p.comune,p.materiale].filter(Boolean).join(" · ")}</div>}
                        </div>
                      </div>
                    ))}
                  </div>}
                </>
              )}
              <div style={{padding:"6px 14px 8px",borderTop:`1px solid ${T.border}`,fontSize:9,color:T.textDim}}>Click per mostrare/nascondere</div>
            </div>
          )}
          {/* ── editor-tab legends (zone / punti) ── */}
          {tab==="zone"&&zones.length>0&&(
            <div style={{position:"absolute",top:12,right:12,zIndex:1000,background:"rgba(13,27,42,0.82)",border:`1px solid ${T.border}`,borderRadius:10,minWidth:190,backdropFilter:"blur(8px)",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
              <div onClick={()=>setLegendOpen(o=>({...o,zone:!o.zone}))} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",userSelect:"none"}}>
                <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:1,fontWeight:700,flex:1}}>Zone ({zones.length})</div>
                <span style={{fontSize:12,color:T.textDim}}>{legendOpen.zone?"▲":"▼"}</span>
              </div>
              {legendOpen.zone&&<div style={{padding:"0 14px 10px"}}>
                {zones.map(z=>(
                  <div key={z.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{width:13,height:13,flexShrink:0,background:z.fillColor,opacity:Math.max(z.fillOpacity,0.4),border:`2px solid ${z.borderColor}`,borderRadius:z.type==="circle"?"50%":"2px"}}/>
                    <span style={{fontSize:11,color:T.text,flex:1}}>{z.name||z.type}</span>
                    <button onClick={()=>deleteZone(z.id)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1}}>×</button>
                  </div>
                ))}
                <div style={{marginTop:4,paddingTop:6,borderTop:`1px solid ${T.border}`,fontSize:9,color:T.textDim}}>Click zona sulla mappa → elimina</div>
              </div>}
            </div>
          )}
          {tab==="punti"&&punti.length>0&&(
            <div style={{position:"absolute",top:12,right:12,zIndex:1000,background:"rgba(13,27,42,0.82)",border:`1px solid ${T.border}`,borderRadius:10,minWidth:190,backdropFilter:"blur(8px)",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
              <div onClick={()=>setLegendOpen(o=>({...o,punti:!o.punti}))} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",userSelect:"none"}}>
                <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:1,fontWeight:700,flex:1}}>Punti ({punti.length})</div>
                <span style={{fontSize:12,color:T.textDim}}>{legendOpen.punti?"▲":"▼"}</span>
              </div>
              {legendOpen.punti&&<div style={{padding:"0 14px 10px"}}>
                {punti.map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{width:11,height:11,borderRadius:"50%",background:p.color,flexShrink:0,border:"2px solid #fff"}}/>
                    <span style={{fontSize:11,color:T.text,flex:1}}>{p.nome||"—"}</span>
                    <button onClick={()=>deletePunto(p.id)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1}}>×</button>
                  </div>
                ))}
                <div style={{marginTop:4,paddingTop:6,borderTop:`1px solid ${T.border}`,fontSize:9,color:T.textDim}}>Click punto sulla mappa → popup</div>
              </div>}
            </div>
          )}
          {tab==="live"&&!mobileFullscreen&&(
            <div style={{position:"absolute",bottom:10,left:10,zIndex:1000,display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
              {/* Geolocation controls — desktop */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {myPos&&(
                  <button onClick={()=>liveMapRef.current?.flyTo(myPos,17)}
                    style={{background:"rgba(13,27,42,0.9)",border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,padding:"7px 12px",cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,backdropFilter:"blur(6px)",display:"flex",alignItems:"center",gap:6}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                    Centra su di me
                  </button>
                )}
                <button onClick={toggleSharing}
                  style={{background:sharing?"rgba(74,222,128,0.15)":"rgba(13,27,42,0.9)",border:`1px solid ${sharing?T.green+"88":T.border}`,borderRadius:8,color:sharing?T.green:T.textSub,padding:"7px 12px",cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,backdropFilter:"blur(6px)",display:"flex",alignItems:"center",gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={sharing?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                  {sharing?"Condivisione attiva":"Condividi posizione"}
                </button>
                <button onClick={()=>setShowCamera(true)}
                  style={{background:"rgba(13,27,42,0.9)",border:`1px solid ${T.yellow}55`,borderRadius:8,color:T.yellow,padding:"7px 12px",cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,backdropFilter:"blur(6px)",display:"flex",alignItems:"center",gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Foto timbrata
                </button>
              </div>
              {geoError&&<div style={{fontSize:10,color:T.red,background:"rgba(13,27,42,0.9)",padding:"4px 10px",borderRadius:6,backdropFilter:"blur(6px)"}}>{geoError}</div>}
              <div style={{fontSize:10,color:T.textSub,fontFamily:T.mono,background:"rgba(13,27,42,0.85)",padding:"4px 10px",borderRadius:6}}>Aggiornamento ogni 10s · Visirun mock</div>
            </div>
          )}

          {/* ── Mobile fullscreen live: glove-friendly FABs ── */}
          {mobileFullscreen&&(
            <>
              {/* Top-left: GPS tab menu button */}
              <button onClick={()=>setShowMobileTabPicker(o=>!o)}
                style={{position:"absolute",top:12,left:12,zIndex:1001,width:44,height:44,borderRadius:12,background:"rgba(13,27,42,0.88)",border:`1px solid ${T.border}`,color:T.textSub,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",backdropFilter:"blur(8px)"}}>
                ☰
              </button>
              {showMobileTabPicker&&(
                <div style={{position:"absolute",top:62,left:12,zIndex:1002,background:"rgba(13,27,42,0.96)",border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,0.5)",backdropFilter:"blur(12px)"}}>
                  {gpsTabs.map(t=>(
                    <button key={t.id} onClick={()=>{setTab(t.id);cancelEdit();cancelCdrEdit();setShowMobileTabPicker(false);}}
                      style={{display:"block",width:"100%",padding:"13px 20px",background:tab===t.id?T.navActive:"transparent",border:"none",borderBottom:`1px solid ${T.border}`,color:tab===t.id?T.blue:T.text,textAlign:"left",cursor:"pointer",fontSize:14,fontFamily:T.font,fontWeight:tab===t.id?700:400}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {/* Right-side FABs: bottom-right, stacked vertically */}
              <div style={{position:"absolute",bottom:20,right:16,zIndex:1001,display:"flex",flexDirection:"column",gap:14,alignItems:"center"}}>
                {/* Centre on me */}
                {myPos&&(
                  <button onClick={()=>liveMapRef.current?.flyTo(myPos,17)}
                    style={{width:64,height:64,borderRadius:18,background:"rgba(13,27,42,0.92)",border:`2px solid ${T.blue}88`,color:T.blue,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,backdropFilter:"blur(8px)",boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                    <span style={{fontSize:9,fontWeight:700,letterSpacing:0.4,lineHeight:1}}>CENTRA</span>
                  </button>
                )}
                {/* Share location */}
                <button onClick={toggleSharing}
                  style={{width:64,height:64,borderRadius:18,background:sharing?"rgba(74,222,128,0.18)":"rgba(13,27,42,0.92)",border:`2px solid ${sharing?T.green:T.border}`,color:sharing?T.green:T.textSub,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,backdropFilter:"blur(8px)",boxShadow:"0 4px 16px rgba(0,0,0,0.5)",transition:"background 0.2s, border-color 0.2s, color 0.2s"}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill={sharing?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:0.4,lineHeight:1}}>{sharing?"ATTIVO":"GPS"}</span>
                </button>
                {/* Camera */}
                <button onClick={()=>setShowCamera(true)}
                  style={{width:64,height:64,borderRadius:18,background:"rgba(13,27,42,0.92)",border:`2px solid ${T.yellow}88`,color:T.yellow,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,backdropFilter:"blur(8px)",boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:0.4,lineHeight:1}}>FOTO</span>
                </button>
                {/* Navigation */}
                {navStatus==="idle"||navStatus==="loading"?(
                  <button onClick={()=>{setShowNavPanel(v=>!v);setNavError(null);}}
                    style={{width:64,height:64,borderRadius:18,background:showNavPanel?"rgba(59,130,246,0.2)":"rgba(13,27,42,0.92)",border:`2px solid ${T.blue}88`,color:T.blue,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,backdropFilter:"blur(8px)",boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                    {navStatus==="loading"
                      ?<div style={{width:24,height:24,border:`3px solid ${T.blue}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                      :<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>}
                    <span style={{fontSize:9,fontWeight:700,letterSpacing:0.4,lineHeight:1}}>NAVIGA</span>
                  </button>
                ):(
                  <button onClick={stopNavigation}
                    style={{width:64,height:64,borderRadius:18,background:"rgba(248,113,113,0.18)",border:`2px solid ${T.red}`,color:T.red,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,backdropFilter:"blur(8px)",boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    <span style={{fontSize:9,fontWeight:700,letterSpacing:0.4,lineHeight:1}}>STOP</span>
                  </button>
                )}
              </div>

              {/* Navigation instruction banner */}
              {navStatus==="active"&&navRoute&&(
                <div style={{position:"absolute",top:12,left:64,right:64,zIndex:1003,background:"rgba(10,22,40,0.95)",border:`1px solid ${T.blue}66`,borderRadius:14,padding:"10px 16px",backdropFilter:"blur(12px)",boxShadow:"0 4px 20px rgba(0,0,0,0.6)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:28,lineHeight:1,color:T.blue,flexShrink:0}}>{NAV_ARROW[navRoute.maneuvers[navStep]?.type]||"↑"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:T.text,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                        {navRoute.maneuvers[navStep]?.instruction||"Continua dritto"}
                      </div>
                      <div style={{fontSize:11,color:T.blue,marginTop:3,fontFamily:T.mono}}>{fmtDist(navRoute.maneuvers[navStep]?.length||0)} · poi {navRoute.maneuvers[navStep+1]?NAV_ARROW[navRoute.maneuvers[navStep+1].type]||"↑":"🏁"}</div>
                    </div>
                    <div style={{fontSize:10,color:T.textSub,textAlign:"right",flexShrink:0}}>
                      <div style={{fontWeight:600,color:T.text}}>{fmtDist(navRoute.distance)}</div>
                      <div>{fmtTime(navRoute.duration)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arrived banner */}
              {navStatus==="arrived"&&(
                <div style={{position:"absolute",top:12,left:12,right:12,zIndex:1003,background:"rgba(74,222,128,0.15)",border:`1px solid ${T.green}`,borderRadius:14,padding:"14px 20px",backdropFilter:"blur(12px)",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:4}}>🏁</div>
                  <div style={{fontSize:15,fontWeight:700,color:T.green}}>Destinazione raggiunta!</div>
                  {navDest?.name&&<div style={{fontSize:12,color:T.textSub,marginTop:2}}>{navDest.name}</div>}
                </div>
              )}

              {geoError&&(
                <div style={{position:"absolute",bottom:20,left:12,zIndex:1001,fontSize:11,color:T.red,background:"rgba(13,27,42,0.9)",padding:"6px 12px",borderRadius:8,backdropFilter:"blur(6px)",maxWidth:"calc(100% - 100px)"}}>
                  {geoError}
                </div>
              )}
            </>
          )}
          {/* ── Navigation destination panel ── */}
          {showNavPanel&&mobileFullscreen&&(
            <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:1010,background:"rgba(10,16,26,0.97)",borderTop:`1px solid ${T.border}`,borderRadius:"20px 20px 0 0",padding:"20px 20px 36px",backdropFilter:"blur(16px)",boxShadow:"0 -8px 32px rgba(0,0,0,0.6)",fontFamily:T.font}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{fontSize:16,fontWeight:700,color:T.text}}>🧭 Navigazione</div>
                <button onClick={()=>setShowNavPanel(false)} style={{background:"transparent",border:"none",color:T.textDim,fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
              </div>
              {/* Costing toggle */}
              <div style={{display:"flex",gap:6,marginBottom:14}}>
                {[["auto","🚗 Auto"],["truck","🚛 Camion"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setNavCosting(v)}
                    style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${navCosting===v?T.blue:T.border}`,background:navCosting===v?T.navActive:"transparent",color:navCosting===v?T.blue:T.textSub,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:navCosting===v?700:400}}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Destination search */}
              <div style={{position:"relative",marginBottom:8}}>
                <input
                  value={navDestQuery}
                  onChange={e=>{setNavDestQuery(e.target.value);searchNavDest(e.target.value);}}
                  placeholder="Cerca indirizzo di destinazione…"
                  autoFocus
                  style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,padding:"12px 44px 12px 14px",fontSize:14,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                {navDestLoading
                  ?<div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",width:16,height:16,border:`2px solid ${T.blue}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                  :<svg style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)"}} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
              </div>
              {navError&&<div style={{fontSize:12,color:T.red,marginBottom:8,padding:"8px 12px",background:"#1a0808",borderRadius:8,border:"1px solid #3a1a1a"}}>{navError}</div>}
              {/* Results list */}
              {navDestResults.length>0&&(
                <div style={{maxHeight:220,overflowY:"auto",borderRadius:10,border:`1px solid ${T.border}`,background:T.card}}>
                  {navDestResults.map((r,i)=>(
                    <button key={i} onClick={()=>{
                      const dest={lat:parseFloat(r.lat),lng:parseFloat(r.lon),name:r.display_name};
                      setNavDestQuery(r.display_name);setNavDestResults([]);
                      startNavigation(dest);
                    }}
                      style={{display:"block",width:"100%",padding:"12px 14px",background:"transparent",border:"none",borderBottom:`1px solid ${T.border}`,color:T.text,textAlign:"left",cursor:"pointer",fontSize:13,fontFamily:T.font,lineHeight:1.4}}>
                      <div style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.display_name.split(",")[0]}</div>
                      <div style={{fontSize:11,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>{r.display_name.split(",").slice(1).join(",").trim()}</div>
                    </button>
                  ))}
                </div>
              )}
              {!myPos&&<div style={{fontSize:12,color:T.orange,marginTop:8,textAlign:"center"}}>⚠ Attiva il GPS prima di navigare</div>}
            </div>
          )}

          {/* ── PDF Export button (hidden on mobile fullscreen) ── */}
          {(tab==="live"||tab==="editor"||tab==="zone"||tab==="punti")&&!mobileFullscreen&&(
            <button onClick={()=>setPdfPanel(p=>!p)}
              style={{position:"absolute",bottom:10,right:10,zIndex:1001,background:"rgba(13,27,42,0.9)",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSub,padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,backdropFilter:"blur(6px)"}}>
              📄 PDF
            </button>
          )}
          {pdfPanel&&(
            <div style={{position:"absolute",bottom:46,right:10,zIndex:1002,background:"rgba(13,27,42,0.96)",border:`1px solid ${T.border}`,borderRadius:10,padding:16,width:230,backdropFilter:"blur(8px)",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",fontFamily:T.font}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Esporta mappa in PDF</div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6,fontWeight:600}}>Modalità</div>
                {[["tutto","Tutto"],["percorso","Percorsi"],["zona","Zone"],["punti","Punti"]].map(([v,l])=>(
                  <label key={v} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,cursor:"pointer"}}>
                    <input type="radio" name="pdfMode" value={v} checked={pdfMode===v} onChange={()=>setPdfMode(v)} style={{accentColor:T.blue}}/>
                    <span style={{fontSize:12,color:T.text}}>{l}</span>
                  </label>
                ))}
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Titolo</div>
                <input value={pdfTitle} onChange={e=>setPdfTitle(e.target.value)}
                  style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 9px",fontSize:12,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <button onClick={handleExportPdf} disabled={pdfExporting}
                style={{width:"100%",padding:"9px",background:pdfExporting?T.bg:T.navActive,border:`1px solid ${pdfExporting?T.border:T.blue+"66"}`,borderRadius:7,color:pdfExporting?T.textDim:T.blue,cursor:pdfExporting?"not-allowed":"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {pdfExporting&&<span style={{display:"inline-block",width:11,height:11,border:`2px solid ${T.blue}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>}
                {pdfExporting?"Generazione…":"Esporta PDF"}
              </button>
            </div>
          )}
          {/* ── CDR: placeholder (list mode) ── */}
          {tab==="cdr"&&!editingCdr&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"#0e1822"}}>
              <div style={{fontSize:48,opacity:0.1}}>🏭</div>
              <div style={{fontSize:14,fontWeight:600,color:T.textSub}}>Centri di Raccolta</div>
              <div style={{fontSize:12,color:T.textDim}}>Seleziona un centro o creane uno nuovo</div>
            </div>
          )}
          {/* ── CDR: Konva canvas (edit mode) ── */}
          {tab==="cdr"&&editingCdr&&(
            <div style={{position:"absolute",inset:0}}>
              <CdrCanvas shapes={cdrShapes} onChange={setCdrShapes} activeColor={cdrMeta.color} activeOpacity={cdrMeta.opacity??0.5}/>
            </div>
          )}
        </div>

        {/* ── EDITOR PERCORSI: list / gruppi ── */}
        {tab==="editor"&&!editingId&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            {/* view toggle */}
            <div style={{display:"flex",gap:3,background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:3,flexShrink:0}}>
              {[["items","Percorsi"],["gruppi","Gruppi"]].map(([mode,label])=>(
                <button key={mode} onClick={()=>{setPercorsiViewMode(mode);setEditingGruppo(false);setGruppoCfg(EMPTY_GRUPPO_CFG);}}
                  style={{flex:1,padding:"5px",borderRadius:6,border:"none",background:percorsiViewMode===mode?T.card:"transparent",color:percorsiViewMode===mode?T.text:T.textSub,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:percorsiViewMode===mode?700:400}}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── percorsi list ── */}
            {percorsiViewMode==="items"&&(
              <>
                {(routes||[]).length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:20}}>Nessun percorso</div>}
                {(routes||[]).map(r=>(
                  <div key={r.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:12,height:12,borderRadius:"50%",background:r.color,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:600,color:T.text,flex:1}}>{r.name}</span>
                      <span style={{fontSize:9,color:T.textDim,background:T.bg,padding:"2px 6px",borderRadius:4}}>{Math.round((r.opacity??0.85)*100)}%</span>
                    </div>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:10}}>{[r.comune,r.materiale,r.sector].filter(Boolean).join(" · ")||"—"} · {r.waypoints.length} pt</div>
                    <div style={{display:"flex",gap:6}}>
                      {canEdit&&<button onClick={()=>startEdit(r)} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Modifica</button>}
                      {canEdit&&<button onClick={()=>deleteRoute(r.id)} style={{background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── gruppi list ── */}
            {percorsiViewMode==="gruppi"&&!editingGruppo&&(
              <>
                <button onClick={()=>setEditingGruppo(true)} style={{padding:"7px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,flexShrink:0}}>+ Nuovo gruppo</button>
                {gruppi.length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:12}}>Nessun gruppo</div>}
                {gruppi.map(g=>(
                  <div key={g.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:T.text,flex:1}}>{g.name}</span>
                    </div>
                    <div style={{display:"flex",gap:10,marginBottom:10,fontSize:10,color:T.textSub,flexWrap:"wrap"}}>
                      {g.routeIds.length>0&&<span>🛣 {g.routeIds.length} percorsi</span>}
                      {g.zoneIds.length>0&&<span>⬡ {g.zoneIds.length} zone</span>}
                      {g.puntiIds.length>0&&<span>📍 {g.puntiIds.length} punti</span>}
                      {g.routeIds.length+g.zoneIds.length+g.puntiIds.length===0&&<span style={{color:T.textDim}}>Vuoto</span>}
                    </div>
                    <button onClick={()=>deleteGruppo(g.id)} style={{width:"100%",background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>
                  </div>
                ))}
              </>
            )}

            {/* ── nuovo gruppo form ── */}
            {percorsiViewMode==="gruppi"&&editingGruppo&&(
              <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Nuovo gruppo</div>
                <div style={{marginBottom:11}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Nome</div>
                  <input value={gruppoCfg.name} onChange={e=>setGruppoCfg(c=>({...c,name:e.target.value}))}
                    style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Colore</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {["#60a5fa","#4ade80","#fb923c","#f87171","#c084fc","#facc15","#34d399","#f9a8d4"].map(c=>(
                      <div key={c} onClick={()=>setGruppoCfg(g=>({...g,color:c}))}
                        style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,border:gruppoCfg.color===c?"3px solid #fff":"2px solid transparent",boxShadow:gruppoCfg.color===c?"0 0 0 1px #000":"none"}}/>
                    ))}
                  </div>
                </div>
                {(routes&&routes.length>0)&&(
                  <div style={{marginBottom:11}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Percorsi</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {routes.map(r=>(
                        <label key={r.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.routeIds.includes(r.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.routeIds.includes(r.id)} onChange={()=>toggleGruppoItem("routeIds",r.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:8,height:8,borderRadius:"50%",background:r.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{r.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {zones.length>0&&(
                  <div style={{marginBottom:11}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Zone</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {zones.map(z=>(
                        <label key={z.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.zoneIds.includes(z.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.zoneIds.includes(z.id)} onChange={()=>toggleGruppoItem("zoneIds",z.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:10,height:10,background:z.fillColor,border:`1px solid ${z.borderColor}`,borderRadius:z.type==="circle"?"50%":"2px",flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{z.name||z.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {punti.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Punti</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {punti.map(p=>(
                        <label key={p.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.puntiIds.includes(p.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.puntiIds.includes(p.id)} onChange={()=>toggleGruppoItem("puntiIds",p.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{p.nome||"—"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveGruppo} disabled={!gruppoCfg.name.trim()}
                    style={{flex:1,background:!gruppoCfg.name.trim()?T.bg:T.navActive,border:`1px solid ${!gruppoCfg.name.trim()?T.border:T.blue+"66"}`,borderRadius:6,color:!gruppoCfg.name.trim()?T.textDim:T.blue,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                    Salva
                  </button>
                  <button onClick={()=>{setEditingGruppo(false);setGruppoCfg(EMPTY_GRUPPO_CFG);}}
                    style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EDITOR ZONE: list / gruppi ── */}
        {tab==="zone"&&!editingZone&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            {/* view toggle */}
            <div style={{display:"flex",gap:3,background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:3,flexShrink:0}}>
              {[["items","Zone"],["gruppi","Gruppi"]].map(([mode,label])=>(
                <button key={mode} onClick={()=>{setZoneViewMode(mode);setEditingGruppo(false);setGruppoCfg(EMPTY_GRUPPO_CFG);}}
                  style={{flex:1,padding:"5px",borderRadius:6,border:"none",background:zoneViewMode===mode?T.card:"transparent",color:zoneViewMode===mode?T.text:T.textSub,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:zoneViewMode===mode?700:400}}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── zone list ── */}
            {zoneViewMode==="items"&&(
              <>
                {zones.length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:20}}>Nessuna zona</div>}
                {zones.map(z=>(
                  <div key={z.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{width:13,height:13,borderRadius:z.type==="circle"?"50%":"2px",background:z.fillColor,opacity:Math.max(z.fillOpacity,0.5),border:`2px solid ${z.borderColor}`,flexShrink:0,clipPath:z.type==="triangle"?"polygon(50% 0%,0% 100%,100% 100%)":z.type==="parallelogram"?"polygon(25% 0%,100% 0%,75% 100%,0% 100%)":undefined}}/>
                      <span style={{fontSize:13,fontWeight:600,color:T.text,flex:1}}>{z.name||"—"}</span>
                      <span style={{fontSize:9,color:T.textDim,background:T.bg,padding:"2px 6px",borderRadius:4}}>{z.type==="circle"?`${Math.round(z.radius)}m`:z.type}</span>
                    </div>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:10}}>{[z.comune,z.materiale,z.sector].filter(Boolean).join(" · ")||"—"}</div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>deleteZone(z.id)} style={{flex:1,background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ── gruppi list ── */}
            {zoneViewMode==="gruppi"&&!editingGruppo&&(
              <>
                <button onClick={()=>setEditingGruppo(true)} style={{padding:"7px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,flexShrink:0}}>+ Nuovo gruppo</button>
                {gruppi.length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:12}}>Nessun gruppo</div>}
                {gruppi.map(g=>(
                  <div key={g.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:T.text,flex:1}}>{g.name}</span>
                    </div>
                    <div style={{display:"flex",gap:10,marginBottom:10,fontSize:10,color:T.textSub,flexWrap:"wrap"}}>
                      {g.routeIds.length>0&&<span>🛣 {g.routeIds.length} percorsi</span>}
                      {g.zoneIds.length>0&&<span>⬡ {g.zoneIds.length} zone</span>}
                      {g.puntiIds.length>0&&<span>📍 {g.puntiIds.length} punti</span>}
                      {g.routeIds.length+g.zoneIds.length+g.puntiIds.length===0&&<span style={{color:T.textDim}}>Vuoto</span>}
                    </div>
                    <button onClick={()=>deleteGruppo(g.id)} style={{width:"100%",background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>
                  </div>
                ))}
              </>
            )}

            {/* ── nuovo gruppo form ── */}
            {zoneViewMode==="gruppi"&&editingGruppo&&(
              <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Nuovo gruppo</div>
                <div style={{marginBottom:11}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Nome</div>
                  <input value={gruppoCfg.name} onChange={e=>setGruppoCfg(c=>({...c,name:e.target.value}))}
                    style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Colore</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {["#60a5fa","#4ade80","#fb923c","#f87171","#c084fc","#facc15","#34d399","#f9a8d4"].map(c=>(
                      <div key={c} onClick={()=>setGruppoCfg(g=>({...g,color:c}))}
                        style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,border:gruppoCfg.color===c?"3px solid #fff":"2px solid transparent",boxShadow:gruppoCfg.color===c?"0 0 0 1px #000":"none"}}/>
                    ))}
                  </div>
                </div>
                {(routes&&routes.length>0)&&(
                  <div style={{marginBottom:11}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Percorsi</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {routes.map(r=>(
                        <label key={r.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.routeIds.includes(r.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.routeIds.includes(r.id)} onChange={()=>toggleGruppoItem("routeIds",r.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:8,height:8,borderRadius:"50%",background:r.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{r.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {zones.length>0&&(
                  <div style={{marginBottom:11}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Zone</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {zones.map(z=>(
                        <label key={z.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.zoneIds.includes(z.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.zoneIds.includes(z.id)} onChange={()=>toggleGruppoItem("zoneIds",z.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:10,height:10,background:z.fillColor,border:`1px solid ${z.borderColor}`,borderRadius:z.type==="circle"?"50%":"2px",flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{z.name||z.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {punti.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Punti</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {punti.map(p=>(
                        <label key={p.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.puntiIds.includes(p.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.puntiIds.includes(p.id)} onChange={()=>toggleGruppoItem("puntiIds",p.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{p.nome||"—"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveGruppo} disabled={!gruppoCfg.name.trim()}
                    style={{flex:1,background:!gruppoCfg.name.trim()?T.bg:T.navActive,border:`1px solid ${!gruppoCfg.name.trim()?T.border:T.blue+"66"}`,borderRadius:6,color:!gruppoCfg.name.trim()?T.textDim:T.blue,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                    Salva
                  </button>
                  <button onClick={()=>{setEditingGruppo(false);setGruppoCfg(EMPTY_GRUPPO_CFG);}}
                    style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EDITOR ZONE: form ── */}
        {tab==="zone"&&editingZone&&(
          <div style={{width:264,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Nuova zona</div>
              {[["Nome","name"],["Comune","comune"],["Materiale","materiale"],["Settore","sector"]].map(([lbl,key])=>(
                <div key={key} style={{marginBottom:11}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>{lbl}</div>
                  <input value={zoneCfg[key]||""} onChange={e=>setZoneCfg(c=>({...c,[key]:e.target.value}))} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div style={{marginBottom:11}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6,fontWeight:600}}>Forma</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  {[["circle","○ Cerchio","2 click"],["square","□ Rettangolo","2 click"],["triangle","△ Triangolo","3 click"],["parallelogram","⬡ Quadrilatero","4 click"]].map(([s,label,hint])=>(
                    <button key={s} onClick={()=>setZoneCfg(c=>({...c,type:s}))}
                      style={{padding:"7px 4px",background:zoneCfg.type===s?T.navActive:"transparent",border:`1px solid ${zoneCfg.type===s?T.blue+"66":T.border}`,borderRadius:7,color:zoneCfg.type===s?T.blue:T.textSub,cursor:"pointer",fontSize:10,fontFamily:T.font,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                      <span>{label}</span><span style={{fontSize:8,opacity:0.6,fontWeight:400}}>{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:11}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Riempimento</div>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                    {["#60a5fa","#4ade80","#fb923c","#f87171","#c084fc","#facc15","#34d399","#f9a8d4"].map(c=>(
                      <div key={c} onClick={()=>setZoneCfg(z=>({...z,fillColor:c}))} style={{width:16,height:16,borderRadius:"50%",background:c,cursor:"pointer",border:zoneCfg.fillColor===c?"2px solid #fff":"1px solid transparent",flexShrink:0}}/>
                    ))}
                  </div>
                  <input type="color" value={zoneCfg.fillColor} onChange={e=>setZoneCfg(c=>({...c,fillColor:e.target.value}))} style={{width:"100%",height:28,border:"none",borderRadius:5,cursor:"pointer",background:"none",padding:2}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Bordo</div>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                    {["#3a7bd5","#22c55e","#f97316","#ef4444","#a855f7","#eab308","#10b981","#ec4899"].map(c=>(
                      <div key={c} onClick={()=>setZoneCfg(z=>({...z,borderColor:c}))} style={{width:16,height:16,borderRadius:"50%",background:c,cursor:"pointer",border:zoneCfg.borderColor===c?"2px solid #fff":"1px solid transparent",flexShrink:0}}/>
                    ))}
                  </div>
                  <input type="color" value={zoneCfg.borderColor} onChange={e=>setZoneCfg(c=>({...c,borderColor:e.target.value}))} style={{width:"100%",height:28,border:"none",borderRadius:5,cursor:"pointer",background:"none",padding:2}}/>
                </div>
              </div>
              <div style={{marginBottom:11}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Trasparenza: {Math.round(zoneCfg.fillOpacity*100)}%</div>
                <input type="range" min={0} max={100} step={5} value={Math.round(zoneCfg.fillOpacity*100)}
                  onChange={e=>setZoneCfg(c=>({...c,fillOpacity:Number(e.target.value)/100}))}
                  style={{width:"100%",accentColor:zoneCfg.fillColor}}/>
              </div>
              <div style={{marginBottom:12,height:20,borderRadius:5,background:zoneCfg.fillColor,opacity:Math.max(zoneCfg.fillOpacity,0.05),border:`2px solid ${zoneCfg.borderColor}`}}/>
              <div style={{fontSize:10,color:T.textDim,marginBottom:12,padding:"7px 10px",background:T.bg,borderRadius:6,border:`1px solid ${T.border}`,lineHeight:1.5}}>
                {{circle:"Click 1=centro · Click 2=bordo",square:"Click 1=angolo A · Click 2=angolo B",triangle:"3 click per i vertici",parallelogram:"4 click per i vertici"}[zoneCfg.type]}
              </div>
              <div style={{display:"flex",gap:8}}>
                {!drawingZone
                  ?<button onClick={()=>setDrawingZone(true)} style={{flex:1,padding:"9px",background:T.navActive,border:`1px solid ${T.blue+"66"}`,borderRadius:6,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Disegna</button>
                  :<button onClick={cancelZoneDraw} style={{background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"9px 14px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>✕</button>
                }
                <button onClick={cancelZoneDraw} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>Annulla</button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR PUNTI: list / gruppi ── */}
        {tab==="punti"&&!editingPunto&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            {/* view toggle */}
            <div style={{display:"flex",gap:3,background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:3,flexShrink:0}}>
              {[["items","Punti"],["gruppi","Gruppi"]].map(([mode,label])=>(
                <button key={mode} onClick={()=>{setPuntiViewMode(mode);setEditingGruppo(false);setGruppoCfg(EMPTY_GRUPPO_CFG);}}
                  style={{flex:1,padding:"5px",borderRadius:6,border:"none",background:puntiViewMode===mode?T.card:"transparent",color:puntiViewMode===mode?T.text:T.textSub,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:puntiViewMode===mode?700:400}}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── punti list ── */}
            {puntiViewMode==="items"&&(
              <>
                {punti.length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:20}}>Nessun punto</div>}
                {punti.map(p=>(
                  <div key={p.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{width:11,height:11,borderRadius:"50%",background:p.color,flexShrink:0,border:"2px solid #fff",boxShadow:`0 0 0 1px ${p.color}`}}/>
                      <span style={{fontSize:13,fontWeight:600,color:T.text,flex:1}}>{p.nome||"—"}</span>
                    </div>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:4}}>{[p.comune,p.materiale,p.sector].filter(Boolean).join(" · ")||"—"}</div>
                    <div style={{fontSize:9,color:T.textDim,marginBottom:10,fontFamily:T.mono}}>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</div>
                    <button onClick={()=>deletePunto(p.id)} style={{width:"100%",background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>
                  </div>
                ))}
              </>
            )}

            {/* ── gruppi list ── */}
            {puntiViewMode==="gruppi"&&!editingGruppo&&(
              <>
                <button onClick={()=>setEditingGruppo(true)} style={{padding:"7px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600,flexShrink:0}}>+ Nuovo gruppo</button>
                {gruppi.length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:12}}>Nessun gruppo</div>}
                {gruppi.map(g=>(
                  <div key={g.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:700,color:T.text,flex:1}}>{g.name}</span>
                    </div>
                    <div style={{display:"flex",gap:10,marginBottom:10,fontSize:10,color:T.textSub,flexWrap:"wrap"}}>
                      {g.routeIds.length>0&&<span>🛣 {g.routeIds.length} percorsi</span>}
                      {g.zoneIds.length>0&&<span>⬡ {g.zoneIds.length} zone</span>}
                      {g.puntiIds.length>0&&<span>📍 {g.puntiIds.length} punti</span>}
                      {g.routeIds.length+g.zoneIds.length+g.puntiIds.length===0&&<span style={{color:T.textDim}}>Vuoto</span>}
                    </div>
                    <button onClick={()=>deleteGruppo(g.id)} style={{width:"100%",background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>
                  </div>
                ))}
              </>
            )}

            {/* ── nuovo gruppo form ── */}
            {puntiViewMode==="gruppi"&&editingGruppo&&(
              <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Nuovo gruppo</div>
                <div style={{marginBottom:11}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Nome</div>
                  <input value={gruppoCfg.name} onChange={e=>setGruppoCfg(c=>({...c,name:e.target.value}))}
                    style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Colore</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {["#60a5fa","#4ade80","#fb923c","#f87171","#c084fc","#facc15","#34d399","#f9a8d4"].map(c=>(
                      <div key={c} onClick={()=>setGruppoCfg(g=>({...g,color:c}))}
                        style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,border:gruppoCfg.color===c?"3px solid #fff":"2px solid transparent",boxShadow:gruppoCfg.color===c?"0 0 0 1px #000":"none"}}/>
                    ))}
                  </div>
                </div>
                {(routes&&routes.length>0)&&(
                  <div style={{marginBottom:11}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Percorsi</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {routes.map(r=>(
                        <label key={r.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.routeIds.includes(r.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.routeIds.includes(r.id)} onChange={()=>toggleGruppoItem("routeIds",r.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:8,height:8,borderRadius:"50%",background:r.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{r.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {zones.length>0&&(
                  <div style={{marginBottom:11}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Zone</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {zones.map(z=>(
                        <label key={z.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.zoneIds.includes(z.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.zoneIds.includes(z.id)} onChange={()=>toggleGruppoItem("zoneIds",z.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:10,height:10,background:z.fillColor,border:`1px solid ${z.borderColor}`,borderRadius:z.type==="circle"?"50%":"2px",flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{z.name||z.type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {punti.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:T.textSub,marginBottom:5,fontWeight:600}}>Punti</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:90,overflowY:"auto"}}>
                      {punti.map(p=>(
                        <label key={p.id} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:gruppoCfg.puntiIds.includes(p.id)?T.navActive:"transparent"}}>
                          <input type="checkbox" checked={gruppoCfg.puntiIds.includes(p.id)} onChange={()=>toggleGruppoItem("puntiIds",p.id)} style={{accentColor:T.blue}}/>
                          <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                          <span style={{fontSize:11,color:T.text}}>{p.nome||"—"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveGruppo} disabled={!gruppoCfg.name.trim()}
                    style={{flex:1,background:!gruppoCfg.name.trim()?T.bg:T.navActive,border:`1px solid ${!gruppoCfg.name.trim()?T.border:T.blue+"66"}`,borderRadius:6,color:!gruppoCfg.name.trim()?T.textDim:T.blue,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                    Salva
                  </button>
                  <button onClick={()=>{setEditingGruppo(false);setGruppoCfg(EMPTY_GRUPPO_CFG);}}
                    style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EDITOR PUNTI: form ── */}
        {tab==="punti"&&editingPunto&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>Nuovo punto</div>
              {[["Nome","nome"],["Comune","comune"],["Materiale","materiale"],["Settore","sector"]].map(([lbl,key])=>(
                <div key={key} style={{marginBottom:11}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>{lbl}</div>
                  <input value={puntoCfg[key]||""} onChange={e=>setPuntoCfg(c=>({...c,[key]:e.target.value}))} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"7px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6,fontWeight:600}}>Colore</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
                  {["#f87171","#fb923c","#facc15","#4ade80","#34d399","#60a5fa","#c084fc","#f9a8d4"].map(c=>(
                    <div key={c} onClick={()=>setPuntoCfg(p=>({...p,color:c}))}
                      style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",flexShrink:0,border:puntoCfg.color===c?"3px solid #fff":"2px solid transparent",boxShadow:puntoCfg.color===c?"0 0 0 1px #000":"none"}}/>
                  ))}
                </div>
                <input type="color" value={puntoCfg.color} onChange={e=>setPuntoCfg(c=>({...c,color:e.target.value}))}
                  style={{width:"100%",height:30,border:"none",borderRadius:5,cursor:"pointer",background:"none",padding:2}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"9px 12px",background:T.bg,borderRadius:7,border:`1px solid ${T.border}`}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:puntoCfg.color,border:"2px solid #fff",boxShadow:"0 2px 6px rgba(0,0,0,0.4)",flexShrink:0}}/>
                <div>
                  <div style={{fontSize:12,color:T.text,fontWeight:600}}>{puntoCfg.nome||"(senza nome)"}</div>
                  {(puntoCfg.comune||puntoCfg.materiale)&&<div style={{fontSize:10,color:T.textDim}}>{[puntoCfg.comune,puntoCfg.materiale].filter(Boolean).join(" · ")}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {!drawingPunti
                  ?<button onClick={()=>setDrawingPunti(true)} style={{flex:1,padding:"9px",background:T.navActive,border:`1px solid ${T.blue+"66"}`,borderRadius:6,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Aggiungi</button>
                  :<button onClick={()=>setDrawingPunti(false)} style={{flex:1,padding:"9px",background:"#0d2010",border:`1px solid ${T.green+"55"}`,borderRadius:6,color:T.green,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>✓ Fine</button>
                }
                <button onClick={cancelPuntoEdit} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>Chiudi</button>
              </div>
            </div>
          </div>
        )}

        {/* ── CDR: list ── */}
        {tab==="cdr"&&!editingCdr&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            {cdr.length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:20}}>Nessun centro di raccolta</div>}
            {cdr.map(c=>(
              <div key={c.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:600,color:T.text,flex:1}}>{c.name}</span>
                  <span style={{fontSize:9,color:T.textDim,background:T.bg,padding:"2px 6px",borderRadius:4}}>{(c.shapes||[]).length} forme</span>
                </div>
                <div style={{fontSize:11,color:T.textSub,marginBottom:4}}>{[c.comune,c.materiale,c.sector].filter(Boolean).join(" · ")||"—"}</div>
                {c.address&&<div style={{fontSize:10,color:c.lat&&c.lng?T.green:T.textDim,marginBottom:8,display:"flex",alignItems:"center",gap:4}}><span>{c.lat&&c.lng?"📍":"⚠"}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address}</span></div>}
                <div style={{display:"flex",gap:6}}>
                  {canEdit&&<button onClick={()=>editCdrItem(c)} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Modifica</button>}
                  {canEdit&&<button onClick={()=>deleteCdr(c.id)} style={{background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CDR: form ── */}
        {tab==="cdr"&&editingCdr&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flexShrink:0}}>
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:16}}>{editingCdr==="new"?"Nuovo Centro":"Modifica Centro"}</div>
              {[["Nome","name"],["Comune","comune"],["Materiale","materiale"],["Settore","sector"]].map(([lbl,key])=>(
                <div key={key} style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>{lbl}</div>
                  <input value={cdrMeta[key]||""} onChange={e=>setCdrMeta(m=>({...m,[key]:e.target.value}))}
                    style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              {/* ── Address + geocoding ── */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Indirizzo (per mappa)</div>
                <div style={{display:"flex",gap:6}}>
                  <input value={cdrMeta.address||""} placeholder="Via, numero, città..."
                    onChange={e=>setCdrMeta(m=>({...m,address:e.target.value,lat:null,lng:null}))}
                    onKeyDown={e=>e.key==="Enter"&&geocodeCdrAddress()}
                    style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
                  <button onClick={()=>geocodeCdrAddress()} disabled={cdrGeoLoading||!cdrMeta.address?.trim()}
                    title="Geolocalizza indirizzo"
                    style={{padding:"8px 10px",background:T.navActive,border:`1px solid ${T.blue}44`,borderRadius:6,color:cdrGeoLoading?T.textDim:T.blue,cursor:cdrGeoLoading?"wait":"pointer",fontSize:13,fontFamily:T.font,flexShrink:0}}>
                    {cdrGeoLoading?"…":"📍"}
                  </button>
                </div>
                {cdrMeta.lat&&cdrMeta.lng
                  ?<div style={{fontSize:10,color:T.green,marginTop:4,fontFamily:T.mono}}>✓ {cdrMeta.lat.toFixed(5)}, {cdrMeta.lng.toFixed(5)}</div>
                  :<div style={{fontSize:10,color:T.textDim,marginTop:4}}>Inserisci l'indirizzo e premi 📍 per posizionarlo sulla mappa</div>}
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6,fontWeight:600}}>Colore</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {["#4ade80","#60a5fa","#fb923c","#c084fc","#f9a8d4","#facc15","#f87171","#34d399"].map(c=>(
                    <div key={c} onClick={()=>setCdrMeta(m=>({...m,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,border:cdrMeta.color===c?"3px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0,boxShadow:cdrMeta.color===c?"0 0 0 1px #000":"none"}}/>
                  ))}
                </div>
                <input type="color" value={cdrMeta.color} onChange={e=>setCdrMeta(m=>({...m,color:e.target.value}))}
                  style={{width:"100%",height:32,border:"none",borderRadius:6,cursor:"pointer",background:"none",padding:2}}/>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Trasparenza: {Math.round((cdrMeta.opacity??0.5)*100)}%</div>
                <input type="range" min={5} max={100} step={5} value={Math.round((cdrMeta.opacity??0.5)*100)}
                  onChange={e=>setCdrMeta(m=>({...m,opacity:Number(e.target.value)/100}))}
                  style={{width:"100%",accentColor:cdrMeta.color}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.textDim,marginTop:2}}><span>Trasparente</span><span>Pieno</span></div>
              </div>
              <div style={{fontSize:11,color:T.textSub,marginBottom:14,padding:"10px 12px",background:T.bg,borderRadius:6,border:`1px solid ${T.border}`}}>
                {cdrShapes.length} forme nel canvas
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveCdr} disabled={!cdrMeta.name.trim()}
                  style={{flex:1,background:!cdrMeta.name.trim()?T.bg:T.navActive,border:`1px solid ${!cdrMeta.name.trim()?T.border:T.blue+"66"}`,borderRadius:6,color:!cdrMeta.name.trim()?T.textDim:T.blue,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                  Salva
                </button>
                <button onClick={cancelCdrEdit} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>Annulla</button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR PERCORSI with editing form ── */}
        {tab==="editor"&&editingId&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:16}}>{editingId==="new"?"Nuovo percorso":"Modifica percorso"}</div>
              {[["Nome","name"],["Comune","comune"],["Materiale","materiale"],["Settore","sector"]].map(([lbl,key])=>(
                <div key={key} style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>{lbl}</div>
                  <input value={meta[key]||""} onChange={e=>setMeta(m=>({...m,[key]:e.target.value}))} style={inp}/>
                </div>
              ))}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6,fontWeight:600}}>Colore percorso</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {["#4ade80","#60a5fa","#fb923c","#c084fc","#f9a8d4","#facc15","#f87171","#34d399"].map(c=>(
                    <div key={c} onClick={()=>setMeta(m=>({...m,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,border:meta.color===c?"3px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0,boxShadow:meta.color===c?"0 0 0 1px #000":"none"}}/>
                  ))}
                </div>
                <input type="color" value={meta.color} onChange={e=>setMeta(m=>({...m,color:e.target.value}))}
                  style={{width:"100%",height:32,border:"none",borderRadius:6,cursor:"pointer",background:"none",padding:2}}/>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Trasparenza: {Math.round((meta.opacity??0.85)*100)}%</div>
                <input type="range" min={10} max={100} step={5} value={Math.round((meta.opacity??0.85)*100)}
                  onChange={e=>setMeta(m=>({...m,opacity:Number(e.target.value)/100}))}
                  style={{width:"100%",accentColor:meta.color}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.textDim,marginTop:2}}><span>Trasparente</span><span>Pieno</span></div>
              </div>
              <div style={{fontSize:11,color:T.textSub,marginBottom:14,padding:"10px 12px",background:T.bg,borderRadius:6,border:`1px solid ${T.border}`}}>
                {editWaypoints.length} punti tracciati<br/><span style={{fontSize:10,color:T.textDim}}>Min. 2 punti per salvare</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveRoute} disabled={saving||!meta.name.trim()||editWaypoints.length<2}
                  style={{flex:1,background:!meta.name.trim()||editWaypoints.length<2?T.bg:T.navActive,border:`1px solid ${!meta.name.trim()||editWaypoints.length<2?T.border:T.blue+"66"}`,borderRadius:6,color:!meta.name.trim()||editWaypoints.length<2?T.textDim:T.blue,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                  {saving?"Salvataggio...":"Salva"}
                </button>
                <button onClick={cancelEdit} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textSub,padding:"9px",cursor:"pointer",fontSize:13,fontFamily:T.font}}>Annulla</button>
              </div>
              {/* Annotations section */}
              <div style={{marginTop:14,borderTop:`1px solid ${T.border}`,paddingTop:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.text}}>📌 Annotazioni ({editAnnotations.length})</div>
                  <button onClick={()=>{setAnnotMode(m=>!m);setAnnotEditId(null);}}
                    style={{padding:"4px 10px",background:annotMode?"#0d2010":T.bg,border:`1px solid ${annotMode?T.green+"66":T.border}`,borderRadius:6,color:annotMode?T.green:T.textSub,cursor:"pointer",fontSize:11,fontFamily:T.font,fontWeight:600}}>
                    {annotMode?"✓ Clicca mappa":"+ Annota"}
                  </button>
                </div>
                {editAnnotations.length===0&&<div style={{fontSize:11,color:T.textDim,textAlign:"center",padding:"8px 0"}}>Nessuna annotazione</div>}
                {editAnnotations.map(a=>(
                  <div key={a.id} style={{background:T.bg,border:`1px solid ${annotEditId===a.id?a.color:T.border}`,borderRadius:7,padding:"8px 10px",marginBottom:6}}>
                    {annotEditId===a.id?(
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        <input autoFocus value={a.text} onChange={e=>setEditAnnotations(prev=>prev.map(x=>x.id===a.id?{...x,text:e.target.value}:x))}
                          placeholder="Testo annotazione…"
                          style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:5,color:T.text,padding:"5px 8px",fontSize:12,fontFamily:T.font,outline:"none"}}/>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {["#facc15","#4ade80","#60a5fa","#f87171","#fb923c","#c084fc","#ffffff"].map(c=>(
                            <div key={c} onClick={()=>setEditAnnotations(prev=>prev.map(x=>x.id===a.id?{...x,color:c}:x))}
                              style={{width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",border:a.color===c?"2.5px solid #fff":"2px solid transparent",flexShrink:0}}/>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>setAnnotEditId(null)} style={{flex:1,padding:"4px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:5,color:T.blue,cursor:"pointer",fontSize:11,fontWeight:600}}>✓ OK</button>
                          <button onClick={()=>setEditAnnotations(prev=>prev.filter(x=>x.id!==a.id))} style={{padding:"4px 8px",background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:5,color:T.red,cursor:"pointer",fontSize:11}}>Elimina</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer"}} onClick={()=>setAnnotEditId(a.id)}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:a.color,flexShrink:0,border:"1.5px solid rgba(255,255,255,0.4)"}}/>
                        <span style={{fontSize:12,color:T.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.text||"(senza testo)"}</span>
                        <span style={{fontSize:10,color:T.textDim,flexShrink:0}}>✏</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Excel unrecognized popup ── */}
      {excelPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setExcelPopup(null)}>
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:24,minWidth:380,maxWidth:520,maxHeight:"70vh",display:"flex",flexDirection:"column",gap:12,fontFamily:T.font}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.yellow}}>⚠ Indirizzi non geocodificati</div>
              <button onClick={()=>setExcelPopup(null)} style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
            </div>
            <div style={{fontSize:12,color:T.textSub}}>I seguenti indirizzi non sono stati trovati su Nominatim e sono stati saltati:</div>
            <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
              {excelPopup.map((u,i)=>(
                <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px"}}>
                  <div style={{fontSize:13,color:T.text,fontWeight:600}}>{u.address}</div>
                  <div style={{fontSize:11,color:T.red,marginTop:2}}>{u.reason}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setExcelPopup(null)} style={{marginTop:4,padding:"8px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:7,color:T.blue,cursor:"pointer",fontSize:13,fontWeight:600}}>Chiudi</button>
          </div>
        </div>
      )}
      {snapPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSnapPopup(null)}>
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:24,minWidth:360,maxWidth:480,fontFamily:T.font}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:T.orange}}>⚠ Segmenti non agganciati alla strada</div>
              <button onClick={()=>setSnapPopup(null)} style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",fontSize:18}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:"50vh",overflowY:"auto"}}>
              {snapPopup.map((u,i)=>(
                <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px"}}>
                  <div style={{fontSize:13,color:T.text}}>{typeof u==="string"?u:u.address}</div>
                  {u.reason&&<div style={{fontSize:11,color:T.orange,marginTop:2}}>{u.reason}</div>}
                </div>
              ))}
            </div>
            <button onClick={()=>setSnapPopup(null)} style={{marginTop:12,width:"100%",padding:"8px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:7,color:T.blue,cursor:"pointer",fontSize:13,fontWeight:600}}>Chiudi</button>
          </div>
        </div>
      )}
      {showCamera&&<LiveCamera position={myPos} auth={auth} onClose={()=>setShowCamera(false)}/>}
    </div>
  );
}

// ─── CDR PALETTE PRESETS ──────────────────────────────────────────────────────
const CDR_PALETTE={
  zone:[
    {id:"zona_vetro",      label:"Vetro",           type:"rect",   w:140,h:90,  fill:"#0d2035",stroke:"#60a5fa",cr:0},
    {id:"zona_carta",      label:"Carta / Cartone", type:"rect",   w:160,h:90,  fill:"#0d1f0d",stroke:"#4ade80",cr:0},
    {id:"zona_raee",       label:"RAEE",            type:"rect",   w:140,h:90,  fill:"#1f1005",stroke:"#fb923c",cr:0},
    {id:"zona_plastica",   label:"Plastica",        type:"rect",   w:140,h:90,  fill:"#1f1f05",stroke:"#facc15",cr:0},
    {id:"zona_metalli",    label:"Metalli",         type:"rect",   w:140,h:90,  fill:"#101018",stroke:"#94a3b8",cr:0},
    {id:"zona_legno",      label:"Legno",           type:"rect",   w:140,h:90,  fill:"#1a1005",stroke:"#d97706",cr:0},
    {id:"zona_ingombranti",label:"Ingombranti",     type:"rect",   w:170,h:90,  fill:"#141414",stroke:"#6b7280",cr:0},
    {id:"zona_oli",        label:"Oli / Vernici",   type:"rect",   w:130,h:90,  fill:"#120a20",stroke:"#a78bfa",cr:0},
    {id:"zona_verde",      label:"Verde / Organico",type:"rect",   w:170,h:90,  fill:"#071407",stroke:"#4ade80",cr:0},
    {id:"pesatura",        label:"Area Pesatura",   type:"rect",   w:160,h:60,  fill:"#1a0808",stroke:"#f87171",cr:0},
    {id:"locale_guard",    label:"Guardiano",       type:"rect",   w:110,h:90,  fill:"#07111f",stroke:"#60a5fa",cr:6},
  ],
  contenitori:[
    {id:"campana",         label:"Campana",         type:"ellipse",rx:35,ry:45, fill:"#0d2035",stroke:"#60a5fa"},
    {id:"cassone_basso",   label:"Cassone Basso",   type:"rect",   w:90,h:55,   fill:"#101018",stroke:"#94a3b8",cr:4},
    {id:"cassone_alto",    label:"Cassone Alto",    type:"rect",   w:65,h:100,  fill:"#101018",stroke:"#94a3b8",cr:4},
    {id:"bigbag",          label:"BigBag",          type:"rect",   w:75,h:75,   fill:"#1f1f05",stroke:"#facc15",cr:10},
    {id:"container_c",     label:"Container",       type:"rect",   w:110,h:65,  fill:"#071407",stroke:"#4ade80",cr:4},
  ],
  infrastrutture:[
    {id:"entrata",         label:"↓ ENTRATA",       type:"rect",   w:80,h:50,   fill:"#071407",stroke:"#4ade80",cr:0},
    {id:"uscita",          label:"↑ USCITA",        type:"rect",   w:80,h:50,   fill:"#1a0808",stroke:"#f87171",cr:0},
    {id:"senso_circ",      label:"→ Circolazione",  type:"rect",   w:120,h:40,  fill:"#0f1620",stroke:"#60a5fa",cr:0},
    {id:"pesa",            label:"Pesa / Bilancia", type:"rect",   w:160,h:50,  fill:"#1a0808",stroke:"#f87171",cr:4},
    {id:"ufficio",         label:"Ufficio",         type:"rect",   w:110,h:80,  fill:"#07111f",stroke:"#60a5fa",cr:6},
    {id:"parcheggio",      label:"Parcheggio",      type:"rect",   w:160,h:110, fill:"#0e0e0e",stroke:"#6b7280",cr:0},
  ],
};
const CDR_PAL_TABS=[["zone","Zone"],["contenitori","Contenitori"],["infrastrutture","Infrastrutture"]];
const CDR_SWATCHES=["#60a5fa","#4ade80","#fb923c","#f87171","#facc15","#a78bfa","#94a3b8","#34d399","#d97706","#6b7280","#f472b6","#e2eaf5"];

// ─── CDR CANVAS (Konva.js) ────────────────────────────────────────────────────
function CdrCanvas({shapes,onChange,activeColor,activeOpacity}){
  const containerRef=useRef(null);
  const stageRef=useRef(null);
  const trRef=useRef(null);
  const [size,setSize]=useState({w:800,h:500});
  const [tool,setTool]=useState("select");
  const [selectedId,setSelectedId]=useState(null);
  const [isDrawing,setIsDrawing]=useState(false);
  const [drawStart,setDrawStart]=useState(null);
  const [preview,setPreview]=useState(null);
  const [polyPts,setPolyPts]=useState([]);
  const [textInput,setTextInput]=useState(null);
  const [textVal,setTextVal]=useState("");
  const [paletteOpen,setPaletteOpen]=useState(true);
  const [paletteTab,setPaletteTab]=useState("zone");
  const [labelEditId,setLabelEditId]=useState(null);
  const [labelVal,setLabelVal]=useState("");
  const [labelPos,setLabelPos]=useState({x:0,y:0});

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const ro=new ResizeObserver(entries=>{
      const{width,height}=entries[0].contentRect;
      if(width>10&&height>10)setSize({w:Math.floor(width),h:Math.floor(height)});
    });
    ro.observe(el);return()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    if(!trRef.current||!stageRef.current)return;
    const node=selectedId?stageRef.current.findOne("#"+selectedId):null;
    trRef.current.nodes(node?[node]:[]);
    trRef.current.getLayer()?.batchDraw();
  },[selectedId,shapes]);

  const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const fillC=activeColor+Math.round((activeOpacity??0.5)*255).toString(16).padStart(2,"0");
  const getStagePt=e=>{const st=stageRef.current;st.setPointersPositions(e);return st.getPointerPosition();};

  // ── Stamp a palette preset ──────────────────────────────────────────────────
  const stampShape=(preset)=>{
    const off=(shapes.length%6)*18;
    const cx=size.w/2-((preset.w||preset.rx*2||60)/2)+off;
    const cy=size.h/2-((preset.h||preset.ry*2||60)/2)+off;
    let shape;
    if(preset.type==="rect")
      shape={id:newId(),type:"rect",x:cx,y:cy,width:preset.w,height:preset.h,
             fill:preset.fill,stroke:preset.stroke,strokeWidth:2,label:preset.label,cornerRadius:preset.cr||0};
    else if(preset.type==="ellipse")
      shape={id:newId(),type:"ellipse",x:cx+preset.rx,y:cy+preset.ry,radiusX:preset.rx,radiusY:preset.ry,
             fill:preset.fill,stroke:preset.stroke,strokeWidth:2,label:preset.label};
    if(shape){ onChange([...shapes,shape]); setSelectedId(shape.id); setTool("select"); }
  };

  // ── Z-order ─────────────────────────────────────────────────────────────────
  const moveZ=(id,dir)=>{
    const idx=shapes.findIndex(s=>s.id===id);
    const ns=[...shapes];
    const target=idx+dir;
    if(target<0||target>=ns.length)return;
    [ns[idx],ns[target]]=[ns[target],ns[idx]];
    onChange(ns);
  };

  // ── Free-draw handlers ───────────────────────────────────────────────────────
  const onMouseDown=e=>{
    if(tool==="select"){if(e.target===stageRef.current)setSelectedId(null);return;}
    const pos=getStagePt(e.evt);
    if(tool==="text"){setTextInput(pos);return;}
    if(tool==="polygon"){setPolyPts(p=>[...p,pos.x,pos.y]);return;}
    setDrawStart(pos);setIsDrawing(true);
    const base={id:null,fill:fillC,stroke:activeColor,strokeWidth:2};
    if(tool==="rect")setPreview({...base,type:"rect",x:pos.x,y:pos.y,width:0,height:0,cornerRadius:0});
    if(tool==="ellipse")setPreview({...base,type:"ellipse",x:pos.x,y:pos.y,radiusX:0,radiusY:0});
    if(tool==="line")setPreview({...base,type:"line",points:[pos.x,pos.y,pos.x,pos.y]});
  };
  const onMouseMove=e=>{
    if(!isDrawing||!drawStart)return;
    const pos=getStagePt(e.evt);
    if(tool==="rect")setPreview(p=>({...p,x:Math.min(drawStart.x,pos.x),y:Math.min(drawStart.y,pos.y),width:Math.abs(pos.x-drawStart.x),height:Math.abs(pos.y-drawStart.y)}));
    if(tool==="ellipse")setPreview(p=>({...p,x:(drawStart.x+pos.x)/2,y:(drawStart.y+pos.y)/2,radiusX:Math.abs(pos.x-drawStart.x)/2,radiusY:Math.abs(pos.y-drawStart.y)/2}));
    if(tool==="line")setPreview(p=>({...p,points:[drawStart.x,drawStart.y,pos.x,pos.y]}));
  };
  const onMouseUp=()=>{
    if(!isDrawing||!preview){setIsDrawing(false);return;}
    setIsDrawing(false);
    const ok=(preview.type==="rect"&&preview.width>4&&preview.height>4)||
             (preview.type==="ellipse"&&preview.radiusX>4&&preview.radiusY>4)||
             (preview.type==="line"&&Math.hypot(preview.points[2]-preview.points[0],preview.points[3]-preview.points[1])>4);
    if(ok)onChange([...shapes,{...preview,id:newId()}]);
    setPreview(null);setDrawStart(null);
  };
  const onDblClick=e=>{
    if(tool==="polygon"&&polyPts.length>=6){
      onChange([...shapes,{id:newId(),type:"polygon",points:[...polyPts],fill:fillC,stroke:activeColor,strokeWidth:2,closed:true}]);
      setPolyPts([]);return;
    }
    // Label edit on double-click in select mode
    if(tool==="select"&&selectedId){
      const sh=shapes.find(s=>s.id===selectedId);
      if(!sh||sh.type==="line"||sh.type==="text")return;
      const stage=stageRef.current;
      const node=stage.findOne("#"+selectedId);
      if(!node)return;
      const rect=containerRef.current.getBoundingClientRect();
      const pos=node.getClientRect({relativeTo:stage});
      setLabelEditId(selectedId);
      setLabelVal(sh.label||"");
      setLabelPos({x:pos.x+pos.width/2,y:pos.y+pos.height/2});
    }
  };
  const commitText=()=>{
    if(!textVal.trim()||!textInput)return;
    onChange([...shapes,{id:newId(),type:"text",x:textInput.x,y:textInput.y,text:textVal,fontSize:14,fill:activeColor}]);
    setTextInput(null);setTextVal("");
  };
  const commitLabel=()=>{
    if(labelEditId) updShape(labelEditId,{label:labelVal});
    setLabelEditId(null);setLabelVal("");
  };
  const deleteSelected=()=>{ if(!selectedId)return; onChange(shapes.filter(s=>s.id!==selectedId)); setSelectedId(null); };
  const updShape=(id,attrs)=>onChange(shapes.map(s=>s.id===id?{...s,...attrs}:s));

  const sp=s=>({
    id:s.id,key:s.id,
    draggable:tool==="select",
    onClick:()=>{if(tool==="select")setSelectedId(s.id);},
    onDragEnd:e=>updShape(s.id,{x:e.target.x(),y:e.target.y()}),
    onTransformEnd:e=>{
      const n=e.target;
      if(s.type==="rect")updShape(s.id,{x:n.x(),y:n.y(),width:Math.max(5,n.width()*n.scaleX()),height:Math.max(5,n.height()*n.scaleY()),rotation:n.rotation()});
      if(s.type==="ellipse")updShape(s.id,{x:n.x(),y:n.y(),radiusX:Math.max(5,n.radiusX()*n.scaleX()),radiusY:Math.max(5,n.radiusY()*n.scaleY()),rotation:n.rotation()});
      n.scaleX(1);n.scaleY(1);
    },
  });

  const DRAW_TOOLS=[["select","↖","Seleziona"],["rect","▭","Rettangolo"],["ellipse","⬭","Ellisse"],["polygon","⬡","Poligono"],["line","╲","Linea"],["text","T","Testo"]];
  const GRID=40;
  const gridLines=[];
  for(let x=0;x<=size.w;x+=GRID)gridLines.push(<KonvaLine key={"gv"+x} points={[x,0,x,size.h]} stroke="#ffffff07" strokeWidth={1} listening={false}/>);
  for(let y=0;y<=size.h;y+=GRID)gridLines.push(<KonvaLine key={"gh"+y} points={[0,y,size.w,y]} stroke="#ffffff07" strokeWidth={1} listening={false}/>);

  const selectedShape=shapes.find(s=>s.id===selectedId);
  const btnBase={padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:T.font,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub};
  const btnActive={...btnBase,border:`1px solid ${T.blue}66`,background:T.navActive,color:T.blue,fontWeight:700};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* ── MAIN TOOLBAR ── */}
      <div style={{display:"flex",gap:4,padding:"7px 10px",borderBottom:`1px solid ${T.border}`,background:T.card,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
        {/* Draw tools */}
        {DRAW_TOOLS.map(([t,icon,lbl])=>(
          <button key={t} title={lbl} onClick={()=>{setTool(t);setPolyPts([]);setTextInput(null);setTextVal("");}}
            style={tool===t?btnActive:btnBase}>
            {icon} {lbl}
          </button>
        ))}
        <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
        {/* Palette toggle */}
        <button onClick={()=>setPaletteOpen(v=>!v)}
          style={paletteOpen?{...btnBase,border:`1px solid ${T.green}66`,background:"#0a1a0a",color:T.green,fontWeight:700}:btnBase}>
          🏗 Palette {paletteOpen?"▲":"▼"}
        </button>
        {/* Polygon hint */}
        {tool==="polygon"&&<span style={{fontSize:10,color:T.textSub,marginLeft:4}}>{polyPts.length<6?"≥3 click · ":""}Dbl-click per chiudere</span>}

        {/* Selected shape controls */}
        {selectedShape&&(
          <>
            <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
            {/* Z-order */}
            <button title="Porta avanti" onClick={()=>moveZ(selectedId,1)} style={btnBase}>⬆ Livello</button>
            <button title="Porta indietro" onClick={()=>moveZ(selectedId,-1)} style={btnBase}>⬇ Livello</button>
            <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
            {/* Color swatches */}
            {CDR_SWATCHES.map(c=>(
              <button key={c} title={c} onClick={()=>updShape(selectedId,{stroke:c,fill:c+"22"})}
                style={{width:16,height:16,borderRadius:3,background:c,border:selectedShape.stroke===c?`2px solid #fff`:`1px solid ${c}44`,cursor:"pointer",padding:0,flexShrink:0}}/>
            ))}
            <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
            <button onClick={deleteSelected} style={{...btnBase,border:"1px solid #3a1a1a",background:"#1a0808",color:T.red}}>✕ Elimina</button>
          </>
        )}
        <button onClick={()=>{if(window.confirm("Cancellare tutte le forme?")){onChange([]);setSelectedId(null);}}}
          style={{...btnBase,marginLeft:"auto"}}>🗑 Tutto</button>
      </div>

      {/* ── PALETTE PANEL ── */}
      {paletteOpen&&(
        <div style={{background:"#0b1524",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          {/* Tab bar */}
          <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}22`}}>
            {CDR_PAL_TABS.map(([id,lbl])=>(
              <button key={id} onClick={()=>setPaletteTab(id)}
                style={{padding:"6px 16px",fontSize:11,fontWeight:paletteTab===id?700:400,fontFamily:T.font,cursor:"pointer",border:"none",borderBottom:paletteTab===id?`2px solid ${T.blue}`:"2px solid transparent",background:"transparent",color:paletteTab===id?T.blue:T.textSub,transition:"color 0.1s"}}>
                {lbl}
              </button>
            ))}
          </div>
          {/* Items */}
          <div style={{display:"flex",gap:6,padding:"8px 10px",overflowX:"auto",flexWrap:"wrap"}}>
            {(CDR_PALETTE[paletteTab]||[]).map(preset=>(
              <button key={preset.id} onClick={()=>stampShape(preset)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 10px",borderRadius:8,cursor:"pointer",fontFamily:T.font,border:`1px solid ${preset.stroke}44`,background:preset.fill,color:preset.stroke,minWidth:72,transition:"all 0.15s",flexShrink:0}}
                onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${preset.stroke}`;e.currentTarget.style.boxShadow=`0 0 8px ${preset.stroke}44`;}}
                onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${preset.stroke}44`;e.currentTarget.style.boxShadow="none";}}>
                {/* Shape mini-preview */}
                <div style={{width:preset.type==="ellipse"?24:32,height:preset.type==="ellipse"?30:preset.h>80?30:20,borderRadius:preset.type==="ellipse"?"50%":(preset.cr||0),border:`2px solid ${preset.stroke}`,background:preset.stroke+"22",flexShrink:0}}/>
                <span style={{fontSize:9,textAlign:"center",whiteSpace:"nowrap",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",fontWeight:600,letterSpacing:0.2}}>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CANVAS STAGE ── */}
      <div ref={containerRef} style={{flex:1,overflow:"hidden",position:"relative",cursor:tool==="select"?"default":"crosshair"}}>
        <Stage ref={stageRef} width={size.w} height={size.h}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onDblClick={onDblClick}
          style={{background:"#0e1822"}}>
          <Layer>
            {gridLines}
            {shapes.map(s=>{
              const p=sp(s);
              const hasLabel=s.label&&(s.type==="rect"||s.type==="ellipse");
              if(s.type==="rect") return(
                <React.Fragment key={s.id}>
                  <KonvaRect {...p} x={s.x} y={s.y} width={s.width} height={s.height} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth||2} rotation={s.rotation||0} cornerRadius={s.cornerRadius||0}/>
                  {hasLabel&&<KonvaText x={s.x} y={s.y} width={s.width} height={s.height} text={s.label} align="center" verticalAlign="middle" fontSize={Math.max(9,Math.min(13,s.width/s.label.length*1.3))} fill={s.stroke} rotation={s.rotation||0} listening={false} fontStyle="bold" padding={4}/>}
                </React.Fragment>
              );
              if(s.type==="ellipse") return(
                <React.Fragment key={s.id}>
                  <KonvaEllipse {...p} x={s.x} y={s.y} radiusX={s.radiusX} radiusY={s.radiusY} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth||2} rotation={s.rotation||0}/>
                  {hasLabel&&<KonvaText x={s.x-s.radiusX} y={s.y-s.radiusY} width={s.radiusX*2} height={s.radiusY*2} text={s.label} align="center" verticalAlign="middle" fontSize={Math.max(8,Math.min(11,s.radiusX/s.label.length*1.6))} fill={s.stroke} rotation={s.rotation||0} listening={false} fontStyle="bold" padding={2}/>}
                </React.Fragment>
              );
              if(s.type==="polygon")return<KonvaLine {...p} points={s.points} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth||2} closed={s.closed}/>;
              if(s.type==="line")return<KonvaLine {...p} points={s.points} stroke={s.stroke} strokeWidth={s.strokeWidth||2}/>;
              if(s.type==="text")return<KonvaText {...p} x={s.x} y={s.y} text={s.text} fontSize={s.fontSize||14} fill={s.fill} rotation={s.rotation||0}/>;
              return null;
            })}
            {/* Draw previews */}
            {preview?.type==="rect"&&<KonvaRect x={preview.x} y={preview.y} width={preview.width} height={preview.height} fill={preview.fill} stroke={preview.stroke} strokeWidth={2} opacity={0.6} listening={false} cornerRadius={0}/>}
            {preview?.type==="ellipse"&&<KonvaEllipse x={preview.x} y={preview.y} radiusX={preview.radiusX} radiusY={preview.radiusY} fill={preview.fill} stroke={preview.stroke} strokeWidth={2} opacity={0.6} listening={false}/>}
            {preview?.type==="line"&&<KonvaLine points={preview.points} stroke={preview.stroke} strokeWidth={2} opacity={0.6} listening={false}/>}
            {polyPts.length>=2&&<KonvaLine points={polyPts} stroke={activeColor} strokeWidth={2} dash={[5,3]} listening={false}/>}
            <KonvaTransformer ref={trRef} boundBoxFunc={(_,nw)=>({...nw,width:Math.max(5,nw.width),height:Math.max(5,nw.height)})}/>
          </Layer>
        </Stage>

        {/* Free text input */}
        {textInput&&(
          <div style={{position:"absolute",left:textInput.x,top:textInput.y,zIndex:10,display:"flex",gap:4,transform:"translate(0,-50%)"}}>
            <input autoFocus value={textVal} onChange={e=>setTextVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitText();if(e.key==="Escape"){setTextInput(null);setTextVal("");}}}
              style={{background:T.card,border:`1px solid ${T.blue}`,borderRadius:4,color:T.text,padding:"4px 8px",fontSize:13,fontFamily:T.font,outline:"none",minWidth:120}}
              placeholder="Testo..."/>
            <button onClick={commitText} style={{background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:4,color:T.blue,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✓</button>
          </div>
        )}

        {/* Label edit overlay (dbl-click on stamped shape) */}
        {labelEditId&&(
          <div style={{position:"absolute",left:labelPos.x,top:labelPos.y,zIndex:10,display:"flex",gap:4,transform:"translate(-50%,-50%)"}}>
            <input autoFocus value={labelVal} onChange={e=>setLabelVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitLabel();if(e.key==="Escape"){setLabelEditId(null);setLabelVal("");}}}
              style={{background:T.card,border:`1px solid ${T.green}`,borderRadius:4,color:T.text,padding:"5px 10px",fontSize:13,fontFamily:T.font,outline:"none",minWidth:140,textAlign:"center"}}
              placeholder="Etichetta..."/>
            <button onClick={commitLabel} style={{background:"#0a1a0a",border:`1px solid ${T.green}55`,borderRadius:4,color:T.green,padding:"5px 9px",cursor:"pointer",fontSize:12}}>✓</button>
            <button onClick={()=>{setLabelEditId(null);setLabelVal("");}} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:4,color:T.textDim,padding:"5px 9px",cursor:"pointer",fontSize:12}}>✕</button>
          </div>
        )}

        {/* Hint bar at bottom of canvas */}
        <div style={{position:"absolute",bottom:6,left:10,fontSize:10,color:T.textDim,pointerEvents:"none"}}>
          {tool==="select"&&!selectedId&&"Clicca per selezionare · Dbl-click per rinominare · Trascina per spostare"}
          {tool==="select"&&selectedId&&`${selectedShape?.label||selectedShape?.type||""} selezionato · Dbl-click per rinominare`}
        </div>
      </div>
    </div>
  );
}

// ─── WORKSHOP ORDERS (no internal tabs — tabs handled by OperativoModule) ─────
function WorkshopModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const isMobile=useIsMobile();
  const {data:orders,loading,error,refetch}=useApi("/workshop/orders");
  const canEdit=can("workshop","edit");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,fontFamily:T.font}}>
      {!canEdit&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 16px",fontSize:12,color:T.textSub}}>👁 Solo lettura — il tuo ruolo non permette modifiche</div>}
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12}}>
        {["waiting_parts","in_progress","done"].map(col=>(
          <div key={col} style={{flex:1,background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[col]}}/>
              <span style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8}}>{{"waiting_parts":"In Attesa","in_progress":"In Corso","done":"Completato"}[col]}</span>
              <span style={{fontSize:11,color:T.textDim,marginLeft:"auto",background:T.bg,padding:"1px 8px",borderRadius:10}}>{orders.filter(o=>o.status===col).length}</span>
            </div>
            {orders.filter(o=>o.status===col).map(o=>(
              <div key={o.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:12,marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:4}}>{o.vehicle}</div>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6}}>{o.plate} · {o.type}</div>
                <div style={{fontSize:11,color:T.text+"88"}}>{o.notes}</div>
                {o.mechanic&&<div style={{fontSize:10,color:T.textDim,marginTop:4}}>👤 {o.mechanic}{o.eta?` · ETA ${o.eta}`:""}</div>}
                {canEdit&&col!=="done"&&(
                  <button onClick={async()=>{
                    const next=col==="waiting_parts"?"in_progress":"done";
                    await fetch(`${API}/workshop/orders/${o.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status:next})});
                    refetch();
                  }} style={{marginTop:8,fontSize:11,padding:"4px 10px",background:T.navActive,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,cursor:"pointer",fontFamily:T.font}}>
                    → {col==="waiting_parts"?"Inizia":"Completa"}
                  </button>
                )}
              </div>
            ))}
            {orders.filter(o=>o.status===col).length===0&&<div style={{fontSize:12,color:T.textDim,textAlign:"center",paddingTop:24}}>Nessun ordine</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SEGNALAZIONI CONSTANTS ───────────────────────────────────────────────────
const SEG_STATUS={aperta:{label:"Aperta",color:T.orange},in_lavorazione:{label:"In lavorazione",color:T.blue},chiusa:{label:"Chiusa",color:T.green}};
const SEG_TIPO={guasto:{label:"Guasto",color:T.yellow},incidente:{label:"Incidente",color:T.red},manutenzione:{label:"Manutenzione",color:T.blue}};

// ─── SEGNALAZIONI MODULE ──────────────────────────────────────────────────────
function SegnalazioniModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const {data:vehicles}=useApi("/gps/vehicles",{skip:!can("gps")});
  const [list,setList]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [msg,setMsg]=useState(null);
  const isManager=auth.user.role==="fleet_manager";
  const emptyForm={reporter_name:auth.user.name,settore:"",vehicle:"",plate:"",description:"",tipo:"guasto",available_from:"",photo:null};
  const [form,setForm]=useState(emptyForm);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const [photoPreview,setPhotoPreview]=useState(null);

  const handlePhoto=e=>{const file=e.target.files[0];if(!file)return;setForm(f=>({...f,photo:file}));setPhotoPreview(URL.createObjectURL(file));};
  const removePhoto=()=>{setForm(f=>({...f,photo:null}));setPhotoPreview(null);};
  const loadList=useCallback(async()=>{
    setLoading(true);
    try{const r=await fetch(`${API}/segnalazioni`,{headers:{Authorization:`Bearer ${auth.token}`}});const d=await r.json();if(d.ok)setList(d.data);}catch{}
    setLoading(false);
  },[auth.token]);
  useEffect(()=>{loadList();},[loadList]);

  const handleVehicleChange=e=>{const v=vehicles?.find(v=>v.name===e.target.value);setForm(f=>({...f,vehicle:e.target.value,plate:v?.plate||""}));};
  const submit=async()=>{
    if(!form.settore||!form.vehicle||!form.description){setMsg({ok:false,text:"Settore, veicolo e descrizione sono obbligatori"});return;}
    setSubmitting(true);setMsg(null);
    try{
      const fd=new FormData();
      ["reporter_name","settore","vehicle","plate","description","tipo","available_from"].forEach(k=>fd.append(k,form[k]||""));
      if(form.photo)fd.append("photo",form.photo);
      const r=await fetch(`${API}/segnalazioni`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`},body:fd});
      const d=await r.json();
      if(d.ok){setMsg({ok:true,text:"Segnalazione inviata"});setShowForm(false);setForm(emptyForm);setPhotoPreview(null);loadList();}
      else setMsg({ok:false,text:d.error});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setSubmitting(false);setTimeout(()=>setMsg(null),4000);
  };
  const updateStatus=async(id,status)=>{await fetch(`${API}/segnalazioni/${id}/status`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status})});loadList();};
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};
  const lbl={fontSize:11,color:T.textSub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600};
  const openSeg=list.filter(s=>s.status!=="chiusa");
  const closedSeg=list.filter(s=>s.status==="chiusa");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:T.font}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{fontSize:13,color:T.textSub}}>Riporta un problema, guasto o incidente su un veicolo</div>
        <button onClick={()=>{setShowForm(v=>!v);setMsg(null);}} style={{padding:"9px 18px",background:T.navActive,border:`1px solid ${T.green}44`,borderRadius:8,color:T.green,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
          {showForm?"✕ Annulla":"+ Nuova segnalazione"}
        </button>
      </div>

      {msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.ok?T.card:"#1a0808",border:`1px solid ${msg.ok?T.border:"#4a1a1a"}`,color:msg.ok?T.green:T.red,fontSize:13}}>{msg.text}</div>}

      {showForm&&(
        <div style={{background:T.card,border:`1px solid ${T.green}33`,borderRadius:12,padding:22,display:"flex",flexDirection:"column",gap:16,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text}}>Nuova segnalazione</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
            <div><label style={lbl}>Nome segnalante</label><input value={form.reporter_name} onChange={e=>set("reporter_name")(e.target.value)} style={inp}/></div>
            <div><label style={lbl}>Settore</label><input value={form.settore} onChange={e=>set("settore")(e.target.value)} style={inp} placeholder="Es. Zona Nord…"/></div>
          </div>
          <div>
            <label style={lbl}>Veicolo</label>
            {vehicles?.length>0
              ?<select value={form.vehicle} onChange={handleVehicleChange} style={inp}><option value="">— Seleziona veicolo —</option>{vehicles.map(v=><option key={v.id} value={v.name}>{v.name} · {v.plate}</option>)}</select>
              :<input value={form.vehicle} onChange={e=>set("vehicle")(e.target.value)} style={inp} placeholder="Nome del camion"/>
            }
          </div>
          <div><label style={lbl}>Cosa è successo</label><textarea value={form.description} onChange={e=>set("description")(e.target.value)} rows={4} style={{...inp,resize:"vertical",lineHeight:1.6}} placeholder="Descrivi il problema…"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <label style={lbl}>Tipo</label>
              <div style={{display:"flex",gap:8}}>
                {Object.entries(SEG_TIPO).map(([key,{label,color}])=>(
                  <button key={key} type="button" onClick={()=>set("tipo")(key)}
                    style={{flex:1,padding:"9px 6px",borderRadius:8,cursor:"pointer",fontFamily:T.font,fontSize:12,fontWeight:form.tipo===key?700:400,background:form.tipo===key?color+"22":T.bg,border:`1px solid ${form.tipo===key?color:T.border}`,color:form.tipo===key?color:T.textSub,transition:"all 0.15s"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Disponibile dal</label><input type="date" value={form.available_from} onChange={e=>set("available_from")(e.target.value)} style={{...inp,colorScheme:"dark"}}/></div>
          </div>
          <div>
            <label style={lbl}>Foto (opzionale)</label>
            {!photoPreview
              ?<label style={{display:"flex",alignItems:"center",gap:10,padding:"13px 18px",background:T.bg,border:`2px dashed ${T.border}`,borderRadius:8,cursor:"pointer"}}>
                <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
                <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={18}/>
                <span style={{fontSize:13,color:T.textSub}}>Clicca per allegare una foto</span>
              </label>
              :<div style={{position:"relative",display:"inline-block"}}>
                <img src={photoPreview} alt="preview" style={{maxHeight:200,maxWidth:"100%",borderRadius:8,border:`1px solid ${T.border}`,display:"block"}}/>
                <button onClick={removePhoto} style={{position:"absolute",top:6,right:6,background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:6,color:T.red,padding:"3px 10px",cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            }
          </div>
          <button onClick={submit} disabled={submitting} style={{alignSelf:"flex-end",padding:"11px 26px",background:T.navActive,border:`1px solid ${T.green}44`,borderRadius:8,color:T.green,cursor:submitting?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
            {submitting?"Invio in corso…":"Invia segnalazione"}
          </button>
        </div>
      )}

      {loading?<Spinner/>:list.length===0
        ?<div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"40px",textAlign:"center",color:T.textDim,fontSize:13}}>Nessuna segnalazione presente</div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {openSeg.map(s=>(
            <div key={s.id} style={{background:T.card,border:`1px solid ${s.tipo==="incidente"?"#4a1a1a":s.tipo==="manutenzione"?"#1a2a4a":T.cardBorder}`,borderRadius:12,padding:"16px 20px",boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  {s.tipo&&SEG_TIPO[s.tipo]&&<span style={{fontSize:11,padding:"2px 10px",borderRadius:10,background:SEG_TIPO[s.tipo].color+"22",color:SEG_TIPO[s.tipo].color,fontWeight:700,border:`1px solid ${SEG_TIPO[s.tipo].color}44`}}>{SEG_TIPO[s.tipo].label}</span>}
                  <span style={{fontSize:14,fontWeight:700,color:T.text}}>{s.vehicle}</span>
                  {s.plate&&<span style={{fontSize:11,color:T.textSub,fontFamily:T.mono}}>{s.plate}</span>}
                  <span style={{fontSize:11,color:T.textDim}}>· {s.settore}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:SEG_STATUS[s.status]?.color+"22",color:SEG_STATUS[s.status]?.color,fontWeight:600,border:`1px solid ${SEG_STATUS[s.status]?.color}44`}}>{SEG_STATUS[s.status]?.label}</span>
                  {isManager&&s.status!=="chiusa"&&(
                    <select value={s.status} onChange={e=>updateStatus(s.id,e.target.value)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",color:T.text,fontSize:11,outline:"none",cursor:"pointer",fontFamily:T.font}}>
                      <option value="aperta">Aperta</option><option value="in_lavorazione">In lavorazione</option><option value="chiusa">Chiusa</option>
                    </select>
                  )}
                </div>
              </div>
              <div style={{fontSize:13,color:T.text+"aa",lineHeight:1.6,marginBottom:10}}>{s.description}</div>
              {s.photo_url&&<div style={{marginBottom:10}}><img src={`${BASE_URL}${s.photo_url}`} alt="foto" style={{maxHeight:220,maxWidth:"100%",borderRadius:8,border:`1px solid ${T.border}`,display:"block",cursor:"pointer"}} onClick={()=>window.open(`${BASE_URL}${s.photo_url}`,"_blank")}/></div>}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:T.textDim}}>👤 {s.reporter_name}</div>
                {s.available_from&&<div style={{fontSize:11,color:T.textDim}}>🔧 Disponibile dal {s.available_from}</div>}
                <div style={{fontSize:11,color:T.textDim,marginLeft:"auto"}}>{new Date(s.created_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          ))}
          {closedSeg.length>0&&(
            <details style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px"}}>
              <summary style={{fontSize:13,color:T.textSub,cursor:"pointer",userSelect:"none"}}>Segnalazioni chiuse ({closedSeg.length})</summary>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
                {closedSeg.map(s=>(
                  <div key={s.id} style={{background:T.bg,borderRadius:8,padding:"10px 14px",opacity:0.6}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <div><span style={{fontSize:13,fontWeight:600,color:T.text}}>{s.vehicle}</span><span style={{fontSize:11,color:T.textDim}}> · {s.settore}</span></div>
                      <span style={{fontSize:11,color:T.green}}>Chiusa</span>
                    </div>
                    <div style={{fontSize:12,color:T.textSub,marginTop:4}}>{s.description}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      }
    </div>
  );
}

// ─── OPERATIVO MODULE (Officina + Segnalazioni) ───────────────────────────────
function OperativoModule(){
  const {can}=usePerms();
  const {auth}=useAuth();
  const [activeTab,setActiveTab]=useState("segnalazioni");
  const [openCount,setOpenCount]=useState(0);

  // load badge count for open segnalazioni
  useEffect(()=>{
    fetch(`${API}/segnalazioni`,{headers:{Authorization:`Bearer ${auth.token}`}})
      .then(r=>r.json()).then(d=>{if(d.ok)setOpenCount(d.data.filter(s=>s.status!=="chiusa").length);}).catch(()=>{});
  },[auth.token]);

  const tabs=[
    can("workshop")&&{id:"workshop",label:"Ordini Officina",icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"},
    {id:"segnalazioni",label:"Segnalazioni",icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",badge:openCount},
  ].filter(Boolean);

  // make sure active tab is valid
  useEffect(()=>{if(!tabs.find(t=>t.id===activeTab)&&tabs.length)setActiveTab(tabs[0].id);},[tabs,activeTab]);

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab}/>
      {activeTab==="workshop"&&can("workshop")&&<WorkshopModule/>}
      {activeTab==="segnalazioni"&&<SegnalazioniModule/>}
    </div>
  );
}

// ─── FUEL MODULE ─────────────────────────────────────────────────────────────
function FuelModule(){
  const {data:entries,loading:lE,error:eE,refetch:rE}=useApi("/fuel/entries");
  const {data:summary,loading:lS,error:eS,refetch:rS}=useApi("/fuel/summary");
  if(lE||lS)return<Spinner/>;if(eE)return<ApiError error={eE} onRetry={rE}/>;if(eS)return<ApiError error={eS} onRetry={rS}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:T.font}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {[["Litri Totali",`${summary.total_liters} L`,"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6"],["Costo Totale",`€${summary.total_cost_eur.toFixed(2)}`,"M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],["KM Totali",`${summary.total_km} km`,"M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0 M12 7v5l3 3"],["L/100 km",`${summary.avg_consumption_l100}`,"M13 2L3 14h9l-1 8 10-12h-9l1-8"]].map(([l,v,icon])=>(
          <StatCard key={l} label={l} value={v} icon={icon}/>
        ))}
      </div>
      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
        <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:T.bg}}>{["Data","Veicolo","Litri","Costo","KM","Stazione"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>)}</tr></thead>
          <tbody>{entries.map((e)=><tr key={`${e.date}-${e.vehicle}-${e.km}`} style={{borderTop:`1px solid ${T.border}`}}>
            <td style={{padding:"12px 16px",color:T.textSub,fontFamily:T.mono,fontSize:12,whiteSpace:"nowrap"}}>{e.date}</td>
            <td style={{padding:"12px 16px",color:T.text,fontWeight:500,whiteSpace:"nowrap"}}>{e.vehicle}</td>
            <td style={{padding:"12px 16px",color:T.green,fontFamily:T.mono}}>{e.liters} L</td>
            <td style={{padding:"12px 16px",color:T.green,fontFamily:T.mono}}>€{e.cost_eur}</td>
            <td style={{padding:"12px 16px",color:T.text+"88",fontFamily:T.mono}}>{e.km}</td>
            <td style={{padding:"12px 16px",color:T.textSub,whiteSpace:"nowrap"}}>{e.station}</td>
          </tr>)}</tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// ─── SUPPLIERS MODULE ─────────────────────────────────────────────────────────
function SuppliersModule(){
  const {data:suppliers,loading,error,refetch}=useApi("/suppliers");
  const [search,setSearch]=useState("");
  const catColors={Carburante:T.blue,Ricambi:T.red,Pneumatici:T.yellow,Lubrificanti:T.green};
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  const filtered=suppliers.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.category.toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,fontFamily:T.font}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca fornitore o categoria..."
        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"11px 16px",color:T.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
        {filtered.map(s=>(
          <div key={s.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>{s.name}</div>
              <span style={{fontSize:10,padding:"2px 10px",borderRadius:10,background:(catColors[s.category]||T.green)+"22",color:catColors[s.category]||T.green,fontWeight:600}}>{s.category}</span>
            </div>
            <div style={{fontSize:12,color:T.textSub,marginBottom:4}}>📞 {s.contact}</div>
            <div style={{fontSize:12,color:T.textSub}}>✉ {s.email}</div>
            {s.notes&&<div style={{fontSize:11,color:T.textDim,marginTop:8,fontStyle:"italic"}}>{s.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COSTS MODULE ─────────────────────────────────────────────────────────────
function CostsModule(){
  const {data:costs,loading,error,refetch}=useApi("/costs/monthly");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  const max=Math.max(...costs.map(c=>c.total));
  return(
    <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:14,padding:24,fontFamily:T.font,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
      <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:20}}>Costi Mensili 2026</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:16,height:180}}>
        {costs.map(c=>{const s=v=>`${(v/max)*160}px`;return(
          <div key={c.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:11,color:T.green,fontFamily:T.mono,marginBottom:4}}>€{c.total}</div>
            <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:160,gap:2}}>
              {[[c.fuel,T.green+"88"],[c.maintenance,T.blue+"88"],[c.other,T.yellow+"88"]].map(([v,col],i)=><div key={i} style={{width:"100%",height:s(v),background:col,borderRadius:3}}/>)}
            </div>
            <div style={{fontSize:11,color:T.textSub,marginTop:6}}>{c.month.slice(5)}/{c.month.slice(2,4)}</div>
          </div>);})}
      </div>
      <div style={{display:"flex",gap:20,marginTop:18}}>{[[T.green,"Carburante"],[T.blue,"Manutenzione"],[T.yellow,"Altro"]].map(([col,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.textSub}}><div style={{width:10,height:10,borderRadius:2,background:col}}/>{l}</div>)}</div>
    </div>
  );
}

// ─── FLOTTA MODULE (Carburante + Fornitori + Costi) ───────────────────────────
function FlottaModule(){
  const {can}=usePerms();
  const [activeTab,setActiveTab]=useState(can("fuel")?"fuel":can("suppliers")?"suppliers":"costs");

  const tabs=[
    can("fuel")&&{id:"fuel",label:"Carburante",icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6"},
    can("suppliers")&&{id:"suppliers",label:"Fornitori",icon:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"},
    can("costs")&&{id:"costs",label:"Costi",icon:"M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3"},
  ].filter(Boolean);

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab}/>
      {activeTab==="fuel"&&can("fuel")&&<FuelModule/>}
      {activeTab==="suppliers"&&can("suppliers")&&<SuppliersModule/>}
      {activeTab==="costs"&&can("costs")&&<CostsModule/>}
    </div>
  );
}

// ─── CRUSCOTTO MODULE ─────────────────────────────────────────────────────────
function CruscottoModule({onSelectVehicle}){
  const {can}=usePerms();
  const {data:vehicles,loading:lV}=useApi("/gps/vehicles",{skip:!can("gps")});
  const {data:fuelEntries,loading:lF}=useApi("/fuel/entries",{skip:!can("fuel")});
  const {data:orders,loading:lO}=useApi("/workshop/orders",{skip:!can("workshop")});
  const {data:costs,loading:lC}=useApi("/costs/monthly",{skip:!can("costs")});
  if(lV||lF||lO||lC)return<Spinner/>;

  const vFuel={};
  fuelEntries?.forEach(e=>{
    if(!vFuel[e.vehicle])vFuel[e.vehicle]={liters:0,cost:0,refills:0,lastKm:0};
    vFuel[e.vehicle].liters+=Number(e.liters);vFuel[e.vehicle].cost+=parseFloat(e.cost_eur);vFuel[e.vehicle].refills+=1;
    if(e.km>vFuel[e.vehicle].lastKm)vFuel[e.vehicle].lastKm=e.km;
  });
  const vOrders={};orders?.forEach(o=>{vOrders[o.vehicle]=(vOrders[o.vehicle]||0)+1;});
  const rows=(vehicles||[]).map(v=>({...v,f:vFuel[v.name]||null,ordersCount:vOrders[v.name]||0}));
  const totalLiters=Object.values(vFuel).reduce((s,f)=>s+f.liters,0);
  const totalFuelCost=Object.values(vFuel).reduce((s,f)=>s+f.cost,0);
  const totalOrders=orders?.length||0;
  const currentMonth=costs?costs[costs.length-1]:null;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20,fontFamily:T.font}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {vehicles&&<StatCard label="Veicoli in flotta" value={vehicles.length} icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
        {can("fuel")&&<StatCard label="Litri totali" value={`${totalLiters.toFixed(0)} L`} icon="M3 22V8l9-6 9 6v14H3z"/>}
        {can("fuel")&&<StatCard label="Costo carburante" value={`€${totalFuelCost.toFixed(0)}`} icon="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>}
        {can("workshop")&&<StatCard label="Ordini officina" value={totalOrders} color={totalOrders>0?T.orange:T.green} alert={totalOrders>0} icon="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
        {can("costs")&&currentMonth&&<StatCard label="Costi aprile" value={`€${currentMonth.total}`} icon="M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3"/>}
      </div>
      <div>
        <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Dettaglio per veicolo</div>
        <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
          <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:T.bg}}>
                {["Veicolo","Stato",can("gps")&&"Odom. km",can("fuel")&&"Litri",can("fuel")&&"Costo carb.",can("fuel")&&"Rifornimenti",can("workshop")&&"Interventi",can("gps")&&"Carburante",""].filter(Boolean).map(h=>(
                  <th key={h} style={{padding:"12px 16px",textAlign:h===""?"center":"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(v=>(
                <tr key={v.id} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"14px 16px"}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{v.name}</div><div style={{fontSize:10,color:T.textDim,fontFamily:T.mono}}>{v.plate}</div></td>
                  <td style={{padding:"14px 16px"}}><span style={{fontSize:10,padding:"3px 10px",borderRadius:10,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:600}}>{statusLabel[v.status]}</span></td>
                  {can("gps")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.text,fontFamily:T.mono,fontSize:12}}>{v.f?.lastKm?v.f.lastKm.toLocaleString("it-IT"):"—"}</td>}
                  {can("fuel")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.green,fontFamily:T.mono,fontSize:12}}>{v.f?`${v.f.liters} L`:"—"}</td>}
                  {can("fuel")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.green,fontFamily:T.mono,fontSize:12}}>{v.f?`€${v.f.cost.toFixed(2)}`:"—"}</td>}
                  {can("fuel")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.text+"88",fontSize:12}}>{v.f?v.f.refills:"—"}</td>}
                  {can("workshop")&&<td style={{padding:"14px 16px",textAlign:"right",fontSize:12}}><span style={{color:v.ordersCount>0?T.orange:T.textDim}}>{v.ordersCount}</span></td>}
                  {can("gps")&&<td style={{padding:"14px 16px",textAlign:"right",minWidth:90}}>
                    {v.fuel_pct!=null?<><div style={{height:4,background:T.border,borderRadius:2,marginBottom:2}}><div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?T.red:T.green,borderRadius:2}}/></div><div style={{fontSize:10,color:v.fuel_pct<20?T.red:T.textDim,textAlign:"right"}}>{v.fuel_pct}%</div></>:"—"}
                  </td>}
                  <td style={{padding:"14px 16px",textAlign:"center"}}><button onClick={()=>onSelectVehicle(v)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"5px 12px",cursor:"pointer",fontSize:12,fontFamily:T.font,whiteSpace:"nowrap"}}>Dettaglio →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      {can("costs")&&costs&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Costi mensili</div>
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
            <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:T.bg}}>{["Mese","Carburante","Manutenzione","Altro","Totale"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:h==="Mese"?"left":"right",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>{costs.map(c=>(
                <tr key={c.month} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"12px 16px",color:T.textSub,fontFamily:T.mono,whiteSpace:"nowrap"}}>{c.month}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.green,fontFamily:T.mono}}>€{c.fuel}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.blue,fontFamily:T.mono}}>€{c.maintenance}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.yellow,fontFamily:T.mono}}>€{c.other}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.text,fontFamily:T.mono,fontWeight:700}}>€{c.total}</td>
                </tr>
              ))}</tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTS MODULE ───────────────────────────────────────────────────────────
function ReportsModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const [downloading,setDownloading]=useState(null);
  const [msg,setMsg]=useState(null);
  const download=async(endpoint,label)=>{
    setDownloading(endpoint);setMsg(null);
    try{
      const res=await fetch(`${API}/reports/${endpoint}`,{headers:{Authorization:`Bearer ${auth.token}`}});
      if(!res.ok){setMsg({ok:false,text:"Errore generazione report"});return;}
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`${label}_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(url);
      setMsg({ok:true,text:`${label} scaricato`});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setDownloading(null);setTimeout(()=>setMsg(null),3000);
  };
  const reports=[
    {id:"fleet",label:"Report completo flotta",desc:"Carburante + Officina + Segnalazioni in un unico file Excel",icon:"M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",always:true},
    {id:"segnalazioni",label:"Segnalazioni",desc:"Tutte le segnalazioni con tipo, stato, veicolo e data",icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",always:true},
    {id:"fuel",label:"Registro carburante",desc:"Tutti i rifornimenti con litri, costo, KM e stazione",icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6",perm:"fuel"},
    {id:"workshop",label:"Ordini officina",desc:"Tutti gli ordini con stato, meccanico, ETA e note",icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",perm:"workshop"},
  ].filter(r=>r.always||can(r.perm));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:T.font}}>
      <div style={{fontSize:13,color:T.textSub}}>Scarica i dati in formato Excel — compatibile con Microsoft Excel e Google Sheets</div>
      {msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.ok?T.card:"#1a0808",border:`1px solid ${msg.ok?T.border:"#4a1a1a"}`,color:msg.ok?T.green:T.red,fontSize:13}}>{msg.text}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {reports.map(r=>(
          <div key={r.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
            <div style={{width:44,height:44,borderRadius:10,background:T.bg,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:T.blue}}>
              <Icon d={r.icon} size={20}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:3}}>{r.label}</div>
              <div style={{fontSize:12,color:T.textSub}}>{r.desc}</div>
            </div>
            <button onClick={()=>download(r.id,r.label)} disabled={downloading===r.id}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",background:downloading===r.id?T.bg:T.navActive,border:`1px solid ${downloading===r.id?T.border:T.blue+"55"}`,borderRadius:8,color:downloading===r.id?T.textDim:T.blue,cursor:downloading===r.id?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,whiteSpace:"nowrap"}}>
              <Icon d={downloading===r.id?"M12 2v4 M12 18v4":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"} size={14}/>
              {downloading===r.id?"Generazione…":"Scarica Excel"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ANALYTICS MODULE (Cruscotto + Report) ────────────────────────────────────
function AnalyticsModule({onSelectVehicle}){
  const [activeTab,setActiveTab]=useState("cruscotto");
  const tabs=[
    {id:"cruscotto",label:"Cruscotto",icon:"M18 20V10 M12 20V4 M6 20v-6"},
    {id:"reports",label:"Report & Export",icon:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"},
  ];
  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab}/>
      {activeTab==="cruscotto"&&<CruscottoModule onSelectVehicle={onSelectVehicle}/>}
      {activeTab==="reports"&&<ReportsModule/>}
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel(){
  const {auth}=useAuth();
  const {matrix,roles,levels,loadPerms}=usePerms();
  const [activeTab,setActiveTab]=useState("permissions");
  const [localMatrix,setLocalMatrix]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);
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
    const d=await res.json();if(d.ok)setUsers(d.data);
    setUsersLoading(false);
  },[auth.token]);
  useEffect(()=>{ if(activeTab==="users")loadUsers(); },[activeTab,loadUsers]);

  const saveMatrix=async()=>{
    setSaving(true);setSaveMsg(null);
    try{
      const res=await fetch(`${API}/permissions`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({matrix:localMatrix})});
      const d=await res.json();
      if(d.ok){setSaveMsg({ok:true,text:"Permessi salvati"});loadPerms();}
      else setSaveMsg({ok:false,text:d.error});
    }catch{setSaveMsg({ok:false,text:"Errore di rete"});}
    setSaving(false);setTimeout(()=>setSaveMsg(null),3000);
  };
  const setLevel=(role,mod,level)=>setLocalMatrix(m=>({...m,[role]:{...m[role],[mod]:level}}));
  const createUser=async()=>{
    if(!newUser.name||!newUser.email||!newUser.password){setUserMsg({ok:false,text:"Tutti i campi sono obbligatori"});return;}
    const res=await fetch(`${API}/admin/users`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
    const d=await res.json();
    if(d.ok){setUserMsg({ok:true,text:"Utente creato"});setShowNewUser(false);setNewUser({name:"",email:"",password:"",role:"coordinatore_operativo"});loadUsers();}
    else setUserMsg({ok:false,text:d.error});
    setTimeout(()=>setUserMsg(null),3000);
  };
  const toggleUser=async(id,active)=>{ await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({active})}); loadUsers(); };
  const changeRole=async(id,role)=>{ await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({role})}); loadUsers(); };
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};

  const adminTabs=[
    {id:"permissions",label:"Permessi",icon:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"},
    {id:"users",label:"Utenti",icon:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"},
  ];

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={adminTabs} active={activeTab} onChange={setActiveTab}/>

      {activeTab==="permissions"&&localMatrix&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr>
                  <th style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`}}>Modulo</th>
                  {roles.map(r=><th key={r} style={{padding:"12px 16px",textAlign:"center",color:T.textSub,fontWeight:600,fontSize:11,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{roleLabel[r]||r}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map(mod=>(
                  <tr key={mod} style={{borderBottom:`1px solid ${T.border}22`}}>
                    <td style={{padding:"14px 16px",color:T.text,fontWeight:600}}>{moduleLabel[mod]||mod}</td>
                    {roles.map(role=>{
                      const current=localMatrix[role]?.[mod]||"none";
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
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18}}>
            <button onClick={saveMatrix} disabled={saving} style={{padding:"10px 22px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:saving?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              {saving?"Salvando...":"💾 Salva e applica"}
            </button>
            {saveMsg&&<div style={{fontSize:13,color:saveMsg.ok?T.green:T.red}}>{saveMsg.text}</div>}
          </div>
          <div style={{display:"flex",gap:16,marginTop:14}}>
            {[["none","Nessun accesso"],["view","Solo lettura"],["edit","Modifica"],["full","Accesso completo"]].map(([l,desc])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.textSub}}>
                <div style={{width:8,height:8,borderRadius:2,background:levelColor[l]}}/>{desc}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab==="users"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,color:T.textSub}}>{users.length} utenti</div>
            <button onClick={()=>setShowNewUser(v=>!v)} style={{padding:"9px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              {showNewUser?"✕ Annulla":"+ Nuovo utente"}
            </button>
          </div>
          {userMsg&&<div style={{fontSize:13,padding:"10px 14px",borderRadius:8,background:userMsg.ok?T.card:"#1a0808",border:`1px solid ${userMsg.ok?T.border:"#4a1a1a"}`,color:userMsg.ok?T.green:T.red}}>{userMsg.text}</div>}
          {showNewUser&&(
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{fontSize:14,color:T.text,fontWeight:600}}>Nuovo utente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["Nome","text",newUser.name,v=>setNewUser(u=>({...u,name:v}))],["Email","email",newUser.email,v=>setNewUser(u=>({...u,email:v}))],["Password","password",newUser.password,v=>setNewUser(u=>({...u,password:v}))]].map(([label,type,val,set])=>(
                  <div key={label}>
                    <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} style={inp}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>Ruolo</label>
                  <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={inp}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createUser} style={{alignSelf:"flex-start",padding:"9px 18px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>Crea utente</button>
            </div>
          )}
          {usersLoading?<Spinner/>:
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.map(u=>(
                <div key={u.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,opacity:u.active?1:0.5,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
                    <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{u.email}</div>
                  </div>
                  <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",color:T.text,fontSize:11,outline:"none",fontFamily:T.font,cursor:"pointer"}}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                  <div style={{width:8,height:8,borderRadius:"50%",background:u.active?T.green:T.textDim,flexShrink:0}}/>
                  <button onClick={()=>toggleUser(u.id,!u.active)} style={{fontSize:12,padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:u.active?T.red:T.green,cursor:"pointer",fontFamily:T.font}}>
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

// ─── SUPER-ADMIN DASHBOARD (task 15) ──────────────────────────────────────────
const MODULE_META = {
  gps:        { label:"GPS Live",     icon:"M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" },
  cdr:        { label:"Schede CDR",   icon:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" },
  zone:       { label:"Zone",         icon:"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" },
  punti:      { label:"Punti",        icon:"M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" },
  percorsi:   { label:"Percorsi",     icon:"M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13 M15 7v13" },
  pdf_export: { label:"Export PDF",   icon:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" },
};

function SuperAdminDashboard(){
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

// ─── COMPANY ADMIN PANEL (task 16) ────────────────────────────────────────────
function CompanyAdminPanel(){
  const {auth}=useAuth();
  const {roles}=usePerms();
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",password:"",role:"coordinatore_operativo"});
  const [msg,setMsg]=useState(null);
  const [tenantModules,setTenantModules]=useState(null);

  // Roles that company_admin is allowed to assign
  const assignableRoles=roles.filter(r=>!["superadmin","company_admin"].includes(r));

  const load=useCallback(async()=>{
    setLoading(true);
    const r=await fetch(`${API}/admin/users`,{headers:{Authorization:`Bearer ${auth.token}`}});
    const d=await r.json();if(d.ok)setUsers(d.data);
    setLoading(false);
  },[auth.token]);

  useEffect(()=>{ load(); },[load]);

  // Load tenant modules from auth context (populated at login time)
  useEffect(()=>{
    if(auth?.tenant?.modules) setTenantModules(auth.tenant.modules);
  },[auth?.tenant?.modules]);

  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};

  const createUser=async()=>{
    if(!newUser.name||!newUser.email||!newUser.password){setMsg({ok:false,text:"Tutti i campi sono obbligatori"});return;}
    const r=await fetch(`${API}/admin/users`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
    const d=await r.json();
    if(d.ok){setMsg({ok:true,text:"Utente creato"});setShowNew(false);setNewUser({name:"",email:"",password:"",role:"coordinatore_operativo"});load();}
    else setMsg({ok:false,text:d.error});
    setTimeout(()=>setMsg(null),3000);
  };
  const toggleUser=async(id,active)=>{
    await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({active})});
    load();
  };
  const changeRole=async(id,role)=>{
    await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({role})});
    load();
  };

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <div style={{fontSize:18,fontWeight:700,color:T.text}}>Amministrazione Azienda</div>
        <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Gestisci gli utenti della tua organizzazione</div>
      </div>

      {/* Module status (read-only, driven by superadmin settings) */}
      {tenantModules&&(
        <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px"}}>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:600}}>Moduli abilitati dalla piattaforma</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(MODULE_META).map(([mod,meta])=>{
              const enabled=tenantModules[mod]??false;
              return(
                <div key={mod} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:8,fontSize:11,fontWeight:600,
                  background:enabled?"#0a1a0a":"transparent",border:`1px solid ${enabled?T.green:T.border}`,color:enabled?T.green:T.textDim}}>
                  {meta.label}
                </div>
              );
            })}
          </div>
          <div style={{fontSize:10,color:T.textDim,marginTop:8}}>Contatta il supporto per modificare i moduli abilitati</div>
        </div>
      )}

      {/* Users section */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,color:T.textSub}}>{users.length} utenti nella tua organizzazione</div>
          <button onClick={()=>setShowNew(v=>!v)}
            style={{padding:"9px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
            {showNew?"✕ Annulla":"+ Nuovo utente"}
          </button>
        </div>

        {msg&&<div style={{fontSize:13,padding:"10px 14px",borderRadius:8,background:msg.ok?T.card:"#1a0808",border:`1px solid ${msg.ok?T.border:"#4a1a1a"}`,color:msg.ok?T.green:T.red}}>{msg.text}</div>}

        {showNew&&(
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:18,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:14,color:T.text,fontWeight:600}}>Nuovo utente</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["Nome","text",newUser.name,v=>setNewUser(u=>({...u,name:v}))],
                ["Email","email",newUser.email,v=>setNewUser(u=>({...u,email:v}))],
                ["Password","password",newUser.password,v=>setNewUser(u=>({...u,password:v}))]].map(([label,type,val,set])=>(
                <div key={label}>
                  <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
                  <input type={type} value={val} onChange={e=>set(e.target.value)} style={inp}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>Ruolo</label>
                <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={inp}>
                  {assignableRoles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                </select>
              </div>
            </div>
            <button onClick={createUser}
              style={{alignSelf:"flex-start",padding:"9px 18px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              Crea utente
            </button>
          </div>
        )}

        {loading?<Spinner/>:(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {users.map(u=>(
              <div key={u.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,opacity:u.active?1:0.5}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
                  <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{u.email}</div>
                </div>
                <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)}
                  style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",color:T.text,fontSize:11,outline:"none",fontFamily:T.font,cursor:"pointer"}}>
                  {assignableRoles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                </select>
                <div style={{width:8,height:8,borderRadius:"50%",background:u.active?T.green:T.textDim,flexShrink:0}}/>
                <button onClick={()=>toggleUser(u.id,!u.active)}
                  style={{fontSize:12,padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:u.active?T.red:T.green,cursor:"pointer",fontFamily:T.font}}>
                  {u.active?"Disattiva":"Riattiva"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUPER-ADMIN ANALYTICS (task 17) ──────────────────────────────────────────
const MODULE_LABELS_SHORT={gps:"GPS",cdr:"CDR",zone:"Zone",punti:"Punti",percorsi:"Percorsi",pdf_export:"PDF"};
const CHART_COLORS=["#60a5fa","#4ade80","#fb923c","#f472b6","#34d399","#facc15"];

function SuperAdminAnalytics(){
  const {auth}=useAuth();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r=await fetch(`${API}/superadmin/analytics`,{headers:{Authorization:`Bearer ${auth.token}`}});
        const d=await r.json();
        if(d.ok)setData(d.data);
      }catch{}
      setLoading(false);
    })();
  },[auth.token]);

  if(loading) return <Spinner/>;
  if(!data) return <div style={{color:T.textSub,fontSize:13}}>Impossibile caricare i dati</div>;

  const {summary,module_adoption,tenant_stats,inactive_alerts}=data;
  const chartData=module_adoption.map((m,i)=>({name:MODULE_LABELS_SHORT[m.module]||m.module,count:m.count,pct:m.pct,fill:CHART_COLORS[i%CHART_COLORS.length]}));

  const statCards=[
    {label:"Aziende attive",value:summary.active_tenants,color:T.blue},
    {label:"Utenti attivi",value:summary.total_users,color:T.green},
    {label:"Aziende inattive >7gg",value:summary.inactive_tenants,color:summary.inactive_tenants>0?T.orange:T.textSub},
    {label:"Aziende totali",value:summary.total_tenants,color:T.textSub},
  ];

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:22}}>
      <div>
        <div style={{fontSize:18,fontWeight:700,color:T.text}}>Analytics Piattaforma</div>
        <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Panoramica sull'adozione e attività dei tenant</div>
      </div>

      {/* KPI cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        {statCards.map(s=>(
          <div key={s.label} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"16px 18px"}}>
            <div style={{fontSize:28,fontWeight:800,color:s.color,fontVariantNumeric:"tabular-nums"}}>{s.value}</div>
            <div style={{fontSize:11,color:T.textSub,marginTop:4,fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Module adoption chart */}
      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"18px 20px"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:16}}>Adozione moduli</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={32}>
            <XAxis dataKey="name" tick={{fill:T.textSub,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.textSub,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip
              contentStyle={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}
              formatter={(v,_n,p)=>[`${v} / ${summary.active_tenants} aziende (${p.payload.pct}%)`,"Tenant"]}
            />
            <Bar dataKey="count" radius={[4,4,0,0]}>
              {chartData.map((entry,i)=><Cell key={i} fill={entry.fill}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inactivity alerts */}
      {inactive_alerts.length>0&&(
        <div style={{background:T.card,border:`1px solid ${T.orange}44`,borderRadius:10,padding:"18px 20px"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.orange,marginBottom:12}}>⚠ Allerta inattività ({inactive_alerts.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {inactive_alerts.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",background:"#1a0f00",border:"1px solid #2a1a00",borderRadius:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:T.orange,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{a.name}</div>
                  <div style={{fontSize:11,color:T.textDim}}>Ultimo accesso: {new Date(a.last_active).toLocaleDateString("it-IT")}</div>
                </div>
                <div style={{fontSize:12,color:T.orange,fontFamily:T.mono,fontWeight:700}}>{a.days_inactive} gg</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-tenant stats table */}
      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"18px 20px"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:14}}>Dettaglio tenant</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>
                {["Azienda","Piano","Utenti","Moduli","Ultimo accesso","Stato"].map(h=>(
                  <th key={h} style={{padding:"8px 14px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenant_stats.map(t=>(
                <tr key={t.id} style={{borderBottom:`1px solid ${T.border}22`}}>
                  <td style={{padding:"12px 14px",color:T.text,fontWeight:600}}>{t.name}</td>
                  <td style={{padding:"12px 14px",color:T.textSub}}>{t.plan}</td>
                  <td style={{padding:"12px 14px",color:T.blue,fontFamily:T.mono}}>{t.user_count}</td>
                  <td style={{padding:"12px 14px",color:T.green,fontFamily:T.mono}}>{t.modules_enabled} / 6</td>
                  <td style={{padding:"12px 14px",color:t.inactive?T.orange:T.textSub}}>
                    {new Date(t.last_active).toLocaleDateString("it-IT")}
                    {t.inactive&&<span style={{marginLeft:6,fontSize:10,color:T.orange}}>⚠</span>}
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,fontWeight:600,
                      background:t.inactive?"#1a0a0a":"#0a1a0a",
                      color:t.inactive?T.orange:T.green,
                      border:`1px solid ${t.inactive?T.orange:T.green}44`}}>
                      {t.inactive?"Inattivo":"Attivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── HOME MODULE ──────────────────────────────────────────────────────────────
function HomeModule({onSelectVehicle}){
  const {can}=usePerms();
  const {auth}=useAuth();
  const {data:vehicles}=useApi("/gps/vehicles",{skip:!can("gps")});
  const {data:orders}=useApi("/workshop/orders",{skip:!can("workshop")});
  const {data:fuelSummary}=useApi("/fuel/summary",{skip:!can("fuel")});
  const {data:costs}=useApi("/costs/monthly",{skip:!can("costs")});

  const fleetActive=vehicles?vehicles.filter(v=>v.status==="active").length:null;
  const fleetIdle=vehicles?vehicles.filter(v=>v.status==="idle").length:null;
  const fleetWorkshop=vehicles?vehicles.filter(v=>v.status==="workshop").length:null;
  const lowFuel=vehicles?vehicles.filter(v=>v.fuel_pct!=null&&v.fuel_pct<20):[];
  const pendingOrders=orders?orders.filter(o=>o.status!=="done"):[];
  const currentMonth=costs?costs[costs.length-1]:null;
  const prevMonth=costs?costs[costs.length-2]:null;
  const costTrend=currentMonth&&prevMonth?Math.round(((currentMonth.total-prevMonth.total)/prevMonth.total)*100):null;
  const hour=new Date().getHours();
  const greeting=hour<12?"Buongiorno":"Buonasera";

  return(
    <div style={{display:"flex",flexDirection:"column",gap:22,fontFamily:T.font}}>
      <div>
        <div style={{fontSize:22,fontWeight:700,color:T.text}}>{greeting}, {auth.user.name.split(" ")[0]}</div>
        <div style={{fontSize:13,color:T.textSub,marginTop:4}}>Ecco il riepilogo operativo di oggi</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
        {can("gps")&&<StatCard label="Veicoli attivi" value={fleetActive} sub={`${fleetIdle??"—"} fermi · ${fleetWorkshop??"—"} in officina`} icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
        {can("workshop")&&<StatCard label="Ordini aperti" value={pendingOrders.length||null} sub={pendingOrders.length?`${pendingOrders.filter(o=>o.status==="waiting_parts").length} in attesa ricambi`:"Nessun ordine pendente"} color={pendingOrders.length?T.orange:T.green} alert={pendingOrders.length>0} icon="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
        {can("fuel")&&<StatCard label="Costo carburante" value={fuelSummary?`€${fuelSummary.total_cost_eur.toFixed(0)}`:null} sub={fuelSummary?`${fuelSummary.total_liters} L · ${fuelSummary.total_km} km`:null} icon="M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6"/>}
        {can("costs")&&currentMonth&&<StatCard label="Costi questo mese" value={`€${currentMonth.total}`} sub={costTrend!=null?(costTrend>0?`▲ +${costTrend}% vs mese scorso`:`▼ ${costTrend}% vs mese scorso`):null} color={costTrend>0?T.orange:T.green} alert={costTrend>10} icon="M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3"/>}
      </div>

      {(lowFuel.length>0||pendingOrders.filter(o=>o.status==="waiting_parts").length>0)&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2,fontWeight:600}}>Attenzione richiesta</div>
          {lowFuel.map(v=>(
            <div key={v.id} style={{background:"#1a100a",border:"1px solid #4a2a1a",borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:T.orange,flexShrink:0}}/>
              <div style={{flex:1}}><span style={{color:T.orange,fontWeight:600,fontSize:13}}>{v.name}</span><span style={{color:"#7a4a2a",fontSize:12}}> — carburante basso: </span><span style={{color:T.orange,fontSize:12,fontFamily:T.mono}}>{v.fuel_pct}%</span></div>
              <div style={{fontSize:11,color:"#4a3a2a"}}>{v.plate}</div>
            </div>
          ))}
          {pendingOrders.filter(o=>o.status==="waiting_parts").map(o=>(
            <div key={o.id} style={{background:"#0a0f1a",border:"1px solid #1a2a4a",borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
              <div style={{flex:1}}><span style={{color:T.blue,fontWeight:600,fontSize:13}}>{o.vehicle}</span><span style={{color:"#3a3a6a",fontSize:12}}> — in attesa ricambi · </span><span style={{color:T.blue,fontSize:12}}>{o.type}</span></div>
              {o.eta&&<div style={{fontSize:11,color:"#3a3a6a"}}>ETA {o.eta}</div>}
            </div>
          ))}
        </div>
      )}

      {can("gps")&&vehicles&&vehicles.length>0&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Stato flotta</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:8}}>
            {vehicles.map(v=>(
              <div key={v.id} onClick={()=>onSelectVehicle(v)} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[v.status]??"#3a3a3a",flexShrink:0,boxShadow:`0 0 6px ${statusColor[v.status]??"#3a3a3a"}`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.name}</div>
                  <div style={{fontSize:10,color:T.textDim}}>{v.plate}{v.sector?` · ${v.sector}`:""}</div>
                </div>
                {v.fuel_pct!=null&&<div style={{fontSize:10,color:v.fuel_pct<20?T.orange:T.textDim,fontFamily:T.mono,flexShrink:0}}>{v.fuel_pct}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {can("workshop")&&pendingOrders.length>0&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Officina — ordini aperti</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pendingOrders.map(o=>(
              <div key={o.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[o.status]??"#3a3a3a",flexShrink:0}}/>
                <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:T.text}}>{o.vehicle}</span><span style={{fontSize:12,color:T.textSub}}> · {o.type}</span></div>
                <div style={{fontSize:11,color:T.textDim,whiteSpace:"nowrap"}}>{statusLabel[o.status]}{o.eta?` · ETA ${o.eta}`:""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NAVIGATION HELPERS ───────────────────────────────────────────────────────
function distanceM([lat1,lon1],[lat2,lon2]){
  const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(km){if(km<0.1)return`${Math.round(km*1000)} m`;if(km<10)return`${km.toFixed(1)} km`;return`${Math.round(km)} km`;}
function fmtTime(s){const m=Math.round(s/60);if(m<60)return`${m} min`;return`${Math.floor(m/60)}h ${m%60}m`;}
const NAV_ARROW={1:"↑",2:"↗",3:"↖",4:"↑",5:"↗",6:"→",7:"↪",8:"⤾",9:"⤿",10:"↩",11:"←",12:"↙",13:"↗",14:"↗",15:"↑",23:"⬤",24:"⬤"};

// ─── STAMPED CAMERA ───────────────────────────────────────────────────────────
const APP_VERSION = "0.1.0";

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "FleetCC/1.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    const parts = [
      a.road || a.pedestrian || a.path,
      a.house_number,
      a.town || a.city || a.village || a.municipality,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : d.display_name?.split(",")[0] || null;
  } catch {
    return null;
  }
}

function drawStamp(canvas, ctx, stamp) {
  const { address, coords, version, datetime } = stamp;
  const lines = [
    `FleetCC v${version}`,
    address || "",
    coords,
    datetime,
  ].filter(Boolean);

  const PAD = 42;
  const LINE_H = 60;
  const FONT_SIZE = 45;
  ctx.font = `bold ${FONT_SIZE}px 'JetBrains Mono', Consolas, monospace`;

  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxW = maxW + PAD * 2;
  const boxH = lines.length * LINE_H + PAD * 1.5;
  const x = 48;
  const y = canvas.height - boxH - 16;

  // Semi-transparent dark background
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "#0a1628";
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + boxW - r, y);
  ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r);
  ctx.lineTo(x + boxW, y + boxH - r);
  ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r, y + boxH);
  ctx.lineTo(x + r, y + boxH);
  ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Left accent bar
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(x, y + 18, 9, boxH - 36);
  ctx.restore();

  // Text lines
  lines.forEach((line, i) => {
    const ty = y + PAD + i * LINE_H;
    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#000";
    ctx.font = `${i === 0 ? "bold" : "normal"} ${FONT_SIZE}px 'JetBrains Mono', Consolas, monospace`;
    ctx.fillText(line, x + PAD + 21 + 3, ty + 3);
    ctx.restore();
    // Text
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = i === 0 ? "#4ade80" : i === lines.length - 1 ? "#60a5fa" : "#e2eaf5";
    ctx.font = `${i === 0 ? "bold" : "normal"} ${FONT_SIZE}px 'JetBrains Mono', Consolas, monospace`;
    ctx.fillText(line, x + PAD + 21, ty);
    ctx.restore();
  });
}

function LiveCamera({ position, auth, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const fileRef    = useRef(null);
  const streamRef  = useRef(null);
  // "starting" | "viewfinder" | "capturing" | "uploading" | "done" | "error" | "fallback"
  const [status, setStatus]   = useState("starting");
  const [errMsg, setErrMsg]   = useState("");
  const [address, setAddress] = useState(null);

  // Reverse-geocode once on mount
  useEffect(() => {
    if (position) reverseGeocode(position[0], position[1]).then(a => setAddress(a));
  }, []); // eslint-disable-line

  // Start camera on mount, stop on unmount
  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("fallback"); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {}); // Android requires explicit play()
        }
        setStatus("viewfinder");
      } catch {
        if (!cancelled) setStatus("fallback");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line

  function buildStampData() {
    const now = new Date();
    const dd  = String(now.getDate()).padStart(2,"0");
    const mm  = String(now.getMonth()+1).padStart(2,"0");
    const yy  = String(now.getFullYear()).slice(2);
    const hh  = String(now.getHours()).padStart(2,"0");
    const min = String(now.getMinutes()).padStart(2,"0");
    return {
      version:  APP_VERSION,
      address,
      coords:   position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : "Posizione non disponibile",
      datetime: `${dd}/${mm}/${yy} - ${hh}:${min}`,
    };
  }

  async function uploadBlob(blob) {
    const fd = new FormData();
    fd.append("photo", blob, "photo.jpg");
    const r = await fetch(`${API}/gps/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "Upload fallito");
  }

  async function captureAndUpload() {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    setStatus("capturing");
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawStamp(canvas, ctx, buildStampData());
    setStatus("uploading");
    try {
      await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas vuoto")), "image/jpeg", 0.92)
      ).then(blob => uploadBlob(blob));
      setStatus("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setErrMsg(e.message || "Errore upload");
      setStatus("error");
    }
  }

  async function handleFallbackFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = canvasRef.current;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      drawStamp(canvas, ctx, buildStampData());
      URL.revokeObjectURL(url);
      try {
        await new Promise((resolve, reject) =>
          canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas vuoto")), "image/jpeg", 0.92)
        ).then(blob => uploadBlob(blob));
        setStatus("done");
        setTimeout(onClose, 1400);
      } catch (err) {
        setErrMsg(err.message || "Errore upload");
        setStatus("error");
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); setErrMsg("Impossibile leggere la foto"); setStatus("error"); };
    img.src = url;
  }

  const isBusy = status === "capturing" || status === "uploading";

  return (
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:2000,display:"flex",flexDirection:"column",fontFamily:T.font}}>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFallbackFile} style={{display:"none"}}/>

      {/* Live viewfinder — always in DOM so videoRef is set before stream arrives */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{
          position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",
          opacity:(status==="viewfinder"||status==="capturing"||status==="uploading")?(isBusy?0.5:1):0,
          transition:"opacity 0.2s",
          pointerEvents:"none",
        }}/>

      {/* Starting spinner */}
      {status === "starting" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
          <div style={{width:36,height:36,border:`3px solid ${T.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
          <span style={{color:T.textSub,fontSize:13}}>Apertura fotocamera…</span>
        </div>
      )}

      {/* Fallback */}
      {status === "fallback" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:32}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.yellow} strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style={{color:T.text,fontSize:14,textAlign:"center"}}>Fotocamera non disponibile in questo browser.<br/>Scegli una foto dalla galleria.</span>
          <button onClick={() => fileRef.current.click()} style={{padding:"12px 28px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:10,color:T.blue,cursor:"pointer",fontSize:14,fontWeight:700}}>Scegli foto</button>
        </div>
      )}

      {/* Done toast */}
      {status === "done" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(74,222,128,0.15)",border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{color:T.green,fontSize:16,fontWeight:700}}>Foto salvata</span>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,padding:32}}>
          <span style={{color:T.red,fontSize:14,textAlign:"center"}}>{errMsg}</span>
          <button onClick={() => setStatus("viewfinder")} style={{padding:"10px 24px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.textSub,cursor:"pointer",fontSize:13}}>Riprova</button>
        </div>
      )}

      {/* Uploading overlay */}
      {status === "uploading" && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
          <div style={{width:36,height:36,border:`3px solid ${T.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
          <span style={{color:"#fff",fontSize:13,fontWeight:600,textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>Caricamento…</span>
        </div>
      )}

      {/* Bottom bar: stamp info + capture button */}
      {(status === "viewfinder" || status === "capturing") && (
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"16px 20px 32px",background:"linear-gradient(transparent, rgba(0,0,0,0.8))",display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          {/* Stamp preview */}
          <div style={{fontFamily:T.mono,fontSize:11,color:"rgba(255,255,255,0.65)",textAlign:"center",lineHeight:1.6}}>
            <span style={{color:T.green,fontWeight:700}}>FleetCC v{APP_VERSION}</span>
            {address && <><br/>{address}</>}
            {position && <><br/>{position[0].toFixed(5)}, {position[1].toFixed(5)}</>}
          </div>
          {/* Capture circle */}
          <button onClick={captureAndUpload} disabled={isBusy}
            style={{width:68,height:68,borderRadius:"50%",background:"rgba(255,255,255,0.92)",border:"4px solid rgba(255,255,255,0.4)",cursor:isBusy?"not-allowed":"pointer",boxShadow:"0 0 0 2px rgba(255,255,255,0.2), 0 4px 16px rgba(0,0,0,0.5)",transition:"transform 0.1s",flexShrink:0}}
            onMouseDown={e=>e.currentTarget.style.transform="scale(0.93)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
          />
        </div>
      )}

      {/* Close button (top-right) */}
      {!isBusy && status !== "done" && (
        <button onClick={onClose}
          style={{position:"absolute",top:16,right:16,width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,0.55)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:20,lineHeight:"34px",textAlign:"center",cursor:"pointer",backdropFilter:"blur(4px)"}}>
          ×
        </button>
      )}

    </div>
  );
}

// ─── TERRITORIO MODULE ────────────────────────────────────────────────────────
const TIPO_META = {
  mancata_raccolta: { label:"Mancata raccolta", color:"#f87171", bg:"rgba(248,113,113,0.12)" },
  abbandono:        { label:"Abbandono",         color:"#fb923c", bg:"rgba(251,146,60,0.12)"  },
  da_pulire:        { label:"Da pulire",          color:"#facc15", bg:"rgba(250,204,21,0.12)"  },
  altro:            { label:"Altro",              color:"#94a3b8", bg:"rgba(148,163,184,0.12)" },
};
const TERR_STATUS = {
  aperta:         { label:"Aperta",         color:"#f87171" },
  in_lavorazione: { label:"In lavorazione", color:"#facc15" },
  chiusa:         { label:"Chiusa",         color:"#4ade80" },
};

function formatSegDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function TerritorioModule() {
  const { auth }  = useAuth();
  const isMobile  = useIsMobile();
  const { data, refetch } = useApi("/segnalazioni-territorio");
  const segnalazioni = data || [];

  const [filterTipo,   setFilterTipo]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState(null);

  const filtered = segnalazioni.filter(s => {
    if (filterTipo   !== "all" && s.tipo   !== filterTipo)   return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.address||"").toLowerCase().includes(q) && !(s.note||"").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selectedFull = selected ? (segnalazioni.find(s => s.id === selected.id) || selected) : null;

  const statCounts = Object.fromEntries(
    Object.keys(TERR_STATUS).map(k => [k, segnalazioni.filter(s => s.status === k).length])
  );

  return (
    <div style={{fontFamily:T.font,color:T.text}}>
      {/* Header */}
      <div style={{marginBottom:20,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:6}}>Segnalazioni Territorio</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {Object.entries(TERR_STATUS).map(([k,v])=>(
              <div key={k} style={{fontSize:12,color:v.color,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:v.color,display:"inline-block"}}/>
                {statCounts[k]} {v.label.toLowerCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca indirizzo o nota…"
          style={{width:"100%",background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,color:T.text,padding:"9px 14px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["all","Tutti"],["mancata_raccolta","M. Raccolta"],["abbandono","Abbandono"],["da_pulire","Da pulire"],["altro","Altro"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilterTipo(k)}
              style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filterTipo===k?(TIPO_META[k]?.color||T.blue):T.border}`,background:filterTipo===k?(TIPO_META[k]?.bg||T.navActive):"transparent",color:filterTipo===k?(TIPO_META[k]?.color||T.blue):T.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["all","Tutti gli stati"],...Object.entries(TERR_STATUS).map(([k,v])=>[k,v.label])].map(([k,l])=>(
            <button key={k} onClick={()=>setFilterStatus(k)}
              style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filterStatus===k?(TERR_STATUS[k]?.color||T.blue):T.border}`,background:filterStatus===k?`${TERR_STATUS[k]?.color||T.blue}20`:"transparent",color:filterStatus===k?(TERR_STATUS[k]?.color||T.blue):T.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Card list */}
      {filtered.length === 0 ? (
        <div style={{textAlign:"center",padding:48,color:T.textDim,fontSize:14}}>Nessuna segnalazione trovata</div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {filtered.map(s => {
            const tm = TIPO_META[s.tipo] || TIPO_META.altro;
            const sm = TERR_STATUS[s.status] || TERR_STATUS.aperta;
            return (
              <div key={s.id} onClick={()=>setSelected(s)}
                style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",cursor:"pointer",display:"flex",boxShadow:"0 2px 8px rgba(0,0,0,0.12)",transition:"box-shadow 0.15s,transform 0.1s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 18px rgba(0,0,0,0.24)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.12)";e.currentTarget.style.transform="";}}>
                <div style={{width:5,background:tm.color,flexShrink:0}}/>
                <div style={{padding:"12px 14px",flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                    <span style={{padding:"2px 8px",borderRadius:10,background:tm.bg,color:tm.color,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{tm.label}</span>
                    <span style={{padding:"2px 8px",borderRadius:10,background:`${sm.color}18`,color:sm.color,fontSize:10,fontWeight:700}}>{sm.label}</span>
                    {(s.interventions||[]).length > 0 && (
                      <span style={{marginLeft:"auto",fontSize:10,color:T.teal,fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        {s.interventions.length}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {s.address || `${s.lat?.toFixed(5)}, ${s.lng?.toFixed(5)}`}
                  </div>
                  {s.note && <div style={{fontSize:11,color:T.textSub,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.note}</div>}
                  <div style={{fontSize:10,color:T.textDim,display:"flex",gap:8}}>
                    <span>{s.created_by_name}</span>
                    <span>{formatSegDate(s.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedFull && (
        <TerritorioDetail
          segnalazione={selectedFull}
          auth={auth}
          onClose={()=>setSelected(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

function TerritorioDetail({ segnalazione: s, auth, onClose, onRefresh }) {
  const [status,        setStatus]        = useState(s.status);
  const [statusLoading, setStatusLoading] = useState(false);
  const [note,          setNote]          = useState("");
  const [photo,         setPhoto]         = useState(null);
  const [sending,       setSending]       = useState(false);
  const [err,           setErr]           = useState(null);
  const fileRef = useRef(null);

  // Sync status when parent re-fetches
  useEffect(() => { setStatus(s.status); }, [s.status]);

  const tm = TIPO_META[s.tipo] || TIPO_META.altro;

  const changeStatus = async (newStatus) => {
    setStatusLoading(true);
    try {
      await fetch(`${API}/segnalazioni-territorio/${s.id}/status`, {
        method: "PATCH",
        headers: { Authorization:`Bearer ${auth.token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
      onRefresh();
    } finally {
      setStatusLoading(false);
    }
  };

  const addIntervento = async (e) => {
    e.preventDefault();
    if (!note.trim() && !photo) { setErr("Aggiungi una nota o una foto"); return; }
    setSending(true); setErr(null);
    try {
      const fd = new FormData();
      if (note.trim()) fd.append("note", note.trim());
      if (photo) fd.append("photo", photo);
      const r = await fetch(`${API}/segnalazioni-territorio/${s.id}/intervento`, {
        method: "POST",
        headers: { Authorization:`Bearer ${auth.token}` },
        body: fd,
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Errore");
      setNote(""); setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
      onRefresh();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSending(false);
    }
  };

  const interventions = s.interventions || [];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:3000,display:"flex",alignItems:"flex-end",justifyContent:"center",fontFamily:T.font}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",maxWidth:600,background:T.card,borderRadius:"16px 16px 0 0",border:`1px solid ${T.cardBorder}`,maxHeight:"90dvh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)"}}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:tm.color,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,color:T.text}}>{tm.label}</div>
            <div style={{fontSize:11,color:T.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.created_by_name} · {formatSegDate(s.created_at)}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textSub,cursor:"pointer",fontSize:22,lineHeight:1,padding:"4px 8px",flexShrink:0}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Location */}
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px"}}>
            <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6,fontWeight:700}}>Posizione</div>
            <div style={{fontSize:13,color:T.text,fontWeight:600,marginBottom:s.lat?4:0}}>{s.address||"—"}</div>
            {s.lat&&<div style={{fontSize:11,color:T.textDim,fontFamily:T.mono}}>{s.lat.toFixed(6)}, {s.lng.toFixed(6)}</div>}
          </div>

          {/* Note */}
          {s.note && (
            <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px"}}>
              <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6,fontWeight:700}}>Nota</div>
              <div style={{fontSize:13,color:T.text}}>{s.note}</div>
            </div>
          )}

          {/* Status buttons */}
          <div>
            <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8,fontWeight:700}}>Stato</div>
            <div style={{display:"flex",gap:8}}>
              {Object.entries(TERR_STATUS).map(([k,v])=>(
                <button key={k} onClick={()=>changeStatus(k)} disabled={statusLoading||status===k}
                  style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${status===k?v.color:T.border}`,background:status===k?`${v.color}20`:"transparent",color:status===k?v.color:T.textSub,fontSize:11,fontWeight:600,cursor:status===k||statusLoading?"default":"pointer",fontFamily:T.font,transition:"all 0.15s"}}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interventions timeline */}
          {interventions.length > 0 && (
            <div>
              <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:700}}>
                Interventi ({interventions.length})
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {interventions.map(int => (
                  <div key={int.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:(int.note||int.photo_url)?8:0}}>
                      <span style={{fontSize:12,fontWeight:600,color:T.text}}>{int.done_by_name}</span>
                      <span style={{fontSize:10,color:T.textDim}}>{formatSegDate(int.done_at)}</span>
                    </div>
                    {int.note && <div style={{fontSize:12,color:T.textSub,marginBottom:int.photo_url?8:0,lineHeight:1.5}}>{int.note}</div>}
                    {int.photo_url && (
                      <img src={int.photo_url} alt="Foto intervento"
                        style={{width:"100%",borderRadius:8,display:"block",cursor:"pointer",marginTop:2}}
                        onClick={()=>window.open(int.photo_url,"_blank")}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add intervention form */}
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:14}}>
            <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:700}}>Aggiungi intervento</div>
            <form onSubmit={addIntervento} style={{display:"flex",flexDirection:"column",gap:10}}>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
                placeholder="Descrivi l'intervento effettuato…"
                style={{width:"100%",background:"#1a2332",border:`1px solid #263d5a`,borderRadius:8,color:T.text,padding:"9px 12px",fontSize:13,fontFamily:T.font,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <button type="button" onClick={()=>fileRef.current.click()}
                  style={{padding:"8px 14px",background:"transparent",border:`1px solid ${photo?T.green:T.border}`,borderRadius:8,color:photo?T.green:T.textSub,fontSize:12,fontFamily:T.font,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {photo ? photo.name.slice(0,18)+"…" : "Allega foto"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0]||null)} style={{display:"none"}}/>
                {photo && (
                  <button type="button" onClick={()=>{setPhoto(null);if(fileRef.current)fileRef.current.value="";}}
                    style={{padding:"4px 8px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:T.textDim,fontSize:11,cursor:"pointer"}}>×</button>
                )}
                <button type="submit" disabled={sending}
                  style={{marginLeft:"auto",padding:"8px 20px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,fontSize:13,fontFamily:T.font,fontWeight:700,cursor:sending?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6}}>
                  {sending&&<span style={{display:"inline-block",width:12,height:12,border:`2px solid ${T.blue}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>}
                  Salva
                </button>
              </div>
              {err&&<div style={{fontSize:12,color:T.red}}>{err}</div>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BUG REPORT MODAL ─────────────────────────────────────────────────────────
function BugReportModal({auth,onClose}){
  const [form,setForm]=useState({title:"",category:"errore",description:"",steps:""});
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState(null);
  const inp={width:"100%",background:"#1a2332",border:`1px solid #263d5a`,borderRadius:8,color:"#e2eaf5",padding:"9px 12px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"};

  const submit=async(e)=>{
    e.preventDefault();
    if(!form.title.trim()||!form.description.trim()){setError("Titolo e descrizione obbligatori.");return;}
    setSending(true);setError(null);
    try{
      const r=await fetch(`${API}/bugs`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(form)});
      const d=await r.json();
      if(d.ok){setSent(true);setTimeout(onClose,2200);}
      else setError(d.error||"Errore nell'invio");
    }catch{setError("Errore di rete");}
    setSending(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(3px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0a1628",border:"1px solid #2e4a6a",borderRadius:16,width:"100%",maxWidth:520,boxShadow:"0 24px 80px rgba(0,0,0,0.7)",fontFamily:T.font}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #263d5a",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>🐛</span>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#e2eaf5"}}>Segnala un bug</div>
              <div style={{fontSize:11,color:"#7a9bbf",marginTop:1}}>Il report sarà inviato al team FleetCC</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#3d5a7a",cursor:"pointer",fontSize:18,lineHeight:1}}>✕</button>
        </div>

        {sent?(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:12}}>✅</div>
            <div style={{fontSize:15,fontWeight:600,color:"#4ade80"}}>Bug inviato, grazie!</div>
            <div style={{fontSize:12,color:"#7a9bbf",marginTop:6}}>Il team è stato notificato. Chiusura automatica…</div>
          </div>
        ):(
          <form onSubmit={submit} style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
            {error&&<div style={{background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:8,padding:"10px 14px",color:"#f87171",fontSize:13}}>{error}</div>}
            <div>
              <label style={{fontSize:11,color:"#7a9bbf",display:"block",marginBottom:5,fontWeight:600}}>Titolo *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Descrivi brevemente il problema" style={inp} required/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#7a9bbf",display:"block",marginBottom:5,fontWeight:600}}>Categoria</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inp}>
                <option value="errore">Errore / Crash</option>
                <option value="ui">Interfaccia (UI)</option>
                <option value="funzionalita">Funzionalità</option>
                <option value="performance">Performance</option>
                <option value="altro">Altro</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:"#7a9bbf",display:"block",marginBottom:5,fontWeight:600}}>Descrizione *</label>
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={4}
                placeholder="Cosa è successo? Qual era il comportamento atteso?" style={{...inp,resize:"vertical",lineHeight:1.5}} required/>
            </div>
            <div>
              <label style={{fontSize:11,color:"#7a9bbf",display:"block",marginBottom:5,fontWeight:600}}>Passi per riprodurre <span style={{fontWeight:400,color:"#3d5a7a"}}>(opzionale)</span></label>
              <textarea value={form.steps} onChange={e=>setForm(f=>({...f,steps:e.target.value}))} rows={3}
                placeholder={"1. Vai su...\n2. Clicca su...\n3. Vedi l'errore"} style={{...inp,resize:"vertical",lineHeight:1.5}}/>
            </div>
            <div style={{display:"flex",gap:10,paddingTop:4}}>
              <button type="submit" disabled={sending}
                style={{flex:1,padding:"11px",background:sending?"#1a2332":"#0f2540",border:"1px solid #60a5fa55",borderRadius:8,color:sending?"#3d5a7a":"#60a5fa",cursor:sending?"not-allowed":"pointer",fontSize:14,fontFamily:T.font,fontWeight:600}}>
                {sending?"Invio in corso…":"Invia bug report"}
              </button>
              <button type="button" onClick={onClose}
                style={{padding:"11px 18px",background:"transparent",border:"1px solid #263d5a",borderRadius:8,color:"#7a9bbf",cursor:"pointer",fontSize:14,fontFamily:T.font}}>
                Annulla
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── NAV DEFINITION (7 top-level items) ───────────────────────────────────────
const NAV_DEF=[
  {id:"home",      label:"Dashboard",  short:"Home",      icon:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10", module:null},
  {id:"gps",       label:"GPS Live",   short:"GPS",       icon:"M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13 M15 7v13",          module:"gps"},
  {id:"editors",   label:"Editori",    short:"Editori",   icon:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",        module:"gps"},
  {id:"operativo", label:"Operativo",  short:"Operativo", icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", module:null},
  {id:"analytics", label:"Analytics",  short:"Analytics", icon:"M18 20V10 M12 20V4 M6 20v-6",                                    module:null},
  {id:"fleet",     label:"Flotta",     short:"Flotta",    icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6",                             modules:["fuel","suppliers","costs"]},
  {id:"territorio",label:"Territorio", short:"Territorio",icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", module:"gps"},
  {id:"admin",     label:"Admin",      short:"Admin",     icon:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z", module:"admin"},
];

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard(){
  const {auth,logout}=useAuth();
  const {can}=usePerms();
  const isMobile=useIsMobile();
  const [active,setActive]=useState("home");
  const [selectedVehicle,setSelectedVehicle]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [showBugModal,setShowBugModal]=useState(false);
  const {data:vehicles}=useApi("/gps/vehicles",{pollMs:10000,skip:!can("gps")});

  const role=auth.user?.role;
  const isSuperAdmin=role==="superadmin";
  const isCompanyAdmin=role==="company_admin";

  // filter nav by permissions
  const nav=NAV_DEF.filter(n=>{
    // superadmin: admin only (no company data)
    if(isSuperAdmin) return n.id==="admin";
    // company_admin: admin + all modules enabled in their tenant
    if(isCompanyAdmin) return n.id==="admin"||n.module===null||can(n.module)||n.modules?.some(m=>can(m));
    // regular roles: permission-based filter
    if(n.module===null&&!n.modules)return true;
    if(n.module)return can(n.module);
    if(n.modules)return n.modules.some(m=>can(m));
    return true;
  });

  useEffect(()=>{ if(nav.length&&!nav.find(n=>n.id===active))setActive(nav[0].id); },[nav,active]);
  const handleSetActive=(id)=>{ setSelectedVehicle(null); setActive(id); };

  const counts=vehicles?{
    active:vehicles.filter(v=>v.status==="active").length,
    idle:vehicles.filter(v=>v.status==="idle").length,
    workshop:vehicles.filter(v=>v.status==="workshop").length,
  }:{active:"—",idle:"—",workshop:"—"};

  const renderModule=()=>{
    if(selectedVehicle) return <VehicleDetail vehicle={selectedVehicle} onBack={()=>setSelectedVehicle(null)}/>;
    // Role-based admin panel routing
    const adminPanel=isSuperAdmin
      ? <SuperAdminDashboard/>
      : isCompanyAdmin
        ? <CompanyAdminPanel/>
        : <AdminPanel/>;
    // superadmin sees a special analytics (platform-level), others see regular analytics
    const analyticsPanel=isSuperAdmin
      ? <SuperAdminAnalytics/>
      : <AnalyticsModule onSelectVehicle={setSelectedVehicle}/>;
    const map={
      home:<HomeModule onSelectVehicle={setSelectedVehicle}/>,
      gps:<GPSModule mode="live" onSelectVehicle={setSelectedVehicle}/>,
      editors:<GPSModule mode="editors" onSelectVehicle={setSelectedVehicle}/>,
      operativo:<OperativoModule/>,
      analytics:analyticsPanel,
      fleet:<FlottaModule/>,
      territorio:<TerritorioModule/>,
      admin:adminPanel,
    };
    return map[active]||null;
  };

  const handleLogout=async()=>{
    try{await fetch(`${API}/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`}});}catch{}
    logout();await msalInstance.clearCache();await msalInstance.logoutRedirect({postLogoutRedirectUri:window.location.origin});
  };

  const W=sidebarOpen?210:60;
  const currentNav=nav.find(n=>n.id===active);

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if(isMobile){
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:T.bg,fontFamily:T.font,color:T.text,overflow:"hidden"}}>
        {/* Mobile top header */}
        <div style={{background:T.sidebar,borderBottom:`1px solid ${T.border}`,padding:"0 16px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <FleetLogo size={26}/>
            <div style={{fontSize:14,fontWeight:800,color:T.text,letterSpacing:-0.3}}>Fleet<span style={{color:T.green}}>CC</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {currentNav&&<span style={{fontSize:13,fontWeight:600,color:T.textSub}}>{selectedVehicle?selectedVehicle.name:currentNav.label}</span>}
            <div style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#000",flexShrink:0}}>
              {auth.user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px",paddingBottom:72,background:T.bg}}>
          {renderModule()}
        </div>

        {/* Mobile bottom tab bar */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:T.sidebar,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"stretch",zIndex:200,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {nav.filter(n=>n.id!=="editors").map(n=>{
            const isActive=active===n.id;
            return(
              <button key={n.id} onClick={()=>handleSetActive(n.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,border:"none",background:"transparent",color:isActive?T.blue:T.textDim,cursor:"pointer",fontFamily:T.font,padding:"4px 2px",position:"relative"}}>
                {isActive&&<div style={{position:"absolute",top:0,left:"25%",right:"25%",height:2,background:T.blue,borderRadius:"0 0 2px 2px"}}/>}
                <Icon d={n.icon} size={18}/>
                <span style={{fontSize:9,fontWeight:isActive?700:400,letterSpacing:0.2,whiteSpace:"nowrap"}}>{n.short}</span>
              </button>
            );
          })}
        </div>

        {showBugModal&&<BugReportModal auth={auth} onClose={()=>setShowBugModal(false)}/>}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return(
    <div style={{display:"flex",height:"100vh",background:T.bg,fontFamily:T.font,color:T.text,overflow:"hidden"}}>
      {/* ── SIDEBAR ── */}
      <div style={{width:W,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s ease",overflow:"hidden"}}>

        {/* Logo */}
        <div style={{padding:sidebarOpen?"16px 16px":"16px 0",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:10,flexShrink:0}}>
          <FleetLogo size={32}/>
          {sidebarOpen&&(
            <div style={{minWidth:0}}>
              <div style={{fontSize:15,fontWeight:800,color:T.text,letterSpacing:-0.3,whiteSpace:"nowrap"}}>Fleet<span style={{color:T.green}}>CC</span></div>
              <div style={{fontSize:9,color:T.textDim,letterSpacing:1.2,textTransform:"uppercase",marginTop:1}}>Command Center</div>
            </div>
          )}
        </div>

        {/* User info */}
        {sidebarOpen&&(
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.green})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700,color:"#000"}}>
                {auth.user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{auth.user.name}</div>
                <div style={{fontSize:10,color:T.textDim}}>{roleLabel[auth.user.role]||auth.user.role}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav style={{flex:1,padding:sidebarOpen?"10px 8px":"10px 4px",overflowY:"auto"}}>
          {sidebarOpen&&<div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:1.2,padding:"6px 8px 8px",fontWeight:700}}>Menu</div>}
          {nav.map(n=>{
            const isActive=active===n.id;
            return(
              <button key={n.id} onClick={()=>handleSetActive(n.id)} title={!sidebarOpen?n.label:""}
                style={{width:"100%",display:"flex",alignItems:"center",gap:sidebarOpen?10:0,justifyContent:sidebarOpen?"flex-start":"center",padding:sidebarOpen?"9px 10px":"9px 0",borderRadius:8,border:"none",cursor:"pointer",marginBottom:2,background:isActive?T.navActive:"transparent",color:isActive?T.blue:T.textSub,transition:"all 0.12s",textAlign:"left",fontFamily:T.font,position:"relative"}}>
                <span style={{color:isActive?T.blue:T.textDim,flexShrink:0}}><Icon d={n.icon} size={16}/></span>
                {sidebarOpen&&<span style={{fontSize:13,fontWeight:isActive?600:400,whiteSpace:"nowrap"}}>{n.label}</span>}
                {sidebarOpen&&isActive&&<div style={{marginLeft:"auto",width:3,height:16,borderRadius:2,background:T.blue,flexShrink:0}}/>}
              </button>
            );
          })}
        </nav>

        {/* Fleet status (expanded only) */}
        {sidebarOpen&&can("gps")&&(
          <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8,fontWeight:700}}>Flotta live</div>
            {[["active",T.green,"Attivi"],["idle",T.yellow,"Fermi"],["workshop",T.red,"Officina"]].map(([k,col,l])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:col}}/>
                  <span style={{fontSize:11,color:T.textSub}}>{l}</span>
                </div>
                <span style={{fontSize:12,color:col,fontFamily:T.mono,fontWeight:600}}>{counts[k]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Collapse toggle + logout */}
        <div style={{padding:sidebarOpen?"0 8px 10px":"0 4px 10px",flexShrink:0,borderTop:`1px solid ${T.border}`}}>
          <button onClick={()=>setSidebarOpen(v=>!v)} title={sidebarOpen?"Comprimi sidebar":"Espandi sidebar"}
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:8,padding:sidebarOpen?"8px 10px":"8px 0",marginTop:8,background:"transparent",border:"none",borderRadius:8,color:T.textDim,cursor:"pointer",fontFamily:T.font,fontSize:12,transition:"all 0.12s"}}>
            <Icon d={sidebarOpen?"M11 19l-7-7 7-7 M18 19l-7-7 7-7":"M13 5l7 7-7 7 M6 5l7 7-7 7"} size={14}/>
            {sidebarOpen&&"Comprimi"}
          </button>
          <button onClick={()=>setShowBugModal(true)}
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:8,padding:sidebarOpen?"8px 10px":"8px 0",background:"transparent",border:`1px solid #3a1a1a`,borderRadius:8,color:"#f87171",cursor:"pointer",fontFamily:T.font,fontSize:12,marginTop:4,transition:"all 0.12s"}}
            title={!sidebarOpen?"Segnala un bug":""}>
            <span style={{fontSize:13}}>🐛</span>
            {sidebarOpen&&"Segnala un bug"}
          </button>
          <button onClick={handleLogout}
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:8,padding:sidebarOpen?"8px 10px":"8px 0",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSub,cursor:"pointer",fontFamily:T.font,fontSize:12,marginTop:4,transition:"all 0.12s"}}
            title={!sidebarOpen?"Esci":""}>
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" size={14}/>
            {sidebarOpen&&"Esci"}
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Top bar */}
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.sidebar,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {currentNav&&<span style={{color:T.textDim}}><Icon d={currentNav.icon} size={16}/></span>}
            <div>
              <div style={{fontSize:16,fontWeight:700,color:T.text}}>{selectedVehicle?selectedVehicle.name:(currentNav?.label||"")}</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{auth.tenant?.name} · {auth.tenant?.city}</div>
            </div>
          </div>
          <div style={{fontSize:12,color:T.textDim,fontFamily:T.mono}}>
            {new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,padding:"24px 28px",overflowY:"auto",background:T.bg}}>
          {renderModule()}
        </div>
      </div>

      {/* ── Bug Report Modal ── */}
      {showBugModal&&<BugReportModal auth={auth} onClose={()=>setShowBugModal(false)}/>}
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
function AppInner(){
  const{auth,login}=useAuth();
  const[redirecting,setRedirecting]=useState(true);
  useEffect(()=>{
    msalInstance.initialize().then(()=>msalInstance.handleRedirectPromise())
      .then(async result=>{
        if(result?.idToken){
          try{
            const res=await fetch(`${API}/auth/azure`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_token:result.idToken})});
            const data=await res.json();if(data.ok)login(data.token,data.user,data.tenant);
          }catch{}
        }
      })
      .catch(()=>{}).finally(()=>setRedirecting(false));
  },[login]);

  if(redirecting) return(
    <div style={{height:"100vh",background:T.sidebar,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,color:T.textSub,fontSize:13}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><FleetLogo size={28}/><span>Caricamento...</span></div>
    </div>
  );
  return auth?<Dashboard/>:<LoginScreen/>;
}

export default function App(){
  return(
    <AuthProvider>
      <PermProvider>
        <AppInner/>
      </PermProvider>
    </AuthProvider>
  );
}
