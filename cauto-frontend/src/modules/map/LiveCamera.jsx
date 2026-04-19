import React, { useState, useEffect, useRef } from "react";
import { API } from "@/api";
import T, { alpha } from "@/theme";
import { reverseGeocode } from "@/utils/geoUtils";

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
function Btn({ children, color = T.blue, onClick, disabled, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "11px 18px", borderRadius: 10, border: `1px solid ${color}66`,
        background: `${color}18`, color, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13, fontFamily: T.font, fontWeight: 700, display: "flex",
        alignItems: "center", justifyContent: "center", gap: 7,
        opacity: disabled ? 0.5 : 1, transition: "all 0.15s", ...style }}>
      {children}
    </button>
  );
}

function TipoList({ tipos, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tipos.map(({ id, label, color }) => {
        const on = value === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              borderRadius: 10, border: `1px solid ${on ? color+"88" : "rgba(255,255,255,0.1)"}`,
              background: on ? color+"18" : "rgba(255,255,255,0.04)", cursor: "pointer",
              textAlign: "left", fontFamily: T.font, transition: "all 0.12s" }}>
            <div style={{ width: 13, height: 13, borderRadius: "50%",
              border: `2px solid ${on ? color : "rgba(255,255,255,0.3)"}`,
              background: on ? color : "transparent", flexShrink: 0, transition: "all 0.12s" }} />
            <span style={{ fontSize: 13, color: on ? color : "rgba(226,234,245,0.75)", fontWeight: on ? 700 : 400 }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NoteField({ value, onChange, placeholder, required, tipo }) {
  const empty = !value.trim();
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
      placeholder={placeholder}
      style={{ width: "100%", background: "rgba(255,255,255,0.06)",
        border: `1px solid ${required && empty ? "#f8717166" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 8, color: "#e2eaf5", padding: "9px 12px", fontSize: 13,
        fontFamily: T.font, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveCamera({ position, auth, vehicles = [], onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const streamRef = useRef(null);

  // Core
  const [status,   setStatus]   = useState("starting");
  const [errMsg,   setErrMsg]   = useState("");
  const [address,  setAddress]  = useState(null);
  const [busy,     setBusy]     = useState(false);

  // Captured photo
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl,   setPreviewUrl]   = useState(null);

  // Form
  const [action,   setAction]   = useState(null);   // "territorio"|"truck"|"comment"
  const [tipo,     setTipo]     = useState("");
  const [note,     setNote]     = useState("");
  const [selVeh,   setSelVeh]   = useState(null);
  const [formErr,  setFormErr]  = useState(null);

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
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
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
    setAction(null); setTipo(""); setNote(""); setSelVeh(null); setFormErr(null);
    setStatus("viewfinder");
  }

  // ── Upload helpers ────────────────────────────────────────────────────────
  async function uploadTerritorio(blob) {
    if (!tipo) { setFormErr("Seleziona un tipo"); return; }
    if (tipo === "altro" && !note.trim()) { setFormErr("Nota obbligatoria per 'Altro'"); return; }
    setBusy(true); setFormErr(null);
    try {
      const r1 = await fetch(`${API}/segnalazioni-territorio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, note: note.trim() || null, address: address || null,
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(96,165,250,0.15)",
        border: "1px solid rgba(96,165,250,0.3)", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0, fontSize: 15 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2eaf5" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "rgba(226,234,245,0.45)" }}>{sub}</div>}
      </div>
    </div>
  );

  const isBusy = status === "capturing" || status === "uploading";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 2000,
      display: "flex", flexDirection: "column", fontFamily: T.font }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        onChange={handleFallbackFile} style={{ display: "none" }} />

      {/* Live video (background) */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover",
          opacity: status === "viewfinder" ? 1 : status === "capturing" ? 0.4 : 0,
          transition: "opacity 0.2s", pointerEvents: "none" }} />

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
          <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2eaf5" }}>Foto acquisita</div>
            <div style={{ fontSize: 12, color: "rgba(226,234,245,0.5)", marginBottom: 4 }}>
              La foto è nitida e ben orientata?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn color={T.textSub} onClick={retake} style={{ flex: 1 }}>
                ← Riprova
              </Btn>
              <Btn color={T.green} onClick={() => setStatus("choose")} style={{ flex: 2 }}>
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
            <div style={{ height: 80, overflow: "hidden", flexShrink: 0, position: "relative" }}>
              <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5) blur(2px)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Foto timbrata pronta</span>
              </div>
            </div>
          )}
          <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2eaf5", marginBottom: 6 }}>Cosa vuoi segnalare?</div>

            {/* Option: Territorio */}
            <button onClick={() => { setAction("territorio"); setStatus("form"); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderRadius: 12, border: "1px solid rgba(251,146,60,0.4)", background: "rgba(251,146,60,0.08)",
                cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>📋</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fb923c" }}>Segnalazione territorio</div>
                <div style={{ fontSize: 11, color: "rgba(226,234,245,0.5)", marginTop: 2 }}>
                  Abbandono, mancata raccolta, zona da pulire…
                </div>
              </div>
            </button>

            {/* Option: Camion */}
            <button onClick={() => { setAction("truck"); setStatus("form"); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderRadius: 12, border: "1px solid rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.08)",
                cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>🚛</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>Segnalazione veicolo</div>
                <div style={{ fontSize: 11, color: "rgba(226,234,245,0.5)", marginTop: 2 }}>
                  Guasto, incidente, manutenzione su un mezzo…
                </div>
              </div>
            </button>

            {/* Option: Comment only */}
            <button onClick={() => { setAction("comment"); setStatus("form"); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", background: "rgba(148,163,184,0.06)",
                cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>💬</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>Solo foto / commento</div>
                <div style={{ fontSize: 11, color: "rgba(226,234,245,0.5)", marginTop: 2 }}>
                  Salva la foto con una nota, senza aprire una segnalazione
                </div>
              </div>
            </button>

            <button onClick={() => setStatus("preview")}
              style={{ marginTop: 4, padding: "9px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                color: "rgba(226,234,245,0.4)", cursor: "pointer", fontSize: 12, fontFamily: T.font }}>
              ← Torna all'anteprima
            </button>
          </div>
        </Overlay>
      )}

      {/* ── FORM (depends on action) ── */}
      {status === "form" && (
        <Overlay>
          <div style={{ padding: "20px 20px 36px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>

            {/* ── TERRITORIO form ── */}
            {action === "territorio" && (<>
              <SectionTitle icon="📋" title="Segnalazione territorio"
                sub={address || (position ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : "Posizione non disponibile")} />
              <TipoList tipos={TIPO_TERR} value={tipo} onChange={v => { setTipo(v); setFormErr(null); }} />
              {tipo && (
                <NoteField value={note} onChange={setNote}
                  placeholder={tipo === "altro" ? "Descrivi il problema (obbligatorio)…" : "Note aggiuntive (opzionale)…"}
                  required={tipo === "altro"} />
              )}
            </>)}

            {/* ── TRUCK form ── */}
            {action === "truck" && (<>
              <SectionTitle icon="🚛" title="Segnalazione veicolo" sub="Seleziona il mezzo interessato" />
              {vehicles.length === 0 ? (
                <div style={{ padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.04)",
                  color: "rgba(226,234,245,0.4)", fontSize: 13, textAlign: "center" }}>
                  Nessun veicolo disponibile
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "28vh", overflowY: "auto" }}>
                  {vehicles.map(v => {
                    const on = selVeh?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => { setSelVeh(v); setFormErr(null); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderRadius: 10, border: `1px solid ${on ? "#60a5fa88" : "rgba(255,255,255,0.1)"}`,
                          background: on ? "#60a5fa18" : "rgba(255,255,255,0.04)", cursor: "pointer",
                          textAlign: "left", fontFamily: T.font }}>
                        <div style={{ width: 13, height: 13, borderRadius: "50%",
                          border: `2px solid ${on ? "#60a5fa" : "rgba(255,255,255,0.3)"}`,
                          background: on ? "#60a5fa" : "transparent", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: on ? 700 : 400, color: on ? "#60a5fa" : "#e2eaf5" }}>
                            {v.name}
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(226,234,245,0.45)" }}>
                            {v.plate}{v.sector ? ` · ${v.sector}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selVeh && (<>
                <TipoList tipos={TIPO_TRUCK} value={tipo} onChange={v => { setTipo(v); setFormErr(null); }} />
                <NoteField value={note} onChange={setNote}
                  placeholder="Descrivi il problema (obbligatorio)…" required />
              </>)}
            </>)}

            {/* ── COMMENT form ── */}
            {action === "comment" && (<>
              <SectionTitle icon="💬" title="Foto con commento" sub="La foto verrà salvata nel modulo GPS" />
              <NoteField value={note} onChange={setNote} placeholder="Aggiungi una nota (opzionale)…" />
            </>)}

            {/* Error */}
            {formErr && (
              <div style={{ fontSize: 12, color: "#f87171", padding: "7px 10px",
                background: "rgba(248,113,113,0.1)", borderRadius: 7,
                border: "1px solid rgba(248,113,113,0.25)" }}>
                {formErr}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
              <Btn color={T.textSub} onClick={() => setStatus("choose")} disabled={busy} style={{ flex: 1 }}>
                ← Indietro
              </Btn>
              <Btn
                color={action === "territorio" ? "#fb923c" : action === "truck" ? "#60a5fa" : "#94a3b8"}
                disabled={busy}
                onClick={() => {
                  if (action === "territorio") uploadTerritorio(capturedBlob);
                  else if (action === "truck") uploadTruck(capturedBlob);
                  else uploadComment(capturedBlob);
                }}
                style={{ flex: 2 }}>
                {busy && <span style={{ display: "inline-block", width: 12, height: 12,
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
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "rgba(74,222,128,0.15)",
            border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span style={{ color: T.green, fontSize: 16, fontWeight: 700 }}>
            {action === "territorio" ? "Segnalazione creata" :
             action === "truck"      ? "Segnalazione veicolo creata" : "Foto salvata"}
          </span>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === "error" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 32 }}>
          <span style={{ color: T.red, fontSize: 14, textAlign: "center" }}>{errMsg}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn color={T.textSub} onClick={retake}>← Riprendi foto</Btn>
            <Btn color={T.red} onClick={() => setStatus("form")}>Riprova invio</Btn>
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
