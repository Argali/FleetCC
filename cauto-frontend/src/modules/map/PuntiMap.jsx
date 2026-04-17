import React, { useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import T from "@/theme";

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

export default PuntiMap;
