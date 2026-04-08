import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { msalInstance, loginRequest } from "./msalConfig.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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
const levelColor={none:"#3a5a7a",view:"#60a5fa",edit:"#facc15",full:"#4ade80"};

const Icon=({d,size=18})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
function Spinner(){return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:120,color:T.textSub,fontSize:13,fontFamily:T.font}}>Caricamento...</div>;}
function ApiError({error,onRetry}){return<div style={{background:"#1a0a0a",border:"1px solid #4a1a1a",borderRadius:10,padding:"16px 20px",color:T.red,fontSize:13,fontFamily:T.font}}><div style={{fontWeight:600,marginBottom:4}}>Errore API</div><div style={{fontSize:11,color:"#7a3a3a",marginBottom:10}}>{error}</div>{onRetry&&<button onClick={onRetry} style={{background:"#2a0a0a",border:"1px solid #4a1a1a",borderRadius:6,color:T.red,padding:"5px 12px",cursor:"pointer",fontSize:12}}>Riprova</button>}</div>;}

// ─── FLEETCC LOGO ─────────────────────────────────────────────────────────────
function FleetLogo({size=36}){
  const id=`grad${size}`;
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
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(false);
  const handleMicrosoftLogin=async()=>{
    setLoading(true);setError(null);
    try{ await msalInstance.loginRedirect(loginRequest); }
    catch(e){ setError(e?.message||e?.errorCode||"Accesso non riuscito"); setLoading(false); }
  };
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
function FleetMap({vehicles,routes,visibleRoutes,editMode,editWaypoints,editColor,onMapClick,onWaypointMove,onWaypointDelete}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const routeLayerRef=useRef(null);
  const vehicleLayerRef=useRef(null);
  const editLayerRef=useRef(null);
  const cbClick=useRef(onMapClick);
  const cbMove=useRef(onWaypointMove);
  const cbDel=useRef(onWaypointDelete);
  useEffect(()=>{cbClick.current=onMapClick;},[onMapClick]);
  useEffect(()=>{cbMove.current=onWaypointMove;},[onWaypointMove]);
  useEffect(()=>{cbDel.current=onWaypointDelete;},[onWaypointDelete]);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);
    routeLayerRef.current=L.layerGroup().addTo(map);
    vehicleLayerRef.current=L.layerGroup().addTo(map);
    editLayerRef.current=L.layerGroup().addTo(map);
    map.on("click",(e)=>{ if(cbClick.current)cbClick.current([e.latlng.lat,e.latlng.lng]); });
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    if(!mapRef.current)return;
    mapRef.current.getContainer().style.cursor=editMode?"crosshair":"";
  },[editMode]);

  useEffect(()=>{
    if(!mapRef.current||!routes||!routeLayerRef.current)return;
    routeLayerRef.current.clearLayers();
    routes.forEach(r=>{
      const opacity=editMode?0.2:(visibleRoutes[r.id]?0.85:0);
      if(opacity===0)return;
      const line=L.polyline(r.waypoints,{color:r.color,weight:4,opacity,dashArray:r.status==="pianificato"?"10 7":null});
      if(!editMode)line.bindTooltip(`<b>${r.name}</b><br>${r.vehicle} · ${r.stops} fermate`,{sticky:true});
      routeLayerRef.current.addLayer(line);
    });
  },[routes,visibleRoutes,editMode]);

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
    L.polyline(editWaypoints,{color,weight:4,opacity:0.9}).addTo(editLayerRef.current);
    editWaypoints.forEach((wp,idx)=>{
      const m=L.marker([wp[0],wp[1]],{
        icon:L.divIcon({className:"",html:`<div style="width:18px;height:18px;background:${color};border:2px solid #000;border-radius:50%;cursor:grab;box-shadow:0 0 6px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#000">${idx+1}</div>`,iconSize:[18,18],iconAnchor:[9,9]}),
        draggable:true,zIndexOffset:1000,
      });
      m.on("dragend",(e)=>{ const{lat,lng}=e.target.getLatLng(); if(cbMove.current)cbMove.current(idx,[lat,lng]); });
      m.on("click",(e)=>{ L.DomEvent.stopPropagation(e); if(cbDel.current)cbDel.current(idx); });
      editLayerRef.current.addLayer(m);
    });
  },[editMode,editWaypoints,editColor]);

  return <div ref={containerRef} style={{height:"100%",width:"100%"}}/>;
}

// ─── GPS MODULE ───────────────────────────────────────────────────────────────
const EMPTY_META={name:"",color:"#4ade80",sector:"",vehicle:"",status:"pianificato",stops:0};

