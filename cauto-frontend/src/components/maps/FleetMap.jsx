import React, { useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import T, { statusColor, statusLabel } from "../../theme";
import Icon from "../ui/Icon";

function FleetMap({vehicles,routes,visibleRoutes,editMode,editWaypoints,editColor,zones,punti,onMapClick,onWaypointMove,onWaypointDelete,searchMarkerRef,snappedSegments,snapMode,onPathClick,annotations=[]}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const routeLayerRef=useRef(null);
  const vehicleLayerRef=useRef(null);
  const editLayerRef=useRef(null);
  const zoneLayerRef=useRef(null);
  const puntiLayerRef=useRef(null);
  const annotLayerRef=useRef(null);
  const cbClick=useRef(onMapClick);
  const cbMove=useRef(onWaypointMove);
  const cbDel=useRef(onWaypointDelete);
  const cbPathClick=useRef(onPathClick);
  useEffect(()=>{cbClick.current=onMapClick;},[onMapClick]);
  useEffect(()=>{cbMove.current=onWaypointMove;},[onWaypointMove]);
  useEffect(()=>{cbDel.current=onWaypointDelete;},[onWaypointDelete]);
  useEffect(()=>{cbPathClick.current=onPathClick;},[onPathClick]);

  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);
    routeLayerRef.current=L.layerGroup().addTo(map);
    zoneLayerRef.current=L.layerGroup().addTo(map);
    puntiLayerRef.current=L.layerGroup().addTo(map);
    annotLayerRef.current=L.layerGroup().addTo(map);
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

export default FleetMap;
