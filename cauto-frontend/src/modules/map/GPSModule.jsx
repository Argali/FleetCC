import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import L from "leaflet";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { API } from "@/api";
import T, { statusColor, statusLabel } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { useApi } from "@/hooks/useApi";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useGeolocation } from "@/hooks/useGeolocation";
import { distanceM, fmtDist, fmtTime, NAV_ARROW } from "@/utils/geoUtils";
import Spinner from "@/shared/ui/Spinner";
import ApiError from "@/shared/ui/ApiError";
import TabBar from "@/shared/ui/TabBar";
import Icon from "@/shared/ui/Icon";
import FleetMap from "@/modules/map/FleetMap";
import ZoneMap from "@/modules/map/ZoneMap";
import PuntiMap from "@/modules/map/PuntiMap";
import CdrCanvas from "@/modules/map/CdrCanvas";
import LiveCamera from "@/modules/map/LiveCamera";

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
      // Bias results toward the user's current position (±0.3° ≈ 30 km box)
      const vb=myPos
        ?`&viewbox=${myPos[1]-0.3},${myPos[0]+0.3},${myPos[1]+0.3},${myPos[0]-0.3}&bounded=0`
        :"";
      const url=`https://nominatim.openstreetmap.org/search?format=json&limit=8&countrycodes=it${vb}&q=${encodeURIComponent(q)}`;
      const r=await fetch(url,{headers:{"Accept-Language":"it"},signal:navAbortRef.current.signal});
      const d=await r.json();
      if(!navAbortRef.current?.signal.aborted)setNavDestResults(d);
    }catch(e){if(e.name!=="AbortError")setNavDestResults([]);}
    setNavDestLoading(false);
  },[myPos]);

  const startNavigation=useCallback(async(dest)=>{
    if(!myPos){setNavError("Posizione GPS non disponibile.");return;}
    setNavStatus("loading");setNavError(null);setNavDest(dest);setShowNavPanel(false);
    try{
      const r=await fetch(`${API}/gps/navigate`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({from:myPos,to:[dest.lat,dest.lng],costing:navCosting})});
      const d=await r.json();
      if(!d.ok){setNavError(d.error||"Errore calcolo percorso");setNavStatus("idle");return;}
      setNavRoute(d.data);setNavStep(0);setNavStatus("active");
      // Enter fullscreen (best-effort — not supported on iOS Safari)
      const el=document.documentElement;
      if(el.requestFullscreen)el.requestFullscreen().catch(()=>{});
      else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
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
    // Exit fullscreen if active
    if(document.fullscreenElement||document.webkitFullscreenElement){
      (document.exitFullscreen||document.webkitExitFullscreen)?.call(document).catch(()=>{});
    }
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

export default GPSModule;