function GPSModule({onSelectVehicle}){
  const {auth}=useAuth();
  const {can}=usePerms();
  const {data:vehicles,loading,error,refetch}=useApi("/gps/vehicles",{pollMs:10000});
  const [routes,setRoutes]=useState(null);
  const [visibleRoutes,setVisibleRoutes]=useState({});
  const [tab,setTab]=useState("live");
  const [editingId,setEditingId]=useState(null);
  const [editWaypoints,setEditWaypoints]=useState([]);
  const [meta,setMeta]=useState(EMPTY_META);
  const [saving,setSaving]=useState(false);

  const loadRoutes=useCallback(async()=>{
    try{
      const r=await fetch(`${API}/gps/routes`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await r.json();
      if(d.ok){setRoutes(d.data);setVisibleRoutes(prev=>{const n={...prev};d.data.forEach(r=>{if(!(r.id in n))n[r.id]=true;});return n;});}
    }catch{}
  },[auth.token]);
  useEffect(()=>{loadRoutes();},[loadRoutes]);

  const toggleRoute=(id)=>setVisibleRoutes(prev=>({...prev,[id]:!prev[id]}));
  const startEdit=(r)=>{setEditingId(r.id);setEditWaypoints(r.waypoints.map(wp=>[...wp]));setMeta({name:r.name,color:r.color,sector:r.sector||"",vehicle:r.vehicle||"",status:r.status,stops:r.stops||0});};
  const startNew=()=>{setEditingId("new");setEditWaypoints([]);setMeta({...EMPTY_META});};
  const cancelEdit=()=>{setEditingId(null);setEditWaypoints([]);setMeta(EMPTY_META);};
  const handleMapClick=useCallback((latlng)=>{ if(editingId!==null)setEditWaypoints(prev=>[...prev,latlng]); },[editingId]);
  const handleWaypointMove=useCallback((idx,latlng)=>{ setEditWaypoints(prev=>prev.map((wp,i)=>i===idx?latlng:wp)); },[]);
  const handleWaypointDelete=useCallback((idx)=>{ setEditWaypoints(prev=>prev.filter((_,i)=>i!==idx)); },[]);

  const saveRoute=async()=>{
    if(!meta.name.trim()||editWaypoints.length<2)return;
    setSaving(true);
    try{
      const body={...meta,waypoints:editWaypoints,stops:Number(meta.stops)};
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
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font,outline:"none",boxSizing:"border-box"};

  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;

  const gpsTabs=[
    {id:"live",label:"GPS Live",icon:"M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0 M12 7v5l3 3"},
    {id:"editor",label:"Editor Percorsi",icon:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)",fontFamily:T.font}}>
      <div style={{display:"flex",alignItems:"center",gap:0,flexShrink:0}}>
        <TabBar tabs={gpsTabs} active={tab} onChange={(t)=>{setTab(t);cancelEdit();}}/>
        <div style={{marginLeft:"auto",marginBottom:20,display:"flex",gap:8}}>
          {tab==="editor"&&canEdit&&!editingId&&(
            <button onClick={startNew} style={{padding:"7px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>+ Nuovo percorso</button>
          )}
          {tab==="editor"&&editingId&&(
            <span style={{fontSize:11,color:T.textSub,display:"flex",alignItems:"center"}}>Click mappa → aggiungi · Click punto → rimuovi · Trascina → sposta</span>
          )}
        </div>
      </div>

      <div style={{display:"flex",gap:16,flex:1,minHeight:0}}>
        {tab==="editor"&&!editingId&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
            {(routes||[]).length===0&&<div style={{fontSize:13,color:T.textDim,textAlign:"center",marginTop:20}}>Nessun percorso</div>}
            {(routes||[]).map(r=>(
              <div key={r.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:r.color,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:600,color:T.text,flex:1}}>{r.name}</span>
                  <span style={{fontSize:9,color:r.status==="in_corso"?T.green:T.blue,background:r.status==="in_corso"?"#0d2e0d":"#0a1e30",padding:"2px 6px",borderRadius:4,fontWeight:600}}>{r.status==="in_corso"?"In corso":"Pianif."}</span>
                </div>
                <div style={{fontSize:11,color:T.textSub,marginBottom:10}}>{r.vehicle||"—"} · {r.waypoints.length} punti · {r.stops} fermate</div>
                <div style={{display:"flex",gap:6}}>
                  {canEdit&&<button onClick={()=>startEdit(r)} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"5px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Modifica</button>}
                  {canEdit&&<button onClick={()=>deleteRoute(r.id)} style={{background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:6,color:T.red,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Elimina</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{flex:1,borderRadius:12,border:`1px solid ${T.border}`,position:"relative",overflow:"hidden"}}>
          <FleetMap
            vehicles={vehicles} routes={routes||[]} visibleRoutes={visibleRoutes}
            editMode={editorActive} editWaypoints={editWaypoints} editColor={meta.color}
            onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onWaypointDelete={handleWaypointDelete}
          />
          {tab==="live"&&routes&&(
            <div style={{position:"absolute",top:12,right:12,zIndex:1000,background:"rgba(13,27,42,0.95)",border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px",minWidth:200,backdropFilter:"blur(8px)"}}>
              <div style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:1,marginBottom:10,fontWeight:600}}>Percorsi raccolta</div>
              {routes.map(r=>(
                <div key={r.id} onClick={()=>toggleRoute(r.id)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,cursor:"pointer",opacity:visibleRoutes[r.id]?1:0.35,transition:"opacity 0.15s"}}>
                  <div style={{width:24,height:3,background:r.color,borderRadius:2,flexShrink:0}}/>
                  <span style={{fontSize:12,color:T.text,flex:1}}>{r.name}</span>
                  <span style={{fontSize:9,color:r.status==="in_corso"?T.green:T.blue,padding:"1px 6px",borderRadius:3,fontWeight:600,background:r.status==="in_corso"?"#0d2e0d":"#0a1e30"}}>{r.status==="in_corso"?"In corso":"Pianif."}</span>
                </div>
              ))}
              <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,fontSize:10,color:T.textDim}}>Click per mostrare/nascondere</div>
            </div>
          )}
          {tab==="live"&&<div style={{position:"absolute",bottom:10,left:10,zIndex:1000,fontSize:10,color:T.textSub,fontFamily:T.mono,background:"rgba(13,27,42,0.85)",padding:"4px 10px",borderRadius:6}}>Aggiornamento ogni 10s · Visirun mock</div>}
        </div>

        {tab==="live"&&(
          <div style={{width:240,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
            {vehicles&&vehicles.map(v=>(
              <div key={v.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:T.text}}>{v.name}</span>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:600}}>{statusLabel[v.status]}</span>
                </div>
                <div style={{fontSize:11,color:T.textSub,marginBottom:8}}>{v.plate} · {v.sector||"—"}</div>
                {v.fuel_pct!=null&&<>
                  <div style={{height:4,background:T.border,borderRadius:2,marginBottom:2}}>
                    <div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?T.red:T.green,borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:10,color:T.textDim,marginBottom:8}}>Carburante: {v.fuel_pct}%</div>
                </>}
                <button onClick={()=>onSelectVehicle(v)} style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"6px",cursor:"pointer",fontSize:12,fontFamily:T.font}}>Dettaglio →</button>
              </div>
            ))}
          </div>
        )}

        {tab==="editor"&&editingId&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:16}}>{editingId==="new"?"Nuovo percorso":"Modifica percorso"}</div>
              {[["Nome","name","text"],["Veicolo","vehicle","text"],["Settore","sector","text"],["Fermate","stops","number"]].map(([lbl,key,type])=>(
                <div key={key} style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>{lbl}</div>
                  <input type={type} value={meta[key]} onChange={e=>setMeta(m=>({...m,[key]:e.target.value}))} style={inp}/>
                </div>
              ))}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:8,fontWeight:600}}>Colore</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["#4ade80","#60a5fa","#fb923c","#c084fc","#f9a8d4","#facc15","#f87171","#34d399"].map(c=>(
                    <div key={c} onClick={()=>setMeta(m=>({...m,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,border:meta.color===c?"3px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0,boxShadow:meta.color===c?"0 0 0 1px #000":"none"}}/>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,color:T.textSub,marginBottom:4,fontWeight:600}}>Stato</div>
                <select value={meta.status} onChange={e=>setMeta(m=>({...m,status:e.target.value}))} style={inp}>
                  <option value="pianificato">Pianificato</option>
                  <option value="in_corso">In corso</option>
                </select>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WORKSHOP ORDERS (no internal tabs — tabs handled by OperativoModule) ─────
function WorkshopModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const {data:orders,loading,error,refetch}=useApi("/workshop/orders");
  const canEdit=can("workshop","edit");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,fontFamily:T.font}}>
      {!canEdit&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 16px",fontSize:12,color:T.textSub}}>👁 Solo lettura — il tuo ruolo non permette modifiche</div>}
      <div style={{display:"flex",gap:12}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
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
              {s.photo_url&&<div style={{marginBottom:10}}><img src={`http://localhost:3001${s.photo_url}`} alt="foto" style={{maxHeight:220,maxWidth:"100%",borderRadius:8,border:`1px solid ${T.border}`,display:"block",cursor:"pointer"}} onClick={()=>window.open(`http://localhost:3001${s.photo_url}`,"_blank")}/></div>}
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
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:T.bg}}>{["Data","Veicolo","Litri","Costo","KM","Stazione"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>)}</tr></thead>
          <tbody>{entries.map((e,i)=><tr key={i} style={{borderTop:`1px solid ${T.border}`}}>
            <td style={{padding:"12px 16px",color:T.textSub,fontFamily:T.mono,fontSize:12}}>{e.date}</td>
            <td style={{padding:"12px 16px",color:T.text,fontWeight:500}}>{e.vehicle}</td>
            <td style={{padding:"12px 16px",color:T.green,fontFamily:T.mono}}>{e.liters} L</td>
            <td style={{padding:"12px 16px",color:T.green,fontFamily:T.mono}}>€{e.cost_eur}</td>
            <td style={{padding:"12px 16px",color:T.text+"88",fontFamily:T.mono}}>{e.km}</td>
            <td style={{padding:"12px 16px",color:T.textSub}}>{e.station}</td>
          </tr>)}</tbody>
        </table>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:10}}>
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
      {can("costs")&&costs&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Costi mensili</div>
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:T.bg}}>{["Mese","Carburante","Manutenzione","Altro","Totale"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:h==="Mese"?"left":"right",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>)}</tr></thead>
              <tbody>{costs.map(c=>(
                <tr key={c.month} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"12px 16px",color:T.textSub,fontFamily:T.mono}}>{c.month}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.green,fontFamily:T.mono}}>€{c.fuel}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.blue,fontFamily:T.mono}}>€{c.maintenance}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.yellow,fontFamily:T.mono}}>€{c.other}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.text,fontFamily:T.mono,fontWeight:700}}>€{c.total}</td>
                </tr>
              ))}</tbody>
            </table>
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

