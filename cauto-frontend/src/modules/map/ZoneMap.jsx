import React, { useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import T from "@/theme";

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

export default ZoneMap;
