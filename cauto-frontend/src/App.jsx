import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { msalInstance, loginRequest } from "./msalConfig.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(false);

  const handleMicrosoftLogin=async()=>{
    setLoading(true);setError(null);
    try{
      await msalInstance.loginRedirect(loginRequest);
      // page navigates away — nothing runs after this
    }catch(e){
      setError(e?.message||e?.errorCode||"Accesso non riuscito");
      setLoading(false);
    }
  };

  return(
    <div style={{height:"100vh",background:"#060f06",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New', monospace"}}>
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",opacity:0.04,pointerEvents:"none"}}><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4ade80" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
      <div style={{width:360}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:28,fontWeight:700,color:"#4ade80",letterSpacing:6,textTransform:"uppercase"}}>FleetCC</div>
          <div style={{fontSize:11,color:"#2a5a2a",letterSpacing:2,marginTop:4}}>FLEET COMMAND CENTER</div>
        </div>
        <div style={{background:"#080f08",border:"1px solid #1a3a1a",borderRadius:12,padding:32}}>
          <div style={{fontSize:13,color:"#4a7a4a",marginBottom:28,textAlign:"center"}}>Accesso operatori</div>
          {error&&<div style={{background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:6,padding:"8px 12px",color:"#f87171",fontSize:12,marginBottom:16}}>{error}</div>}
          <button onClick={handleMicrosoftLogin} disabled={loading}
            style={{width:"100%",background:loading?"#1a2a3a":"#0a1e30",border:"1px solid #1a4a6a",borderRadius:6,color:loading?"#4a7a9a":"#60a5fa",padding:"12px 16px",fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            {/* Microsoft logo */}
            {!loading&&<svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>}
            {loading?"Accesso in corso...":"Accedi con Microsoft"}
          </button>
          <div style={{textAlign:"center",marginTop:16,fontSize:11,color:"#2a4a2a"}}>Usa il tuo account @cauto.it</div>
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:10,color:"#1a3a1a"}}>Fleet Command Center · Ferrara · v0.1.0</div>
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

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Back button */}
      <button onClick={onBack} style={{alignSelf:"flex-start",display:"flex",alignItems:"center",gap:6,background:"transparent",border:"1px solid #1a3a1a",borderRadius:6,color:"#4a7a4a",padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
        <Icon d="M19 12H5 M12 19l-7-7 7-7" size={14}/> Torna indietro
      </button>

      {/* Vehicle header */}
      <div style={{background:"#0a1a0a",border:`1px solid ${statusColor[vehicle.status]}44`,borderRadius:10,padding:"20px 24px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:"#d1fae5"}}>{vehicle.name}</div>
            <div style={{fontSize:13,color:"#4a7a4a",marginTop:4,fontFamily:"monospace"}}>{vehicle.plate}</div>
          </div>
          <span style={{fontSize:12,padding:"5px 12px",borderRadius:6,background:statusColor[vehicle.status]+"22",color:statusColor[vehicle.status],fontWeight:700,border:`1px solid ${statusColor[vehicle.status]}44`}}>
            {statusLabel[vehicle.status]}
          </span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginTop:20}}>
          {[
            ["Settore",    vehicle.sector||"—",    null],
            ["Velocità",   vehicle.speed_kmh>0?`${vehicle.speed_kmh} km/h`:"Fermo", null],
            ["Coordinate", vehicle.lat&&vehicle.lng?`${vehicle.lat.toFixed(3)}, ${vehicle.lng.toFixed(3)}`:"—", null],
          ].map(([label,value])=>(
            <div key={label} style={{background:"#060f06",borderRadius:6,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"#3a6a3a",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
              <div style={{fontSize:13,color:"#d1fae5",fontFamily:"monospace"}}>{value}</div>
            </div>
          ))}
          {vehicle.fuel_pct!=null&&(
            <div style={{background:"#060f06",borderRadius:6,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"#3a6a3a",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Carburante</div>
              <div style={{height:6,background:"#1a3a1a",borderRadius:3,marginBottom:4}}>
                <div style={{height:"100%",width:`${vehicle.fuel_pct}%`,background:vehicle.fuel_pct<20?"#f87171":"#4ade80",borderRadius:3,transition:"width 0.3s"}}/>
              </div>
              <div style={{fontSize:13,color:vehicle.fuel_pct<20?"#f87171":"#4ade80",fontFamily:"monospace"}}>{vehicle.fuel_pct}%</div>
            </div>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Workshop history */}
        {can("workshop")&&(
          <div>
            <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Storico officina</div>
            {vOrders.length===0
              ? <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"20px",fontSize:12,color:"#2a4a2a",textAlign:"center"}}>Nessun ordine trovato</div>
              : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {vOrders.map(o=>(
                    <div key={o.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{o.type}</span>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:statusColor[o.status]+"22",color:statusColor[o.status],fontWeight:600}}>{statusLabel[o.status]}</span>
                      </div>
                      <div style={{fontSize:11,color:"#4a7a4a",marginBottom:4}}>{o.notes}</div>
                      <div style={{fontSize:10,color:"#3a6a3a"}}>{o.mechanic?`👤 ${o.mechanic}`:""}{o.eta?` · ETA ${o.eta}`:""}</div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* Fuel history */}
        {can("fuel")&&(
          <div>
            <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Storico carburante</div>
            {vFuel.length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{flex:1,background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:6,padding:"8px 12px"}}>
                  <div style={{fontSize:10,color:"#3a6a3a",marginBottom:2}}>Litri totali</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>{totalLiters} L</div>
                </div>
                <div style={{flex:1,background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:6,padding:"8px 12px"}}>
                  <div style={{fontSize:10,color:"#3a6a3a",marginBottom:2}}>Costo totale</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>€{totalFuelCost.toFixed(2)}</div>
                </div>
              </div>
            )}
            {vFuel.length===0
              ? <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"20px",fontSize:12,color:"#2a4a2a",textAlign:"center"}}>Nessun rifornimento trovato</div>
              : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {vFuel.map((e,i)=>(
                    <div key={i} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:12,color:"#d1fae5",fontFamily:"monospace"}}>{e.date}</div>
                        <div style={{fontSize:11,color:"#4a7a4a",marginTop:2}}>{e.station}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#4ade80",fontFamily:"monospace"}}>{e.liters} L</div>
                        <div style={{fontSize:11,color:"#3a6a3a"}}>€{e.cost_eur}</div>
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

// ─── GPS MAP (vanilla Leaflet) ────────────────────────────────────────────────
function FleetMap({vehicles,routes,visibleRoutes,onSelectVehicle,editMode,editWaypoints,editColor,onMapClick,onWaypointMove,onWaypointDelete}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const routeLayerRef=useRef(null);
  const vehicleLayerRef=useRef(null);
  const editLayerRef=useRef(null);
  // Refs to avoid stale closures inside Leaflet event handlers
  const cbClick=useRef(onMapClick);
  const cbMove=useRef(onWaypointMove);
  const cbDel=useRef(onWaypointDelete);
  useEffect(()=>{cbClick.current=onMapClick;},[onMapClick]);
  useEffect(()=>{cbMove.current=onWaypointMove;},[onWaypointMove]);
  useEffect(()=>{cbDel.current=onWaypointDelete;},[onWaypointDelete]);

  // Init map once
  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom:19,
    }).addTo(map);
    routeLayerRef.current=L.layerGroup().addTo(map);
    vehicleLayerRef.current=L.layerGroup().addTo(map);
    editLayerRef.current=L.layerGroup().addTo(map);
    map.on("click",(e)=>{ if(cbClick.current)cbClick.current([e.latlng.lat,e.latlng.lng]); });
    mapRef.current=map;
    return()=>{map.remove();mapRef.current=null;};
  },[]);

  // Cursor in edit mode
  useEffect(()=>{
    if(!mapRef.current)return;
    mapRef.current.getContainer().style.cursor=editMode?"crosshair":"";
  },[editMode]);

  // Draw background routes
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

  // Draw vehicle markers (hidden in edit mode)
  useEffect(()=>{
    if(!mapRef.current||!vehicles||!vehicleLayerRef.current)return;
    vehicleLayerRef.current.clearLayers();
    if(editMode)return;
    vehicles.forEach(v=>{
      const color=statusColor[v.status]||"#4ade80";
      const m=L.circleMarker([v.lat,v.lng],{radius:9,fillColor:color,fillOpacity:1,color:"#000",weight:1.5});
      m.bindPopup(`<div style="font-family:'Courier New',monospace;font-size:12px;min-width:160px"><div style="font-weight:700;margin-bottom:4px">${v.name}</div><div style="color:#666;margin-bottom:6px">${v.plate} · ${v.sector}</div>${v.speed_kmh>0?`<div style="margin-bottom:4px">${v.speed_kmh} km/h</div>`:""}<div style="height:4px;background:#eee;border-radius:2px;margin-bottom:2px"><div style="height:100%;width:${v.fuel_pct}%;background:${v.fuel_pct<20?"#f87171":"#4ade80"};border-radius:2px"></div></div><div style="font-size:10px;color:#888;margin-bottom:8px">Carburante: ${v.fuel_pct}%</div></div>`);
      vehicleLayerRef.current.addLayer(m);
    });
  },[vehicles,editMode]);

  // Draw editable waypoints
  useEffect(()=>{
    if(!mapRef.current||!editLayerRef.current)return;
    editLayerRef.current.clearLayers();
    if(!editMode||!editWaypoints||editWaypoints.length===0)return;
    const color=editColor||"#4ade80";
    L.polyline(editWaypoints,{color,weight:4,opacity:0.9}).addTo(editLayerRef.current);
    editWaypoints.forEach((wp,idx)=>{
      const m=L.marker([wp[0],wp[1]],{
        icon:L.divIcon({
          className:"",
          html:`<div style="width:16px;height:16px;background:${color};border:2px solid #000;border-radius:50%;cursor:grab;box-shadow:0 0 6px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#000">${idx+1}</div>`,
          iconSize:[16,16],iconAnchor:[8,8],
        }),
        draggable:true,zIndexOffset:1000,
      });
      m.on("dragend",(e)=>{ const{lat,lng}=e.target.getLatLng(); if(cbMove.current)cbMove.current(idx,[lat,lng]); });
      m.on("click",(e)=>{ L.DomEvent.stopPropagation(e); if(cbDel.current)cbDel.current(idx); });
      editLayerRef.current.addLayer(m);
    });
  },[editMode,editWaypoints,editColor]);

  return <div ref={containerRef} style={{height:"100%",width:"100%"}}/>;
}

// ─── GPS ─────────────────────────────────────────────────────────────────────
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
      if(d.ok){
        setRoutes(d.data);
        setVisibleRoutes(prev=>{const n={...prev};d.data.forEach(r=>{if(!(r.id in n))n[r.id]=true;});return n;});
      }
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

  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexShrink:0}}>
        {["live","editor"].map(t=>(
          <button key={t} onClick={()=>{setTab(t);cancelEdit();}} style={{padding:"6px 16px",background:tab===t?"#0d2e0d":"transparent",border:`1px solid ${tab===t?"#2a6a2a":"#1a3a1a"}`,borderRadius:6,color:tab===t?"#4ade80":"#4a7a4a",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:tab===t?600:400}}>
            {t==="live"?"GPS Live":"Editor Percorsi"}
          </button>
        ))}
        {tab==="editor"&&canEdit&&!editingId&&(
          <button onClick={startNew} style={{marginLeft:"auto",padding:"6px 14px",background:"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>+ Nuovo percorso</button>
        )}
        {tab==="editor"&&editingId&&(
          <span style={{marginLeft:"auto",fontSize:11,color:"#4a7a4a"}}>Click mappa → aggiungi tappa · Click punto → rimuovi · Trascina → sposta</span>
        )}
      </div>

      <div style={{display:"flex",gap:16,flex:1,minHeight:0}}>
        {/* Route list panel (editor, no route selected) */}
        {tab==="editor"&&!editingId&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
            {(routes||[]).length===0&&<div style={{fontSize:12,color:"#3a6a3a",textAlign:"center",marginTop:20}}>Nessun percorso</div>}
            {(routes||[]).map(r=>(
              <div key={r.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:r.color,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:600,color:"#d1fae5",flex:1}}>{r.name}</span>
                  <span style={{fontSize:9,color:r.status==="in_corso"?"#4ade80":"#60a5fa",background:r.status==="in_corso"?"#0d2e0d":"#0a1e30",padding:"1px 5px",borderRadius:3}}>{r.status==="in_corso"?"In corso":"Pianif."}</span>
                </div>
                <div style={{fontSize:11,color:"#4a7a4a",marginBottom:8}}>{r.vehicle||"—"} · {r.waypoints.length} punti · {r.stops} fermate</div>
                <div style={{display:"flex",gap:6}}>
                  {canEdit&&<button onClick={()=>startEdit(r)} style={{flex:1,background:"#0d1f0d",border:"1px solid #1a3a1a",borderRadius:4,color:"#4ade80",padding:"4px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Modifica</button>}
                  {canEdit&&<button onClick={()=>deleteRoute(r.id)} style={{background:"#1a0808",border:"1px solid #3a1a1a",borderRadius:4,color:"#f87171",padding:"4px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Elimina</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        <div style={{flex:1,borderRadius:8,border:"1px solid #1a3a1a",position:"relative",overflow:"hidden"}}>
          <FleetMap
            vehicles={vehicles} routes={routes||[]} visibleRoutes={visibleRoutes}
            onSelectVehicle={onSelectVehicle}
            editMode={editorActive} editWaypoints={editWaypoints} editColor={meta.color}
            onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onWaypointDelete={handleWaypointDelete}
          />
          {tab==="live"&&routes&&(
            <div style={{position:"absolute",top:10,right:10,zIndex:1000,background:"rgba(8,15,8,0.92)",border:"1px solid #1a3a1a",borderRadius:8,padding:"10px 14px",minWidth:190}}>
              <div style={{fontSize:10,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Percorsi raccolta</div>
              {routes.map(r=>(
                <div key={r.id} onClick={()=>toggleRoute(r.id)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer",opacity:visibleRoutes[r.id]?1:0.35,transition:"opacity 0.15s"}}>
                  <div style={{width:22,height:3,background:r.color,borderRadius:2,flexShrink:0}}/>
                  <span style={{fontSize:11,color:"#d1fae5",flex:1}}>{r.name}</span>
                  <span style={{fontSize:9,color:r.status==="in_corso"?"#4ade80":"#60a5fa",background:r.status==="in_corso"?"#0d2e0d":"#0a1e30",padding:"1px 5px",borderRadius:3,flexShrink:0}}>{r.status==="in_corso"?"In corso":"Pianif."}</span>
                </div>
              ))}
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #1a3a1a",fontSize:10,color:"#2a5a2a"}}>Click per mostrare/nascondere</div>
            </div>
          )}
          {tab==="live"&&<div style={{position:"absolute",bottom:10,left:10,zIndex:1000,fontSize:10,color:"#2d6a2d",fontFamily:"monospace",background:"rgba(8,15,8,0.7)",padding:"3px 8px",borderRadius:4}}>Aggiornamento ogni 10s · Visirun mock</div>}
        </div>

        {/* Vehicle sidebar (live mode) */}
        {tab==="live"&&(
          <div style={{width:240,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
            {vehicles&&vehicles.map(v=>(
              <div key={v.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{v.name}</span>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:600}}>{statusLabel[v.status]}</span>
                </div>
                <div style={{fontSize:11,color:"#4a7a4a",marginBottom:8}}>{v.plate} · {v.sector||"—"}</div>
                {v.fuel_pct!=null&&<>
                  <div style={{height:4,background:"#1a3a1a",borderRadius:2,marginBottom:2}}>
                    <div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?"#f87171":"#4ade80",borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:10,color:"#3a6a3a",marginBottom:8}}>Carburante: {v.fuel_pct}%</div>
                </>}
                <button onClick={()=>onSelectVehicle(v)} style={{width:"100%",background:"#0d1f0d",border:"1px solid #1a3a1a",borderRadius:4,color:"#4ade80",padding:"5px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Dettaglio →</button>
              </div>
            ))}
          </div>
        )}

        {/* Route form (editor, route selected) */}
        {tab==="editor"&&editingId&&(
          <div style={{width:260,display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>
            <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:14}}>
              <div style={{fontSize:13,fontWeight:700,color:"#4ade80",marginBottom:14}}>{editingId==="new"?"Nuovo percorso":"Modifica percorso"}</div>
              {[["Nome","name","text"],["Veicolo","vehicle","text"],["Settore","sector","text"],["Fermate","stops","number"]].map(([lbl,key,type])=>(
                <div key={key} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:"#4a7a4a",marginBottom:3}}>{lbl}</div>
                  <input type={type} value={meta[key]} onChange={e=>setMeta(m=>({...m,[key]:e.target.value}))}
                    style={{width:"100%",background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,color:"#d1fae5",padding:"6px 8px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"#4a7a4a",marginBottom:6}}>Colore</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["#4ade80","#60a5fa","#fb923c","#c084fc","#f9a8d4","#facc15","#f87171","#34d399"].map(c=>(
                    <div key={c} onClick={()=>setMeta(m=>({...m,color:c}))} style={{width:22,height:22,borderRadius:"50%",background:c,border:meta.color===c?"3px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0,boxShadow:meta.color===c?"0 0 0 1px #000":"none"}}/>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:"#4a7a4a",marginBottom:3}}>Stato</div>
                <select value={meta.status} onChange={e=>setMeta(m=>({...m,status:e.target.value}))}
                  style={{width:"100%",background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,color:"#d1fae5",padding:"6px 8px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}>
                  <option value="pianificato">Pianificato</option>
                  <option value="in_corso">In corso</option>
                </select>
              </div>
              <div style={{fontSize:11,color:"#3a6a3a",marginBottom:12,padding:"8px",background:"#060f06",borderRadius:4,border:"1px solid #1a3a1a"}}>
                {editWaypoints.length} punti tracciati<br/>
                <span style={{fontSize:10,color:"#2a5a2a"}}>Min. 2 punti per salvare</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveRoute} disabled={saving||!meta.name.trim()||editWaypoints.length<2}
                  style={{flex:1,background:!meta.name.trim()||editWaypoints.length<2?"#0a1a0a":"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:4,color:!meta.name.trim()||editWaypoints.length<2?"#3a5a3a":"#4ade80",padding:"8px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600}}>
                  {saving?"Salvataggio...":"Salva"}
                </button>
                <button onClick={cancelEdit} style={{flex:1,background:"transparent",border:"1px solid #1a3a1a",borderRadius:4,color:"#4a7a4a",padding:"8px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Annulla</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WORKSHOP ────────────────────────────────────────────────────────────────
function WorkshopModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const [tab,setTab]=useState("ordini");
  const {data:orders,loading,error,refetch}=useApi("/workshop/orders");
  const [segnalazioni,setSegnalazioni]=useState([]);
  const [segLoading,setSegLoading]=useState(true);
  const canEdit=can("workshop","edit");
  const isManager=auth.user.role==="fleet_manager";

  const loadSegnalazioni=useCallback(async()=>{
    setSegLoading(true);
    try{
      const r=await fetch(`${API}/segnalazioni`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await r.json();
      if(d.ok)setSegnalazioni(d.data);
    }catch{}
    setSegLoading(false);
  },[auth.token]);

  useEffect(()=>{if(tab==="segnalazioni")loadSegnalazioni();},[tab,loadSegnalazioni]);

  const updateSegStatus=async(id,status)=>{
    await fetch(`${API}/segnalazioni/${id}/status`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status})});
    loadSegnalazioni();
  };

  const openSeg=segnalazioni.filter(s=>s.status!=="chiusa");
  const closedSeg=segnalazioni.filter(s=>s.status==="chiusa");

  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Tabs */}
      <div style={{display:"flex",gap:8,borderBottom:"1px solid #1a3a1a",paddingBottom:12}}>
        {[["ordini","Ordini officina"],["segnalazioni","Segnalazioni"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"7px 16px",background:tab===id?"#0d2e0d":"transparent",border:`1px solid ${tab===id?"#2a6a2a":"#1a3a1a"}`,borderRadius:6,color:tab===id?"#4ade80":"#4a7a4a",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:tab===id?600:400,position:"relative"}}>
            {label}
            {id==="segnalazioni"&&openSeg.length>0&&<span style={{position:"absolute",top:-6,right:-6,background:"#fb923c",color:"#000",fontSize:9,fontWeight:700,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{openSeg.length}</span>}
          </button>
        ))}
      </div>

      {/* ── ORDINI TAB ── */}
      {tab==="ordini"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {!canEdit&&<div style={{background:"#0a1200",border:"1px solid #1a3a1a",borderRadius:6,padding:"8px 14px",fontSize:11,color:"#4a7a4a"}}>👁 Solo lettura — il tuo ruolo non permette modifiche</div>}
          <div style={{display:"flex",gap:12}}>
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
                        await fetch(`${API}/workshop/orders/${o.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status:next})});
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
      )}

      {/* ── SEGNALAZIONI TAB ── */}
      {tab==="segnalazioni"&&(
        segLoading?<Spinner/>:
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {segnalazioni.length===0&&<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"40px",textAlign:"center",color:"#2a4a2a",fontSize:13}}>Nessuna segnalazione</div>}
          {/* Open reports first */}
          {openSeg.map(s=>(
            <div key={s.id} style={{background:"#0a1a0a",border:`1px solid ${s.tipo==="incidente"?"#4a1a1a":s.tipo==="manutenzione"?"#1a2a4a":"#1a3a1a"}`,borderRadius:8,padding:"14px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  {s.tipo&&SEG_TIPO[s.tipo]&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:SEG_TIPO[s.tipo].color+"22",color:SEG_TIPO[s.tipo].color,fontWeight:700,border:`1px solid ${SEG_TIPO[s.tipo].color}44`}}>{SEG_TIPO[s.tipo].label}</span>}
                  <span style={{fontSize:14,fontWeight:700,color:"#d1fae5"}}>{s.vehicle}</span>
                  {s.plate&&<span style={{fontSize:11,color:"#4a7a4a",fontFamily:"monospace"}}>{s.plate}</span>}
                  <span style={{fontSize:11,color:"#3a6a3a"}}>· {s.settore}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,padding:"3px 10px",borderRadius:4,background:SEG_STATUS[s.status]?.color+"22",color:SEG_STATUS[s.status]?.color,fontWeight:600,border:`1px solid ${SEG_STATUS[s.status]?.color}44`}}>{SEG_STATUS[s.status]?.label}</span>
                  {(canEdit||isManager)&&(
                    <select value={s.status} onChange={e=>updateSegStatus(s.id,e.target.value)}
                      style={{background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,padding:"3px 8px",color:"#d1fae5",fontSize:11,outline:"none",cursor:"pointer",fontFamily:"inherit"}}>
                      <option value="aperta">Aperta</option>
                      <option value="in_lavorazione">In lavorazione</option>
                      <option value="chiusa">Chiusa</option>
                    </select>
                  )}
                </div>
              </div>
              <div style={{fontSize:13,color:"#d1fae5aa",lineHeight:1.6,marginBottom:8}}>{s.description}</div>
              {s.photo_url&&<img src={`http://localhost:3001${s.photo_url}`} alt="foto" style={{maxHeight:180,maxWidth:"100%",borderRadius:6,border:"1px solid #1a3a1a",marginBottom:8,display:"block",cursor:"pointer"}} onClick={()=>window.open(`http://localhost:3001${s.photo_url}`,"_blank")}/>}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:"#3a6a3a"}}>👤 {s.reporter_name}</div>
                {s.available_from&&<div style={{fontSize:11,color:"#4ade80"}}>🔧 Disponibile dal {s.available_from}</div>}
                <div style={{fontSize:11,color:"#2a4a2a",marginLeft:"auto"}}>{new Date(s.created_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          ))}
          {/* Closed reports collapsed */}
          {closedSeg.length>0&&(
            <details style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"10px 14px"}}>
              <summary style={{fontSize:12,color:"#3a6a3a",cursor:"pointer",userSelect:"none"}}>Segnalazioni chiuse ({closedSeg.length})</summary>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
                {closedSeg.map(s=>(
                  <div key={s.id} style={{background:"#060f06",borderRadius:6,padding:"10px 12px",opacity:0.7}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <div><span style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{s.vehicle}</span><span style={{fontSize:11,color:"#3a6a3a"}}> · {s.settore}</span></div>
                      <span style={{fontSize:11,color:"#4ade80"}}>Chiusa</span>
                    </div>
                    <div style={{fontSize:12,color:"#4a7a4a",marginTop:4}}>{s.description}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
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

// ─── SEGNALAZIONI MODULE ──────────────────────────────────────────────────────
const SEG_STATUS={aperta:{label:"Aperta",color:"#fb923c"},in_lavorazione:{label:"In lavorazione",color:"#60a5fa"},chiusa:{label:"Chiusa",color:"#4ade80"}};
const SEG_TIPO={guasto:{label:"Guasto",color:"#facc15"},incidente:{label:"Incidente",color:"#f87171"},manutenzione:{label:"Manutenzione",color:"#60a5fa"}};

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

  const handlePhoto=e=>{
    const file=e.target.files[0];
    if(!file)return;
    setForm(f=>({...f,photo:file}));
    setPhotoPreview(URL.createObjectURL(file));
  };
  const removePhoto=()=>{setForm(f=>({...f,photo:null}));setPhotoPreview(null);};

  const loadList=useCallback(async()=>{
    setLoading(true);
    try{
      const r=await fetch(`${API}/segnalazioni`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await r.json();
      if(d.ok)setList(d.data);
    }catch{}
    setLoading(false);
  },[auth.token]);

  useEffect(()=>{loadList();},[loadList]);

  const handleVehicleChange=e=>{
    const v=vehicles?.find(v=>v.name===e.target.value);
    setForm(f=>({...f,vehicle:e.target.value,plate:v?.plate||""}));
  };

  const submit=async()=>{
    if(!form.settore||!form.vehicle||!form.description){setMsg({ok:false,text:"Settore, veicolo e descrizione sono obbligatori"});return;}
    setSubmitting(true);setMsg(null);
    try{
      const fd=new FormData();
      fd.append("reporter_name",form.reporter_name);
      fd.append("settore",form.settore);
      fd.append("vehicle",form.vehicle);
      fd.append("plate",form.plate||"");
      fd.append("description",form.description);
      fd.append("tipo",form.tipo);
      fd.append("available_from",form.available_from||"");
      if(form.photo) fd.append("photo",form.photo);
      const r=await fetch(`${API}/segnalazioni`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`},body:fd});
      const d=await r.json();
      if(d.ok){setMsg({ok:true,text:"Segnalazione inviata"});setShowForm(false);setForm(emptyForm);setPhotoPreview(null);loadList();}
      else setMsg({ok:false,text:d.error});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setSubmitting(false);
    setTimeout(()=>setMsg(null),4000);
  };

  const updateStatus=async(id,status)=>{
    await fetch(`${API}/segnalazioni/${id}/status`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status})});
    loadList();
  };

  const inputStyle={width:"100%",background:"#060f06",border:"1px solid #1a3a1a",borderRadius:6,padding:"9px 12px",color:"#d1fae5",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  const labelStyle={fontSize:11,color:"#4a7a4a",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#d1fae5"}}>Segnalazioni</div>
          <div style={{fontSize:12,color:"#3a6a3a",marginTop:4}}>Riporta un problema, guasto o incidente su un veicolo</div>
        </div>
        <button onClick={()=>{setShowForm(v=>!v);setMsg(null);}} style={{padding:"9px 16px",background:"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
          {showForm?"✕ Annulla":"+ Nuova segnalazione"}
        </button>
      </div>

      {msg&&<div style={{padding:"10px 14px",borderRadius:6,background:msg.ok?"#0a1a0a":"#1a0a0a",border:`1px solid ${msg.ok?"#2a6a2a":"#4a1a1a"}`,color:msg.ok?"#4ade80":"#f87171",fontSize:13}}>{msg.text}</div>}

      {/* New report form */}
      {showForm&&(
        <div style={{background:"#0a1a0a",border:"1px solid #2a6a2a",borderRadius:10,padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:14,fontWeight:700,color:"#4ade80"}}>Nuova segnalazione</div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {/* Nome */}
            <div>
              <label style={labelStyle}>Nome segnalante</label>
              <input value={form.reporter_name} onChange={e=>set("reporter_name")(e.target.value)} style={inputStyle} placeholder="Il tuo nome"/>
            </div>
            {/* Settore */}
            <div>
              <label style={labelStyle}>Settore</label>
              <input value={form.settore} onChange={e=>set("settore")(e.target.value)} style={inputStyle} placeholder="Es. Zona Nord, Deposito…"/>
            </div>
          </div>

          {/* Veicolo */}
          <div>
            <label style={labelStyle}>Veicolo</label>
            {vehicles?.length>0
              ?<select value={form.vehicle} onChange={handleVehicleChange} style={inputStyle}>
                <option value="">— Seleziona veicolo —</option>
                {vehicles.map(v=><option key={v.id} value={v.name}>{v.name} · {v.plate}</option>)}
              </select>
              :<input value={form.vehicle} onChange={e=>set("vehicle")(e.target.value)} style={inputStyle} placeholder="Nome del camion"/>
            }
          </div>

          {/* Cosa è successo */}
          <div>
            <label style={labelStyle}>Cosa è successo</label>
            <textarea value={form.description} onChange={e=>set("description")(e.target.value)} rows={4}
              style={{...inputStyle,resize:"vertical",lineHeight:1.5}}
              placeholder="Descrivi il problema o l'evento in modo dettagliato…"/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {/* Tipo */}
            <div>
              <label style={labelStyle}>Tipo</label>
              <div style={{display:"flex",gap:8}}>
                {Object.entries(SEG_TIPO).map(([key,{label,color}])=>(
                  <button key={key} type="button" onClick={()=>set("tipo")(key)}
                    style={{flex:1,padding:"9px 6px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:form.tipo===key?700:400,background:form.tipo===key?color+"22":"#060f06",border:`1px solid ${form.tipo===key?color:"#1a3a1a"}`,color:form.tipo===key?color:"#4a7a4a",transition:"all 0.15s"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Disponibilità */}
            <div>
              <label style={labelStyle}>Veicolo disponibile dal</label>
              <input type="date" value={form.available_from} onChange={e=>set("available_from")(e.target.value)}
                style={{...inputStyle,colorScheme:"dark"}}/>
            </div>
          </div>

          {/* Photo */}
          <div>
            <label style={labelStyle}>Foto (opzionale)</label>
            {!photoPreview
              ?<label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#060f06",border:"2px dashed #1a3a1a",borderRadius:6,cursor:"pointer"}}>
                <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
                <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={18}/>
                <span style={{fontSize:13,color:"#4a7a4a"}}>Clicca per allegare una foto</span>
                <span style={{fontSize:11,color:"#2a4a2a",marginLeft:"auto"}}>JPG · PNG · WEBP · max 10MB</span>
              </label>
              :<div style={{position:"relative",display:"inline-block"}}>
                <img src={photoPreview} alt="preview" style={{maxHeight:200,maxWidth:"100%",borderRadius:6,border:"1px solid #2a6a2a",display:"block"}}/>
                <button onClick={removePhoto} style={{position:"absolute",top:6,right:6,background:"#1a0a0a",border:"1px solid #4a1a1a",borderRadius:4,color:"#f87171",padding:"2px 8px",cursor:"pointer",fontSize:11}}>✕ Rimuovi</button>
              </div>
            }
          </div>

          <button onClick={submit} disabled={submitting} style={{alignSelf:"flex-end",padding:"10px 24px",background:"#0d2e0d",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ade80",cursor:submitting?"not-allowed":"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}}>
            {submitting?"Invio in corso…":"Invia segnalazione"}
          </button>
        </div>
      )}

      {/* List */}
      {loading?<Spinner/>:list.length===0
        ?<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"40px",textAlign:"center",color:"#2a4a2a",fontSize:13}}>Nessuna segnalazione presente</div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {list.map(s=>(
            <div key={s.id} style={{background:"#0a1a0a",border:`1px solid ${s.tipo==="incidente"?"#4a1a1a":s.tipo==="manutenzione"?"#1a2a4a":"#1a3a1a"}`,borderRadius:8,padding:"14px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  {s.tipo&&SEG_TIPO[s.tipo]&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:SEG_TIPO[s.tipo].color+"22",color:SEG_TIPO[s.tipo].color,fontWeight:700,border:`1px solid ${SEG_TIPO[s.tipo].color}44`}}>{SEG_TIPO[s.tipo].label}</span>}
                  <span style={{fontSize:15,fontWeight:700,color:"#d1fae5"}}>{s.vehicle}</span>
                  {s.plate&&<span style={{fontSize:11,color:"#4a7a4a",fontFamily:"monospace"}}>{s.plate}</span>}
                  <span style={{fontSize:11,color:"#3a6a3a"}}>· {s.settore}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,padding:"3px 10px",borderRadius:4,background:SEG_STATUS[s.status]?.color+"22",color:SEG_STATUS[s.status]?.color,fontWeight:600,border:`1px solid ${SEG_STATUS[s.status]?.color}44`}}>
                    {SEG_STATUS[s.status]?.label}
                  </span>
                  {isManager&&s.status!=="chiusa"&&(
                    <select value={s.status} onChange={e=>updateStatus(s.id,e.target.value)}
                      style={{background:"#060f06",border:"1px solid #1a3a1a",borderRadius:4,padding:"3px 8px",color:"#d1fae5",fontSize:11,outline:"none",cursor:"pointer",fontFamily:"inherit"}}>
                      <option value="aperta">Aperta</option>
                      <option value="in_lavorazione">In lavorazione</option>
                      <option value="chiusa">Chiusa</option>
                    </select>
                  )}
                </div>
              </div>

              <div style={{fontSize:13,color:"#d1fae5aa",lineHeight:1.6,marginBottom:10}}>{s.description}</div>

              {s.photo_url&&(
                <div style={{marginBottom:10}}>
                  <img src={`http://localhost:3001${s.photo_url}`} alt="foto segnalazione"
                    style={{maxHeight:220,maxWidth:"100%",borderRadius:6,border:"1px solid #1a3a1a",display:"block",cursor:"pointer"}}
                    onClick={()=>window.open(`http://localhost:3001${s.photo_url}`,"_blank")}/>
                </div>
              )}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:"#3a6a3a"}}>👤 {s.reporter_name}</div>
                {s.available_from&&<div style={{fontSize:11,color:"#3a6a3a"}}>🔧 Disponibile dal {s.available_from}</div>}
                <div style={{fontSize:11,color:"#2a4a2a",marginLeft:"auto"}}>{new Date(s.created_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          ))}
        </div>
      }
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
      const a=document.createElement("a");
      a.href=url;
      a.download=`${label}_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ok:true,text:`${label} scaricato`});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setDownloading(null);
    setTimeout(()=>setMsg(null),3000);
  };

  const reports=[
    {id:"fleet",       label:"Report completo flotta",  desc:"Carburante + Officina + Segnalazioni in un unico file Excel con più fogli", icon:"M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3", always:true},
    {id:"segnalazioni",label:"Segnalazioni",             desc:"Tutte le segnalazioni con tipo, stato, veicolo e data disponibilità",        icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", always:true},
    {id:"fuel",        label:"Registro carburante",      desc:"Tutti i rifornimenti con litri, costo, KM e stazione + riepilogo",           icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6", perm:"fuel"},
    {id:"workshop",    label:"Ordini officina",          desc:"Tutti gli ordini con stato, meccanico, ETA e note",                           icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z", perm:"workshop"},
  ].filter(r=>r.always||can(r.perm));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <div style={{fontSize:18,fontWeight:700,color:"#d1fae5"}}>Report ed export</div>
        <div style={{fontSize:12,color:"#3a6a3a",marginTop:4}}>Scarica i dati in formato Excel — compatibile con Microsoft Excel e Google Sheets</div>
      </div>

      {msg&&<div style={{padding:"10px 14px",borderRadius:6,background:msg.ok?"#0a1a0a":"#1a0a0a",border:`1px solid ${msg.ok?"#2a6a2a":"#4a1a1a"}`,color:msg.ok?"#4ade80":"#f87171",fontSize:13}}>{msg.text}</div>}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {reports.map(r=>(
          <div key={r.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:40,height:40,borderRadius:8,background:"#0d2e0d",border:"1px solid #1a3a1a",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon d={r.icon} size={18}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:"#d1fae5",marginBottom:3}}>{r.label}</div>
              <div style={{fontSize:12,color:"#4a7a4a"}}>{r.desc}</div>
            </div>
            <button
              onClick={()=>download(r.id,r.label)}
              disabled={downloading===r.id}
              style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",background:downloading===r.id?"#0a1a0a":"#0d2e0d",border:`1px solid ${downloading===r.id?"#1a3a1a":"#2a6a2a"}`,borderRadius:6,color:downloading===r.id?"#3a6a3a":"#4ade80",cursor:downloading===r.id?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
              <Icon d={downloading===r.id?"M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"} size={14}/>
              {downloading===r.id?"Generazione…":"Scarica Excel"}
            </button>
          </div>
        ))}
      </div>

      <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 18px"}}>
        <div style={{fontSize:11,color:"#3a6a3a",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Nota</div>
        <div style={{fontSize:12,color:"#4a7a4a",lineHeight:1.6}}>
          I report contengono i dati attuali del sistema. Quando il database TargetCross sarà connesso, i report includeranno automaticamente i dati storici completi.
        </div>
      </div>
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

  // Aggregate fuel per vehicle
  const vFuel={};
  fuelEntries?.forEach(e=>{
    if(!vFuel[e.vehicle])vFuel[e.vehicle]={liters:0,cost:0,refills:0,lastKm:0};
    vFuel[e.vehicle].liters+=Number(e.liters);
    vFuel[e.vehicle].cost+=parseFloat(e.cost_eur);
    vFuel[e.vehicle].refills+=1;
    if(e.km>vFuel[e.vehicle].lastKm)vFuel[e.vehicle].lastKm=e.km;
  });

  // Count workshop orders per vehicle
  const vOrders={};
  orders?.forEach(o=>{vOrders[o.vehicle]=(vOrders[o.vehicle]||0)+1;});

  // Build per-vehicle rows
  const rows=(vehicles||[]).map(v=>({
    ...v,
    f:vFuel[v.name]||null,
    ordersCount:vOrders[v.name]||0,
  }));

  // Fleet-wide totals
  const totalLiters=Object.values(vFuel).reduce((s,f)=>s+f.liters,0);
  const totalFuelCost=Object.values(vFuel).reduce((s,f)=>s+f.cost,0);
  const totalOrders=orders?.length||0;
  const currentMonth=costs?costs[costs.length-1]:null;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <div style={{fontSize:18,fontWeight:700,color:"#d1fae5"}}>Cruscotto operativo</div>
        <div style={{fontSize:12,color:"#3a6a3a",marginTop:4}}>Dati aggregati per veicolo — carburante, costi e manutenzione</div>
      </div>

      {/* Fleet KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {vehicles&&<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{fontSize:11,color:"#4a7a4a",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Veicoli in flotta</div><div style={{fontSize:26,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>{vehicles.length}</div></div>}
        {can("fuel")&&<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{fontSize:11,color:"#4a7a4a",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Litri totali</div><div style={{fontSize:26,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>{totalLiters.toFixed(0)} L</div></div>}
        {can("fuel")&&<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{fontSize:11,color:"#4a7a4a",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Costo carburante</div><div style={{fontSize:26,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>€{totalFuelCost.toFixed(0)}</div></div>}
        {can("workshop")&&<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{fontSize:11,color:"#4a7a4a",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Ordini officina</div><div style={{fontSize:26,fontWeight:700,color:totalOrders>0?"#fb923c":"#4ade80",fontFamily:"monospace"}}>{totalOrders}</div></div>}
        {can("costs")&&currentMonth&&<div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,padding:"14px 16px"}}><div style={{fontSize:11,color:"#4a7a4a",marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Costi aprile</div><div style={{fontSize:26,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>€{currentMonth.total}</div></div>}
      </div>

      {/* Per-vehicle table */}
      <div>
        <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Dettaglio per veicolo</div>
        <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#0d1f0d"}}>
                <th style={{padding:"10px 14px",textAlign:"left",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Veicolo</th>
                <th style={{padding:"10px 14px",textAlign:"left",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Stato</th>
                {can("gps")&&<th style={{padding:"10px 14px",textAlign:"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Odom. km</th>}
                {can("fuel")&&<th style={{padding:"10px 14px",textAlign:"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Litri</th>}
                {can("fuel")&&<th style={{padding:"10px 14px",textAlign:"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Costo carb.</th>}
                {can("fuel")&&<th style={{padding:"10px 14px",textAlign:"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Rifornimenti</th>}
                {can("workshop")&&<th style={{padding:"10px 14px",textAlign:"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Interventi</th>}
                {can("gps")&&<th style={{padding:"10px 14px",textAlign:"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>Carburante</th>}
                <th style={{padding:"10px 14px",textAlign:"center",color:"#4a7a4a",fontWeight:600,fontSize:11}}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(v=>(
                <tr key={v.id} style={{borderTop:"1px solid #1a3a1a"}}>
                  <td style={{padding:"12px 14px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{v.name}</div>
                    <div style={{fontSize:10,color:"#3a6a3a",fontFamily:"monospace"}}>{v.plate}</div>
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:600}}>{statusLabel[v.status]}</span>
                  </td>
                  {can("gps")&&<td style={{padding:"12px 14px",textAlign:"right",color:"#d1fae5",fontFamily:"monospace",fontSize:12}}>{v.f?.lastKm?v.f.lastKm.toLocaleString("it-IT"):"—"}</td>}
                  {can("fuel")&&<td style={{padding:"12px 14px",textAlign:"right",color:"#4ade80",fontFamily:"monospace",fontSize:12}}>{v.f?`${v.f.liters} L`:"—"}</td>}
                  {can("fuel")&&<td style={{padding:"12px 14px",textAlign:"right",color:"#4ade80",fontFamily:"monospace",fontSize:12}}>{v.f?`€${v.f.cost.toFixed(2)}`:"—"}</td>}
                  {can("fuel")&&<td style={{padding:"12px 14px",textAlign:"right",color:"#d1fae5aa",fontSize:12}}>{v.f?v.f.refills:"—"}</td>}
                  {can("workshop")&&<td style={{padding:"12px 14px",textAlign:"right",fontSize:12}}><span style={{color:v.ordersCount>0?"#fb923c":"#3a6a3a"}}>{v.ordersCount}</span></td>}
                  {can("gps")&&<td style={{padding:"12px 14px",textAlign:"right",minWidth:80}}>
                    {v.fuel_pct!=null
                      ?<><div style={{height:4,background:"#1a3a1a",borderRadius:2,marginBottom:2}}><div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?"#f87171":"#4ade80",borderRadius:2}}/></div><div style={{fontSize:10,color:v.fuel_pct<20?"#f87171":"#3a6a3a",textAlign:"right"}}>{v.fuel_pct}%</div></>
                      :"—"}
                  </td>}
                  <td style={{padding:"12px 14px",textAlign:"center"}}>
                    <button onClick={()=>onSelectVehicle(v)} style={{background:"#0d1f0d",border:"1px solid #1a3a1a",borderRadius:4,color:"#4ade80",padding:"4px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit",whiteSpace:"nowrap"}}>Dettaglio →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly cost breakdown */}
      {can("costs")&&costs&&(
        <div>
          <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Costi mensili</div>
          <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:8,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:"#0d1f0d"}}>{["Mese","Carburante","Manutenzione","Altro","Totale"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:h==="Mese"?"left":"right",color:"#4a7a4a",fontWeight:600,fontSize:11}}>{h}</th>)}</tr></thead>
              <tbody>
                {costs.map(c=>(
                  <tr key={c.month} style={{borderTop:"1px solid #1a3a1a"}}>
                    <td style={{padding:"10px 14px",color:"#6aaa6a",fontFamily:"monospace"}}>{c.month}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#4ade80",fontFamily:"monospace"}}>€{c.fuel}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#60a5fa",fontFamily:"monospace"}}>€{c.maintenance}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#facc15",fontFamily:"monospace"}}>€{c.other}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#d1fae5",fontFamily:"monospace",fontWeight:700}}>€{c.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

  const Card=({label,value,sub,color="#4ade80",alert=false})=>(
    <div style={{background:"#0a1a0a",border:`1px solid ${alert?"#4a2a1a":"#1a3a1a"}`,borderRadius:8,padding:"16px 20px",display:"flex",flexDirection:"column",gap:6}}>
      <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
      <div style={{fontSize:28,fontWeight:700,color:alert?"#fb923c":color,fontFamily:"monospace",lineHeight:1}}>{value??<span style={{color:"#2a4a2a"}}>—</span>}</div>
      {sub&&<div style={{fontSize:11,color:alert?"#7a4a2a":"#3a6a3a"}}>{sub}</div>}
    </div>
  );

  const hour=new Date().getHours();
  const greeting=hour<12?"Buongiorno":"Buonasera";

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Header greeting */}
      <div>
        <div style={{fontSize:20,fontWeight:700,color:"#d1fae5"}}>{greeting}, {auth.user.name}</div>
        <div style={{fontSize:12,color:"#3a6a3a",marginTop:4}}>Ecco il riepilogo operativo di oggi</div>
      </div>

      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        {can("gps")&&<Card label="Veicoli attivi"   value={fleetActive}   sub={`${fleetIdle??"—"} fermi · ${fleetWorkshop??"—"} in officina`}/>}
        {can("workshop")&&<Card label="Ordini aperti" value={pendingOrders.length||null} sub={pendingOrders.length?`${pendingOrders.filter(o=>o.status==="waiting_parts").length} in attesa ricambi`:"Nessun ordine pendente"} color={pendingOrders.length?"#fb923c":"#4ade80"} alert={pendingOrders.length>0}/>}
        {can("fuel")&&<Card label="Costo carburante" value={fuelSummary?`€${fuelSummary.total_cost_eur.toFixed(0)}`:null} sub={fuelSummary?`${fuelSummary.total_liters} L · ${fuelSummary.total_km} km`:null}/>}
        {can("costs")&&currentMonth&&<Card label="Costi questo mese" value={`€${currentMonth.total}`} sub={costTrend!=null?(costTrend>0?`▲ +${costTrend}% vs mese scorso`:`▼ ${costTrend}% vs mese scorso`):null} color={costTrend>0?"#fb923c":"#4ade80"} alert={costTrend>10}/>}
      </div>

      {/* Alerts */}
      {(lowFuel.length>0||pendingOrders.filter(o=>o.status==="waiting_parts").length>0)&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5}}>Attenzione richiesta</div>
          {lowFuel.map(v=>(
            <div key={v.id} style={{background:"#110800",border:"1px solid #4a2a1a",borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#fb923c",flexShrink:0}}/>
              <div style={{flex:1}}>
                <span style={{color:"#fb923c",fontWeight:600,fontSize:13}}>{v.name}</span>
                <span style={{color:"#7a4a2a",fontSize:12}}> — carburante basso: </span>
                <span style={{color:"#fb923c",fontSize:12,fontFamily:"monospace"}}>{v.fuel_pct}%</span>
              </div>
              <div style={{fontSize:11,color:"#4a3a2a"}}>{v.plate}</div>
            </div>
          ))}
          {pendingOrders.filter(o=>o.status==="waiting_parts").map(o=>(
            <div key={o.id} style={{background:"#0a0a11",border:"1px solid #2a2a4a",borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#60a5fa",flexShrink:0}}/>
              <div style={{flex:1}}>
                <span style={{color:"#60a5fa",fontWeight:600,fontSize:13}}>{o.vehicle}</span>
                <span style={{color:"#3a3a6a",fontSize:12}}> — in attesa ricambi · </span>
                <span style={{color:"#60a5fa",fontSize:12}}>{o.type}</span>
              </div>
              {o.eta&&<div style={{fontSize:11,color:"#3a3a6a"}}>ETA {o.eta}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Fleet quick view */}
      {can("gps")&&vehicles&&vehicles.length>0&&(
        <div>
          <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Stato flotta</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            {vehicles.map(v=>(
              <div key={v.id} onClick={()=>onSelectVehicle(v)} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:6,padding:"10px 12px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[v.status]??"#3a3a3a",flexShrink:0,boxShadow:`0 0 6px ${statusColor[v.status]??"#3a3a3a"}`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#d1fae5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.name}</div>
                  <div style={{fontSize:10,color:"#3a6a3a"}}>{v.plate}{v.sector?` · ${v.sector}`:""}</div>
                </div>
                {v.fuel_pct!=null&&<div style={{fontSize:10,color:v.fuel_pct<20?"#fb923c":"#3a6a3a",fontFamily:"monospace",flexShrink:0}}>{v.fuel_pct}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending workshop orders */}
      {can("workshop")&&pendingOrders.length>0&&(
        <div>
          <div style={{fontSize:11,color:"#4a7a4a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:10}}>Officina — ordini aperti</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pendingOrders.map(o=>(
              <div key={o.id} style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[o.status]??"#3a3a3a",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#d1fae5"}}>{o.vehicle}</span>
                  <span style={{fontSize:12,color:"#4a7a4a"}}> · {o.type}</span>
                </div>
                <div style={{fontSize:11,color:"#3a6a3a",whiteSpace:"nowrap"}}>{statusLabel[o.status]}{o.eta?` · ETA ${o.eta}`:""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const NAV_DEF=[
  {id:"home",       label:"Home",        icon:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10", module:null},
  {id:"cruscotto",    label:"Cruscotto",     icon:"M18 20V10 M12 20V4 M6 20v-6",                                                          module:null},
  {id:"segnalazioni", label:"Segnalazioni",  icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", module:null},
  {id:"reports",      label:"Report",        icon:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",                                                    module:null},
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
  const [active,setActive]=useState("home");
  const [selectedVehicle,setSelectedVehicle]=useState(null);
  const {data:vehicles}=useApi("/gps/vehicles",{pollMs:10000,skip:!can("gps")});

  // Filter nav by permissions (module:null means always visible)
  const nav=NAV_DEF.filter(n=>n.module===null||can(n.module));

  // If current active tab is no longer accessible, switch to first available
  useEffect(()=>{ if(nav.length&&!nav.find(n=>n.id===active))setActive(nav[0].id); },[nav,active]);

  // Clear vehicle detail when switching tabs
  const handleSetActive=(id)=>{ setSelectedVehicle(null); setActive(id); };

  const counts=vehicles?{active:vehicles.filter(v=>v.status==="active").length,idle:vehicles.filter(v=>v.status==="idle").length,workshop:vehicles.filter(v=>v.status==="workshop").length}:{active:"—",idle:"—",workshop:"—"};

  const renderModule=()=>{
    if(selectedVehicle) return <VehicleDetail vehicle={selectedVehicle} onBack={()=>setSelectedVehicle(null)}/>;
    return {home:<HomeModule onSelectVehicle={setSelectedVehicle}/>,cruscotto:<CruscottoModule onSelectVehicle={setSelectedVehicle}/>,segnalazioni:<SegnalazioniModule/>,reports:<ReportsModule/>,gps:<GPSModule onSelectVehicle={setSelectedVehicle}/>,workshop:<WorkshopModule/>,fuel:<FuelModule/>,suppliers:<SuppliersModule/>,costs:<CostsModule/>,admin:<AdminPanel/>}[active]||null;
  };

  const handleLogout=async()=>{
    try{await fetch(`${API}/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`}});}catch{}
    logout();
    await msalInstance.clearCache();
    await msalInstance.logoutRedirect({postLogoutRedirectUri:window.location.origin});
  };

  return(
    <div style={{display:"flex",height:"100vh",background:"#060f06",fontFamily:"'Courier New', monospace",color:"#d1fae5"}}>
      <div style={{width:220,background:"#080f08",borderRight:"1px solid #1a3a1a",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid #1a3a1a"}}><div style={{fontSize:16,fontWeight:700,color:"#4ade80",letterSpacing:2,textTransform:"uppercase"}}>FleetCC</div><div style={{fontSize:10,color:"#2a5a2a",letterSpacing:1,marginTop:2}}>FLEET COMMAND CENTER</div></div>
        <div style={{padding:"10px 20px",borderBottom:"1px solid #1a3a1a"}}><div style={{fontSize:12,color:"#4ade80",fontWeight:600}}>{auth.user.name}</div><div style={{fontSize:10,color:"#2a5a2a",marginTop:2}}>{roleLabel[auth.user.role]||auth.user.role}</div></div>
        <nav style={{flex:1,padding:"12px 12px"}}>
          {nav.map(n=><button key={n.id} onClick={()=>handleSetActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:6,border:"none",cursor:"pointer",marginBottom:2,background:active===n.id?"#0d2e0d":"transparent",color:active===n.id?"#4ade80":"#3a6a3a",transition:"all 0.15s",textAlign:"left"}}><Icon d={n.icon} size={15}/><span style={{fontSize:13,fontWeight:active===n.id?600:400}}>{n.label}</span></button>)}
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

function AppInner(){
  const{auth,login}=useAuth();
  const[redirecting,setRedirecting]=useState(true);

  useEffect(()=>{
    msalInstance.handleRedirectPromise()
      .then(async result=>{
        if(result?.idToken){
          try{
            const res=await fetch(`${API}/auth/azure`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_token:result.idToken})});
            const data=await res.json();
            if(data.ok) login(data.token,data.user,data.tenant);
          }catch{}
        }
      })
      .catch(()=>{})
      .finally(()=>setRedirecting(false));
  },[login]);

  if(redirecting) return(
    <div style={{height:"100vh",background:"#060f06",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New', monospace",color:"#2a5a2a",fontSize:12}}>
      Caricamento...
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
