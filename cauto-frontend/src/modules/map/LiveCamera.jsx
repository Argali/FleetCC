import React, { useState, useEffect, useRef } from "react";
import { API } from "@/api";
import T, { alpha } from "@/theme";
import { reverseGeocode } from "@/utils/geoUtils";
import { useIsMobile } from "@/hooks/useIsMobile";

const APP_VERSION = "0.1.0";

// ── Tipo catalogues ───────────────────────────────────────────────────────────
const TIPO_TERR = [
  { id: "mancata_raccolta", label: "Mancata raccolta", color: "#f87171" },
  { id: "abbandono",        label: "Abbandono",         color: "#fb923c" },
  { id: "da_pulire",        label: "Da pulire",         color: "#facc15" },
  { id: "altro",            label: "Altro",             color: "#94a3b8" },
];

const TIPO_TRUCK = [
  { id: "guasto",       label: "Guasto meccanico", color: "#f87171" },
  { id: "incidente",    label: "Incidente",         color: "#fb923c" },
  { id: "manutenzione", label: "Manutenzione",      color: "#facc15" },
  { id: "altro",        label: "Altro",             color: "#94a3b8" },
];

// ── Canvas stamp ─────────────────────────────────────────────────────────────
function drawStamp(canvas, ctx, stamp) {
  const { address, coords, version, datetime } = stamp;
  const lines = [`FleetCC v${version}`, address || "", coords, datetime].filter(Boolean);

  const PAD = 42, LINE_H = 60, FS = 45;
  ctx.font = `bold ${FS}px 'JetBrains Mono', Consolas, monospace`;
  const maxW  = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxW  = maxW + PAD * 2;
  const boxH  = lines.length * LINE_H + PAD * 1.5;
  const x = 48, y = canvas.height - boxH - 16;

  ctx.save(); ctx.globalAlpha = 0.72; ctx.fillStyle = "#0a1628";
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+boxW-r,y); ctx.quadraticCurveTo(x+boxW,y,x+boxW,y+r);
  ctx.lineTo(x+boxW,y+boxH-r); ctx.quadraticCurveTo(x+boxW,y+boxH,x+boxW-r,y+boxH);
  ctx.lineTo(x+r,y+boxH); ctx.quadraticCurveTo(x,y+boxH,x,y+boxH-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); ctx.fill(); ctx.restore();

  ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = "#4ade80";
  ctx.fillRect(x, y+18, 9, boxH-36); ctx.restore();

  lines.forEach((line, i) => {
    const ty = y + PAD + i * LINE_H;
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = "#000";
    ctx.font = `${i===0?"bold":"normal"} ${FS}px 'JetBrains Mono', Consolas, monospace`;
    ctx.fillText(line, x+PAD+24, ty+3); ctx.restore();
    ctx.save(); ctx.globalAlpha = 1;
    ctx.fillStyle = i===0 ? "#4ade80" : i===lines.length-1 ? "#60a5fa" : "#e2eaf5";
    ctx.font = `${i===0?"bold":"normal"} ${FS}px 'JetBrains Mono', Consolas, monospace`;
    ctx.fillText(line, x+PAD+21, ty); ctx.restore();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Btn({ children, color = T.blue, onClick, disabled, style = {}, scale = 1 }) {
  const p = v => Math.round(v * scale);
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: `${p(11)}px ${p(18)}px`, borderRadius: p(10),
        border: `1px solid ${color}66`,
        background: `${color}18`, color, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: p(13), fontFamily: T.font, fontWeight: 700, display: "flex",
        alignItems: "center", justifyContent: "center", gap: p(7),
        opacity: disabled ? 0.5 : 1, transition: "all 0.15s", ...style }}>
      {children}
    </button>
  );
}