// ─── NAV DEFINITION (6 top-level items) ───────────────────────────────────────
const NAV_DEF=[
  {id:"home",      label:"Dashboard",  short:"Home",      icon:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10", module:null},
  {id:"gps",       label:"GPS Live",   short:"GPS",       icon:"M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13 M15 7v13",          module:"gps"},
  {id:"operativo", label:"Operativo",  short:"Operativo", icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", module:null},
  {id:"analytics", label:"Analytics",  short:"Analytics", icon:"M18 20V10 M12 20V4 M6 20v-6",                                    module:null},
  {id:"fleet",     label:"Flotta",     short:"Flotta",    icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6",                             modules:["fuel","suppliers","costs"]},
  {id:"admin",     label:"Admin",      short:"Admin",     icon:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z", module:"admin"},
];

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard(){
  const {auth,logout}=useAuth();
  const {can}=usePerms();
  const [active,setActive]=useState("home");
  const [selectedVehicle,setSelectedVehicle]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const {data:vehicles}=useApi("/gps/vehicles",{pollMs:10000,skip:!can("gps")});

  // filter nav by permissions
  const nav=NAV_DEF.filter(n=>{
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
    const map={
      home:<HomeModule onSelectVehicle={setSelectedVehicle}/>,
      gps:<GPSModule onSelectVehicle={setSelectedVehicle}/>,
      operativo:<OperativoModule/>,
      analytics:<AnalyticsModule onSelectVehicle={setSelectedVehicle}/>,
      fleet:<FlottaModule/>,
      admin:<AdminPanel/>,
    };
    return map[active]||null;
  };

  const handleLogout=async()=>{
    try{await fetch(`${API}/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`}});}catch{}
    logout();await msalInstance.clearCache();await msalInstance.logoutRedirect({postLogoutRedirectUri:window.location.origin});
  };

  const W=sidebarOpen?210:60;
  const currentNav=nav.find(n=>n.id===active);

  return(
    <div style={{display:"flex",height:"100vh",background:T.bg,fontFamily:T.font,color:T.text,overflow:"hidden"}}>
      {/* ── SIDEBAR ── */}
      <div style={{width:W,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width 0.2s ease",overflow:"hidden"}}>

        {/* Logo */}
        <div style={{padding:sidebarOpen?"18px 16px 16px":"14px 0 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-start":"center",gap:10,flexShrink:0}}>
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
        <div style={{padding:"14px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.sidebar,flexShrink:0}}>
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
