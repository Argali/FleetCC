import React, { useState, useEffect, useRef } from "react";
import { API } from "@/api";
import T, { alpha } from "@/theme";
import { reverseGeocode } from "@/utils/geoUtils";

const APP_VERSION = "0.1.0";

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

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(x, y + 18, 9, boxH - 36);
  ctx.restore();

  lines.forEach((line, i) => {
    const ty = y + PAD + i * LINE_H;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#000";
    ctx.font = `${i === 0 ? "bold" : "normal"} ${FONT_SIZE}px 'JetBrains Mono', Consolas, monospace`;
    ctx.fillText(line, x + PAD + 21 + 3, ty + 3);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = i === 0 ? "#4ade80" : i === lines.length - 1 ? "#60a5fa" : "#e2eaf5";
    ctx.font = `${i === 0 ? "bold" : "normal"} ${FONT_SIZE}px 'JetBrains Mono', Consolas, monospace`;
    ctx.fillText(line, x + PAD + 21, ty);
    ctx.restore();
  });
}

export default function LiveCamera({ position, auth, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const fileRef    = useRef(null);
  const streamRef  = useRef(null);
  const [status, setStatus]   = useState("starting");
  const [errMsg, setErrMsg]   = useState("");
  const [address, setAddress] = useState(null);

  useEffect(() => {
    if (position) reverseGeocode(position[0], position[1]).then(a => setAddress(a));
  }, []); // eslint-disable-line

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
          videoRef.current.play().catch(() => {});
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

    try {
      const canvas = canvasRef.current;
      const ctx    = canvas.getContext("2d");

      // createImageBitmap with imageOrientation:"from-image" respects the EXIF
      // rotation tag so portrait photos from the camera app are not drawn sideways.
      // Falls back to HTMLImageElement for older browsers (Chrome 79+, Safari 15.4+,
      // Firefox 90+ all support the imageOrientation option natively).
      let source;
      try {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        // Fallback: Image element (modern browsers also respect EXIF here)
        const url = URL.createObjectURL(file);
        source = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Impossibile leggere la foto")); };
          img.src = url;
        });
      }

      canvas.width  = source.width  ?? source.naturalWidth;
      canvas.height = source.height ?? source.naturalHeight;
      ctx.drawImage(source, 0, 0);
      if (source.close) source.close(); // free ImageBitmap memory

      drawStamp(canvas, ctx, buildStampData());

      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas vuoto")), "image/jpeg", 0.92)
      );
      await uploadBlob(blob);
      setStatus("done");
      setTimeout(onClose, 1400);
    } catch (err) {
      setErrMsg(err.message || "Errore upload");
      setStatus("error");
    }
  }

  const isBusy = status === "capturing" || status === "uploading";

  return (
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:2000,display:"flex",flexDirection:"column",fontFamily:T.font}}>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFallbackFile} style={{display:"none"}}/>

      <video ref={videoRef} autoPlay playsInline muted
        style={{
          position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",
          opacity:(status==="viewfinder"||status==="capturing"||status==="uploading")?(isBusy?0.5:1):0,
          transition:"opacity 0.2s",
          pointerEvents:"none",
        }}/>

      {status === "starting" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
          <div style={{width:36,height:36,border:`3px solid ${T.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
          <span style={{color:T.textSub,fontSize:13}}>Apertura fotocamera…</span>
        </div>
      )}

      {status === "fallback" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:32}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.yellow} strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style={{color:T.text,fontSize:14,textAlign:"center"}}>Fotocamera non disponibile in questo browser.<br/>Scegli una foto dalla galleria.</span>
          <button onClick={() => fileRef.current.click()} style={{padding:"12px 28px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:10,color:T.blue,cursor:"pointer",fontSize:14,fontWeight:700}}>Scegli foto</button>
        </div>
      )}

      {status === "done" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(74,222,128,0.15)",border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span style={{color:T.green,fontSize:16,fontWeight:700}}>Foto salvata</span>
        </div>
      )}

      {status === "error" && (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,padding:32}}>
          <span style={{color:T.red,fontSize:14,textAlign:"center"}}>{errMsg}</span>
          <button onClick={() => setStatus("viewfinder")} style={{padding:"10px 24px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.textSub,cursor:"pointer",fontSize:13}}>Riprova</button>
        </div>
      )}

      {status === "uploading" && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
          <div style={{width:36,height:36,border:`3px solid ${T.green}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
          <span style={{color:"#fff",fontSize:13,fontWeight:600,textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>Caricamento…</span>
        </div>
      )}

      {(status === "viewfinder" || status === "capturing") && (
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"16px 20px 32px",background:"linear-gradient(transparent, rgba(0,0,0,0.8))",display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          <div style={{fontFamily:T.mono,fontSize:11,color:"rgba(255,255,255,0.65)",textAlign:"center",lineHeight:1.6}}>
            <span style={{color:T.green,fontWeight:700}}>FleetCC v{APP_VERSION}</span>
            {address && <><br/>{address}</>}
            {position && <><br/>{position[0].toFixed(5)}, {position[1].toFixed(5)}</>}
          </div>
          <button onClick={captureAndUpload} disabled={isBusy}
            style={{width:68,height:68,borderRadius:"50%",background:"rgba(255,255,255,0.92)",border:"4px solid rgba(255,255,255,0.4)",cursor:isBusy?"not-allowed":"pointer",boxShadow:"0 0 0 2px rgba(255,255,255,0.2), 0 4px 16px rgba(0,0,0,0.5)",transition:"transform 0.1s",flexShrink:0}}
            onMouseDown={e=>e.currentTarget.style.transform="scale(0.93)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
          />
        </div>
      )}

      {!isBusy && status !== "done" && (
        <button onClick={onClose}
          style={{position:"absolute",top:16,right:16,width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,0.55)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",fontSize:20,lineHeight:"34px",textAlign:"center",cursor:"pointer",backdropFilter:"blur(4px)"}}>
          ×
        </button>
      )}
    </div>
  );
}