function TipoList({ tipos, value, onChange, scale = 1 }) {
  const p = v => Math.round(v * scale);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: p(6) }}>
      {tipos.map(({ id, label, color }) => {
        const on = value === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            style={{ display: "flex", alignItems: "center", gap: p(10),
              padding: `${p(10)}px ${p(14)}px`,
              borderRadius: p(10), border: `1px solid ${on ? color+"88" : "rgba(255,255,255,0.1)"}`,
              background: on ? color+"18" : "rgba(255,255,255,0.04)", cursor: "pointer",
              textAlign: "left", fontFamily: T.font, transition: "all 0.12s" }}>
            <div style={{ width: p(13), height: p(13), borderRadius: "50%",
              border: `2px solid ${on ? color : "rgba(255,255,255,0.3)"}`,
              background: on ? color : "transparent", flexShrink: 0, transition: "all 0.12s" }} />
            <span style={{ fontSize: p(13), color: on ? color : "rgba(226,234,245,0.75)", fontWeight: on ? 700 : 400 }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NoteField({ name = "note", value, onChange, placeholder, required, scale = 1 }) {
  const p = v => Math.round(v * scale);
  const empty = !value.trim();
  return (
    <textarea id={name} name={name} value={value} onChange={e => onChange(e.target.value)} rows={3}
      placeholder={placeholder}
      style={{ width: "100%", background: "rgba(255,255,255,0.06)",
        border: `1px solid ${required && empty ? "#f8717166" : "rgba(255,255,255,0.12)"}`,
        borderRadius: p(8), color: "#e2eaf5", padding: `${p(9)}px ${p(12)}px`, fontSize: p(13),
        fontFamily: T.font, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveCamera({ position, auth, vehicles = [], onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const streamRef = useRef(null);

  const isMobile = useIsMobile();
  /** Scale helper: multiplies any pixel value by 1.5 on mobile */
  const s  = v => isMobile ? Math.round(v * 1.5) : v;
  const sc = isMobile ? 1.5 : 1;   // prop to pass to sub-components

  // Core
  const [status,          setStatus]          = useState("starting");
  const [errMsg,          setErrMsg]          = useState("");
  const [address,         setAddress]         = useState(null);
  const [busy,            setBusy]            = useState(false);
  const [videoNeedsRotate, setVideoNeedsRotate] = useState(false);

  // Captured photo
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl,   setPreviewUrl]   = useState(null);

  // Form
  const [action,        setAction]        = useState(null);   // "territorio"|"truck"|"comment"
  const [tipo,          setTipo]          = useState("");
  const [note,          setNote]          = useState("");
  const [manualAddress, setManualAddress] = useState("");     // fallback when GPS unavailable
  const [selVeh,        setSelVeh]        = useState(null);
  const [formErr,       setFormErr]       = useState(null);

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (position) reverseGeocode(position[0], position[1]).then(a => setAddress(a));
  }, []); // eslint-disable-line

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

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
          videoRef.current.addEventListener("loadedmetadata", () => {
            const vw = videoRef.current?.videoWidth  || 0;
            const vh = videoRef.current?.videoHeight || 0;
            setVideoNeedsRotate(window.innerHeight > window.innerWidth && vw > vh);
          }, { once: true });
          videoRef.current.play().catch(() => {});
        }
        setStatus("viewfinder");
      } catch { if (!cancelled) setStatus("fallback"); }
    }
    startCamera();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []); // eslint-disable-line

  // ── Stamp helper ─────────────────────────────────────────────────────────────
  function buildStamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    return {
      version:  APP_VERSION,
      address,
      coords:   position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : "Posizione non disponibile",
      datetime: `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${String(now.getFullYear()).slice(2)} - ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  }

  // ── Draw video to canvas with rotation fix ────────────────────────────────
  function drawVideoToCanvas(video, canvas) {
    const vw = video.videoWidth  || 1280;
    const vh = video.videoHeight || 720;
    // If the sensor returns landscape frames but the screen is portrait, rotate 90° CCW
    const needRotate = (window.innerHeight > window.innerWidth) && (vw > vh);
    let ctx;
    if (needRotate) {
      canvas.width  = vh;   // portrait: width = sensor height
      canvas.height = vw;   // portrait: height = sensor width
      ctx = canvas.getContext("2d");
      ctx.translate(0, vw);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(video, 0, 0, vw, vh);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset for stamp
    } else {
      canvas.width  = vw;
      canvas.height = vh;
      ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, vw, vh);
    }
    return ctx;
  }

  // ── Capture from live viewfinder ─────────────────────────────────────────
  async function captureFromCamera() {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    setStatus("capturing");
    try {
      const ctx = drawVideoToCanvas(video, canvas);
      drawStamp(canvas, ctx, buildStamp());
      const blob = await new Promise((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error("Canvas vuoto")), "image/jpeg", 0.92)
      );
      showPreview(blob);
    } catch (e) { setErrMsg(e.message || "Errore cattura"); setStatus("error"); }
  }

  // ── Capture from file picker (with EXIF fix) ──────────────────────────────
  async function handleFallbackFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("capturing");
    try {
      const canvas = canvasRef.current;
      let source;
      try {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        const url = URL.createObjectURL(file);
        source = await new Promise((res, rej) => {
          const img = new Image();
          img.onload  = () => { URL.revokeObjectURL(url); res(img); };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Impossibile leggere la foto")); };
          img.src = url;
        });
      }
      canvas.width  = source.width  ?? source.naturalWidth;
      canvas.height = source.height ?? source.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(source, 0, 0);
      if (source.close) source.close();
      drawStamp(canvas, ctx, buildStamp());
      const blob = await new Promise((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error("Canvas vuoto")), "image/jpeg", 0.92)
      );
      showPreview(blob);
    } catch (err) { setErrMsg(err.message || "Errore upload"); setStatus("error"); }
  }

  function showPreview(blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setCapturedBlob(blob);
    setPreviewUrl(url);
    setStatus("preview");
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setCapturedBlob(null);
    setAction(null); setTipo(""); setNote(""); setManualAddress(""); setSelVeh(null); setFormErr(null);
    setStatus("viewfinder");
  }

  // ── Upload helpers ────────────────────────────────────────────────────────
  async function uploadTerritorio(blob) {
    if (!tipo) { setFormErr("Seleziona un tipo"); return; }
    if (tipo === "altro" && !note.trim()) { setFormErr("Nota obbligatoria per 'Altro'"); return; }
    const resolvedAddress = address || manualAddress.trim() || null;
    if (!resolvedAddress && position == null) {
      setFormErr("Inserisci un indirizzo oppure attiva il GPS"); return;
    }
    setBusy(true); setFormErr(null);
    try {
      const r1 = await fetch(`${API}/segnalazioni-territorio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, note: note.trim() || null,
          address: resolvedAddress,
          lat: position?.[0] ?? null, lng: position?.[1] ?? null }),
      });
      const d1 = await r1.json();
      if (!d1.ok) throw new Error(d1.error || "Errore creazione segnalazione");
      const fd = new FormData();
      fd.append("photo", blob, "photo.jpg");
      if (note.trim()) fd.append("note", note.trim());
      const r2 = await fetch(`${API}/segnalazioni-territorio/${d1.data.id}/intervento`, {
        method: "POST", headers: { Authorization: `Bearer ${auth.token}` }, body: fd,
      });
      const d2 = await r2.json();
      if (!d2.ok) throw new Error(d2.error || "Errore upload foto");
      done();
    } catch (e) { setErrMsg(e.message); setStatus("error"); } finally { setBusy(false); }
  }

  async function uploadTruck(blob) {
    if (!selVeh) { setFormErr("Seleziona un veicolo"); return; }
    if (!note.trim()) { setFormErr("La descrizione del problema è obbligatoria"); return; }
    if (!tipo) { setFormErr("Seleziona un tipo"); return; }
    setBusy(true); setFormErr(null);
    try {
      const fd = new FormData();
      fd.append("reporter_name", auth.user?.name || "Operatore");
      fd.append("vehicle", selVeh.name);
      fd.append("plate",   selVeh.plate || "");
      fd.append("settore", selVeh.sector || "Generico");
      fd.append("description", note.trim());
      fd.append("tipo", tipo);
      fd.append("photo", blob, "photo.jpg");
      const r = await fetch(`${API}/segnalazioni`, {
        method: "POST", headers: { Authorization: `Bearer ${auth.token}` }, body: fd,
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Errore upload");
      done();
    } catch (e) { setErrMsg(e.message); setStatus("error"); } finally { setBusy(false); }
  }

  async function uploadComment(blob) {
    setBusy(true); setFormErr(null);
    try {
      const fd = new FormData();
      fd.append("photo", blob, "photo.jpg");
      const r = await fetch(`${API}/gps/photo`, {
        method: "POST", headers: { Authorization: `Bearer ${auth.token}` }, body: fd,
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Upload fallito");
      done();
    } catch (e) { setErrMsg(e.message); setStatus("error"); } finally { setBusy(false); }
  }

  function done() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setCapturedBlob(null);
    setStatus("done");
    setTimeout(onClose, 1500);
  }

  // ── Shared overlay wrapper ────────────────────────────────────────────────
  const Overlay = ({ children }) => (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      background: "rgba(5,12,24,0.97)", zIndex: 10, fontFamily: T.font, overflowY: "auto" }}>
      {children}
    </div>
  );

  // ── Section header ────────────────────────────────────────────────────────
  const SectionTitle = ({ icon, title, sub }) => (
    <div style={{ display: "flex", alignItems: "center", gap: s(10), marginBottom: s(16) }}>
      <div style={{ width: s(30), height: s(30), borderRadius: s(8),
        background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: s(15) }}>{icon}</div>
      <div>
        <div style={{ fontSize: s(14), fontWeight: 700, color: "#e2eaf5" }}>{title}</div>
        {sub && <div style={{ fontSize: s(11), color: "rgba(226,234,245,0.45)" }}>{sub}</div>}
      </div>
    </div>
  );

  const isBusy = status === "capturing" || status === "uploading";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 2000,
      display: "flex", flexDirection: "column", fontFamily: T.font }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <input ref={fileRef} id="camera-file-input" name="camera-file-input"
        type="file" accept="image/*" capture="environment"
        onChange={handleFallbackFile} style={{ display: "none" }} />

      {/* Live video (background) */}
      {/* When the camera sensor outputs landscape frames on a portrait screen,
          we rotate the video element -90° via CSS so the viewfinder matches
          what drawVideoToCanvas() will produce on capture. */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{
          position: "absolute", objectFit: "cover", pointerEvents: "none",
          ...(videoNeedsRotate
            ? {
                /* Swap width/height so the rotated video fills the portrait screen */
                width: "100vh", height: "100vw",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%) rotate(-90deg)",
              }
            : { inset: 0, width: "100%", height: "100%" }),
          opacity: status === "viewfinder" ? 1 : status === "capturing" ? 0.4 : 0,
          transition: "opacity 0.2s",
        }} />

      {/* ── STARTING ── */}
      {status === "starting" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <span style={{ color: T.textSub, fontSize: 13 }}>Apertura fotocamera…</span>
        </div>
      )}

      {/* ── FALLBACK ── */}
      {status === "fallback" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.yellow} strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span style={{ color: T.text, fontSize: 14, textAlign: "center" }}>
            Fotocamera non disponibile.<br/>Scegli una foto dalla galleria.
          </span>
          <button onClick={() => fileRef.current.click()}
            style={{ padding: "12px 28px", background: T.navActive, border: `1px solid ${alpha(T.blue,33)}`, borderRadius: 10, color: T.blue, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
            Scegli foto
          </button>
        </div>
      )}

      {/* ── CAPTURING spinner ── */}
      {status === "capturing" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, border: `3px solid #fff`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      )}

      {/* ── VIEWFINDER controls ── */}
      {status === "viewfinder" && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px 36px",
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))", display: "flex",
          flexDirection: "column", gap: 10, alignItems: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 1.6 }}>
            <span style={{ color: T.green, fontWeight: 700 }}>FleetCC v{APP_VERSION}</span>
            {address && <><br />{address}</>}
            {position && <><br />{position[0].toFixed(5)}, {position[1].toFixed(5)}</>}
          </div>
          <button onClick={captureFromCamera}
            style={{ width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.92)",
              border: "4px solid rgba(255,255,255,0.35)", cursor: "pointer",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.2), 0 4px 20px rgba(0,0,0,0.55)",
              transition: "transform 0.1s" }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.9)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          />
        </div>
      )}

      {/* ── PREVIEW ── */}
      {status === "preview" && previewUrl && (
        <Overlay>
          <img src={previewUrl} alt="Anteprima"
            style={{ width: "100%", maxHeight: "55vh", objectFit: "contain", background: "#000", flexShrink: 0 }} />
          <div style={{ padding: `${s(20)}px ${s(20)}px ${s(32)}px`, display: "flex", flexDirection: "column", gap: s(12) }}>
            <div style={{ fontSize: s(14), fontWeight: 700, color: "#e2eaf5" }}>Foto acquisita</div>
            <div style={{ fontSize: s(12), color: "rgba(226,234,245,0.5)", marginBottom: s(4) }}>
              La foto è nitida e ben orientata?
            </div>
            <div style={{ display: "flex", gap: s(10) }}>
              <Btn color={T.textSub} onClick={retake} scale={sc} style={{ flex: 1 }}>
                ← Riprova
              </Btn>
              <Btn color={T.green} onClick={() => setStatus("choose")} scale={sc} style={{ flex: 2 }}>
                Continua →
              </Btn>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── CHOOSE ACTION ── */}
      {status === "choose" && (
        <Overlay>
          {/* Small thumbnail strip */}
          {previewUrl && (
            <div style={{ height: s(80), overflow: "hidden", flexShrink: 0, position: "relative" }}>
              <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5) blur(2px)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: s(11), color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Foto timbrata pronta</span>
              </div>
            </div>
          )}
          <div style={{ padding: `${s(20)}px ${s(20)}px ${s(32)}px`, display: "flex", flexDirection: "column", gap: s(10) }}>
            <div style={{ fontSize: s(14), fontWeight: 700, color: "#e2eaf5", marginBottom: s(6) }}>Cosa vuoi segnalare?</div>

            {/* Option: Territorio */}
            <button onClick={() => { setAction("territorio"); setStatus("form"); }}
              style={{ display: "flex", alignItems: "center", gap: s(14), padding: `${s(14)}px ${s(16)}px`,
                borderRadius: s(12), border: "1px solid rgba(251,146,60,0.4)", background: "rgba(251,146,60,0.08)",
                cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
              <span style={{ fontSize: s(24), flexShrink: 0 }}>📋</span>
              <div>
                <div style={{ fontSize: s(14), fontWeight: 700, color: "#fb923c" }}>Segnalazione territorio</div>
                <div style={{ fontSize: s(11), color: "rgba(226,234,245,0.5)", marginTop: s(2) }}>
                  Abbandono, mancata raccolta, zona da pulire…
                </div>
              </div>
            </button>

            {/* Option: Camion */}
            <button onClick={() => { setAction("truck"); setStatus("form"); }}
              style={{ display: "flex", alignItems: "center", gap: s(14), padding: `${s(14)}px ${s(16)}px`,
                borderRadius: s(12), border: "1px solid rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.08)",
                cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
              <span style={{ fontSize: s(24), flexShrink: 0 }}>🚛</span>
              <div>
                <div style={{ fontSize: s(14), fontWeight: 700, color: "#60a5fa" }}>Segnalazione veicolo</div>
                <div style={{ fontSize: s(11), color: "rgba(226,234,245,0.5)", marginTop: s(2) }}>
                  Guasto, incidente, manutenzione su un mezzo…
                </div>
              </div>
            </button>

            {/* Option: Comment only */}
            <button onClick={() => { setAction("comment"); setStatus("form"); }}
              style={{ display: "flex", alignItems: "center", gap: s(14), padding: `${s(14)}px ${s(16)}px`,
                borderRadius: s(12), border: "1px solid rgba(148,163,184,0.3)", background: "rgba(148,163,184,0.06)",
                cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
              <span style={{ fontSize: s(24), flexShrink: 0 }}>💬</span>
              <div>
                <div style={{ fontSize: s(14), fontWeight: 700, color: "#94a3b8" }}>Solo foto / commento</div>
                <div style={{ fontSize: s(11), color: "rgba(226,234,245,0.5)", marginTop: s(2) }}>
                  Salva la foto con una nota, senza aprire una segnalazione
                </div>
              </div>
            </button>

            <button onClick={() => setStatus("preview")}
              style={{ marginTop: s(4), padding: `${s(9)}px`, background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: s(8),
                color: "rgba(226,234,245,0.4)", cursor: "pointer", fontSize: s(12), fontFamily: T.font }}>
              ← Torna all'anteprima
            </button>
          </div>
        </Overlay>
      )}

      {/* ── FORM (depends on action) ── */}
      {status === "form" && (
        <Overlay>
          <div style={{ padding: `${s(20)}px ${s(20)}px ${s(36)}px`, display: "flex", flexDirection: "column", gap: s(14), flex: 1 }}>

            {/* ── TERRITORIO form ── */}
            {action === "territorio" && (<>
              <SectionTitle icon="📋" title="Segnalazione territorio"
                sub={address || (position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : "Posizione non disponibile")} />

              {/* Manual address input when GPS not available */}
              {!address && !position && (
                <div style={{ display: "flex", flexDirection: "column", gap: s(4) }}>
                  <label htmlFor="manual-address"
                    style={{ fontSize: s(11), color: "#fb923c", fontWeight: 600 }}>
                    ⚠ GPS non attivo — inserisci l'indirizzo manualmente
                  </label>
                  <input id="manual-address" name="manual-address"
                    value={manualAddress}
                    onChange={e => { setManualAddress(e.target.value); setFormErr(null); }}
                    placeholder="Es. Via Roma 12, Mori, Trento"
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${!manualAddress.trim() ? "rgba(251,146,60,0.5)" : "rgba(255,255,255,0.18)"}`,
                      borderRadius: s(8), color: "#e2eaf5", padding: `${s(9)}px ${s(12)}px`, fontSize: s(13),
                      fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
              )}

              <TipoList tipos={TIPO_TERR} value={tipo} onChange={v => { setTipo(v); setFormErr(null); }} scale={sc} />
              {tipo && (
                <NoteField name="note-territorio" value={note} onChange={setNote}
                  placeholder={tipo === "altro" ? "Descrivi il problema (obbligatorio)…" : "Note aggiuntive (opzionale)…"}
                  required={tipo === "altro"} scale={sc} />
              )}
            </>)}

            {/* ── TRUCK form ── */}
            {action === "truck" && (<>
              <SectionTitle icon="🚛" title="Segnalazione veicolo" sub="Seleziona il mezzo interessato" />
              {vehicles.length === 0 ? (
                <div style={{ padding: s(16), borderRadius: s(10), background: "rgba(255,255,255,0.04)",
                  color: "rgba(226,234,245,0.4)", fontSize: s(13), textAlign: "center" }}>
                  Nessun veicolo disponibile
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: s(6), maxHeight: "28vh", overflowY: "auto" }}>
                  {vehicles.map(v => {
                    const on = selVeh?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => { setSelVeh(v); setFormErr(null); }}
                        style={{ display: "flex", alignItems: "center", gap: s(10),
                          padding: `${s(10)}px ${s(14)}px`,
                          borderRadius: s(10), border: `1px solid ${on ? "#60a5fa88" : "rgba(255,255,255,0.1)"}`,
                          background: on ? "#60a5fa18" : "rgba(255,255,255,0.04)", cursor: "pointer",
                          textAlign: "left", fontFamily: T.font }}>
                        <div style={{ width: s(13), height: s(13), borderRadius: "50%",
                          border: `2px solid ${on ? "#60a5fa" : "rgba(255,255,255,0.3)"}`,
                          background: on ? "#60a5fa" : "transparent", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: s(13), fontWeight: on ? 700 : 400, color: on ? "#60a5fa" : "#e2eaf5" }}>
                            {v.name}
                          </div>
                          <div style={{ fontSize: s(10), color: "rgba(226,234,245,0.45)" }}>
                            {v.plate}{v.sector ? ` · ${v.sector}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selVeh && (<>
                <TipoList tipos={TIPO_TRUCK} value={tipo} onChange={v => { setTipo(v); setFormErr(null); }} scale={sc} />
                <NoteField name="note-truck" value={note} onChange={setNote}
                  placeholder="Descrivi il problema (obbligatorio)…" required scale={sc} />
              </>)}
            </>)}

            {/* ── COMMENT form ── */}
            {action === "comment" && (<>
              <SectionTitle icon="💬" title="Foto con commento" sub="La foto verrà salvata nel modulo GPS" />
              <NoteField name="note-comment" value={note} onChange={setNote}
                placeholder="Aggiungi una nota (opzionale)…" scale={sc} />
            </>)}

            {/* Error */}
            {formErr && (
              <div style={{ fontSize: s(12), color: "#f87171", padding: `${s(7)}px ${s(10)}px`,
                background: "rgba(248,113,113,0.1)", borderRadius: s(7),
                border: "1px solid rgba(248,113,113,0.25)" }}>
                {formErr}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: s(10), marginTop: "auto" }}>
              <Btn color={T.textSub} onClick={() => setStatus("choose")} disabled={busy} scale={sc} style={{ flex: 1 }}>
                ← Indietro
              </Btn>
              <Btn
                color={action === "territorio" ? "#fb923c" : action === "truck" ? "#60a5fa" : "#94a3b8"}
                disabled={busy} scale={sc}
                onClick={() => {
                  if (action === "territorio") uploadTerritorio(capturedBlob);
                  else if (action === "truck") uploadTruck(capturedBlob);
                  else uploadComment(capturedBlob);
                }}
                style={{ flex: 2 }}>
                {busy && <span style={{ display: "inline-block", width: s(12), height: s(12),
                  border: "2px solid currentColor", borderTopColor: "transparent",
                  borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                {busy ? "Invio…" : "Invia"}
              </Btn>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── DONE ── */}
      {status === "done" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: s(12) }}>
          <div style={{ width: s(58), height: s(58), borderRadius: "50%", background: "rgba(74,222,128,0.15)",
            border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={s(28)} height={s(28)} viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span style={{ color: T.green, fontSize: s(16), fontWeight: 700 }}>
            {action === "territorio" ? "Segnalazione creata" :
             action === "truck"      ? "Segnalazione veicolo creata" : "Foto salvata"}
          </span>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === "error" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: s(14), padding: s(32) }}>
          <span style={{ color: T.red, fontSize: s(14), textAlign: "center" }}>{errMsg}</span>
          <div style={{ display: "flex", gap: s(10) }}>
            <Btn color={T.textSub} onClick={retake} scale={sc}>← Riprendi foto</Btn>
            <Btn color={T.red} onClick={() => setStatus("form")} scale={sc}>Riprova invio</Btn>
          </div>
        </div>
      )}

      {/* Close button (not during active upload or done) */}
      {!["capturing", "done"].includes(status) && !busy && (
        <button onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34,
            borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", fontSize: 19, lineHeight: "32px", textAlign: "center",
            cursor: "pointer", backdropFilter: "blur(4px)", zIndex: 20 }}>
          ×
        </button>
      )}
    </div>
  );
}
