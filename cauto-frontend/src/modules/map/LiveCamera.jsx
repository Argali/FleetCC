import React, { useState, useEffect, useRef } from "react";
import { API } from "@/api";
import T, { alpha } from "@/theme";
import { reverseGeocode } from "@/utils/geoUtils";

const APP_VERSION = "0.1.0";

const TIPO_META = {
  mancata_raccolta: { label: "Mancata raccolta", color: "#f87171" },
  abbandono:        { label: "Abbandono",         color: "#fb923c" },
  da_pulire:        { label: "Da pulire",          color: "#facc15" },
  altro:            { label: "Altro",              color: "#94a3b8" },
};

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

// ── Segnalazione form (shown after capture in segnalazione mode) ───────────────
function SegForm({ previewUrl, address, onConfirm, onRetry, busy }) {
  const [tipo, setTipo] = useState("");
  const [note, setNote] = useState("");
  const [err,  setErr]  = useState(null);

  function handleConfirm() {
    if (!tipo) { setErr("Seleziona un tipo di segnalazione"); return; }
    if (tipo === "altro" && !note.trim()) { setErr("La nota è obbligatoria per 'Altro'"); return; }
    setErr(null);
    onConfirm({ tipo, note: note.trim() || null });
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.92)", zIndex: 10, fontFamily: T.font }}>
      {/* Preview thumbnail */}
      <div style={{ flex: "0 0 auto", maxHeight: "38vh", overflow: "hidden", position: "relative" }}>
        <img src={previewUrl} alt="Foto acquisita"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(0.75)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)" }} />
        <div style={{ position: "absolute", bottom: 10, left: 14, fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
          {address || "Posizione acquisita"}
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,146,60,0.18)", border: "1px solid rgba(251,146,60,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2.2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2eaf5" }}>Nuova segnalazione</div>
            <div style={{ fontSize: 11, color: "rgba(226,234,245,0.5)" }}>Seleziona il tipo di problema</div>
          </div>
        </div>

        {/* Tipo buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(TIPO_META).map(([id, { label, color }]) => {
            const active = tipo === id;
            return (
              <button key={id} onClick={() => { setTipo(id); if (id !== "altro") setNote(""); setErr(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${active ? color + "88" : "rgba(255,255,255,0.1)"}`, background: active ? color + "18" : "rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left", fontFamily: T.font, transition: "all 0.12s" }}>
                <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${active ? color : "rgba(255,255,255,0.3)"}`, background: active ? color : "transparent", flexShrink: 0, transition: "all 0.12s" }} />
                <span style={{ fontSize: 13, color: active ? color : "rgba(226,234,245,0.75)", fontWeight: active ? 700 : 400 }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Note */}
        {tipo && (
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder={tipo === "altro" ? "Descrivi il problema (obbligatorio)…" : "Note aggiuntive (opzionale)…"}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${tipo === "altro" && !note.trim() ? "#f8717166" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, color: "#e2eaf5", padding: "9px 12px", fontSize: 13, fontFamily: T.font, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        )}

        {err && (
          <div style={{ fontSize: 12, color: "#f87171", padding: "6px 10px", background: "rgba(248,113,113,0.1)", borderRadius: 7, border: "1px solid rgba(248,113,113,0.25)" }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 8 }}>
          <button onClick={onRetry} disabled={busy}
            style={{ flex: 1, padding: "11px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "rgba(226,234,245,0.6)", cursor: busy ? "not-allowed" : "pointer", fontSize: 13, fontFamily: T.font, fontWeight: 600 }}>
            ← Riprova foto
          </button>
          <button onClick={handleConfirm} disabled={busy || !tipo}
            style={{ flex: 2, padding: "11px", background: tipo ? "rgba(251,146,60,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${tipo ? "#fb923c88" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, color: tipo ? "#fb923c" : "rgba(226,234,245,0.3)", cursor: busy || !tipo ? "not-allowed" : "pointer", fontSize: 13, fontFamily: T.font, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
            {busy && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #fb923c", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
            {busy ? "Invio…" : "Crea segnalazione"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LiveCamera({ position, auth, mode = "gps", onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const streamRef = useRef(null);

  const [status,      setStatus]      = useState("starting");
  const [errMsg,      setErrMsg]      = useState("");
  const [address,     setAddress]     = useState(null);
  // Segnalazione mode state
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl,   setPreviewUrl]   = useState(null);
  const [segBusy,      setSegBusy]      = useState(false);

  useEffect(() => {
    if (position) reverseGeocode(position[0], position[1]).then(a => setAddress(a));
  }, []); // eslint-disable-line

  // Revoke preview object URL when it changes or on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

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
    const dd  = String(now.getDate()).padStart(2, "0");
    const mm  = String(now.getMonth() + 1).padStart(2, "0");
    const yy  = String(now.getFullYear()).slice(2);
    const hh  = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
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

  async function uploadSegnalazione(blob, { tipo, note }) {
    // Step 1 — create the segnalazione territorio
    const r1 = await fetch(`${API}/segnalazioni-territorio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        note:    note || null,
        address: address || null,
        lat:     position ? position[0] : null,
        lng:     position ? position[1] : null,
      }),
    });
    const d1 = await r1.json();
    if (!d1.ok) throw new Error(d1.error || "Errore creazione segnalazione");

    // Step 2 — attach the photo as an intervention
    const fd = new FormData();
    fd.append("photo", blob, "photo.jpg");
    if (note) fd.append("note", note);
    const r2 = await fetch(`${API}/segnalazioni-territorio/${d1.data.id}/intervento`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    });
    const d2 = await r2.json();
    if (!d2.ok) throw new Error(d2.error || "Errore upload foto");
  }

  // ── Capture from live viewfinder ────────────────────────────────────────────
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

    try {
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas vuoto")), "image/jpeg", 0.92)
      );

      if (mode === "segnalazione") {
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setPreviewUrl(url);
        setStatus("seg_form");
        return;
      }

      setStatus("uploading");
      await uploadBlob(blob);
      setStatus("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setErrMsg(e.message || "Errore upload");
      setStatus("error");
    }
  }

  // ── Fallback: file picker ────────────────────────────────────────────────────
  async function handleFallbackFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");

    try {
      const canvas = canvasRef.current;
      const ctx    = canvas.getContext("2d");

      let source;
      try {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
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
      if (source.close) source.close();

      drawStamp(canvas, ctx, buildStampData());

      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas vuoto")), "image/jpeg", 0.92)
      );

      if (mode === "segnalazione") {
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setPreviewUrl(url);
        setStatus("seg_form");
        return;
      }

      await uploadBlob(blob);
      setStatus("done");
      setTimeout(onClose, 1400);
    } catch (err) {
      setErrMsg(err.message || "Errore upload");
      setStatus("error");
    }
  }

  // ── Segnalazione confirm ─────────────────────────────────────────────────────
  async function confirmSegnalazione({ tipo, note }) {
    if (!capturedBlob) return;
    setSegBusy(true);
    try {
      await uploadSegnalazione(capturedBlob, { tipo, note });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCapturedBlob(null);
      setStatus("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setErrMsg(e.message || "Errore invio segnalazione");
      setStatus("error");
    } finally {
      setSegBusy(false);
    }
  }

  function retryPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
    setStatus("viewfinder");
  }

  const isBusy = status === "capturing" || status === "uploading";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 2000, display: "flex", flexDirection: "column", fontFamily: T.font }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFallbackFile} style={{ display: "none" }} />

      <video ref={videoRef} autoPlay playsInline muted
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
          opacity: (status === "viewfinder" || status === "capturing" || status === "uploading") ? (isBusy ? 0.5 : 1) : 0,
          transition: "opacity 0.2s",
          pointerEvents: "none",
        }} />

      {status === "starting" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <span style={{ color: T.textSub, fontSize: 13 }}>Apertura fotocamera…</span>
        </div>
      )}

      {status === "fallback" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.yellow} strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          <span style={{ color: T.text, fontSize: 14, textAlign: "center" }}>Fotocamera non disponibile in questo browser.<br />Scegli una foto dalla galleria.</span>
          <button onClick={() => fileRef.current.click()} style={{ padding: "12px 28px", background: T.navActive, border: `1px solid ${alpha(T.blue, 33)}`, borderRadius: 10, color: T.blue, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Scegli foto</button>
        </div>
      )}

      {status === "done" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,222,128,0.15)", border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <span style={{ color: T.green, fontSize: 16, fontWeight: 700 }}>
            {mode === "segnalazione" ? "Segnalazione creata" : "Foto salvata"}
          </span>
        </div>
      )}

      {status === "error" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 32 }}>
          <span style={{ color: T.red, fontSize: 14, textAlign: "center" }}>{errMsg}</span>
          <button onClick={() => setStatus("viewfinder")} style={{ padding: "10px 24px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 10, color: T.textSub, cursor: "pointer", fontSize: 13 }}>Riprova</button>
        </div>
      )}

      {status === "uploading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Caricamento…</span>
        </div>
      )}

      {(status === "viewfinder" || status === "capturing") && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px 32px", background: "linear-gradient(transparent, rgba(0,0,0,0.8))", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 1.6 }}>
            <span style={{ color: T.green, fontWeight: 700 }}>FleetCC v{APP_VERSION}</span>
            {address && <><br />{address}</>}
            {position && <><br />{position[0].toFixed(5)}, {position[1].toFixed(5)}</>}
          </div>
          {mode === "segnalazione" && (
            <div style={{ fontSize: 11, color: "#fb923c", fontWeight: 600, background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.3)", borderRadius: 20, padding: "3px 12px", marginBottom: 2 }}>
              📋 Modalità segnalazione territorio
            </div>
          )}
          <button onClick={captureAndUpload} disabled={isBusy}
            style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "4px solid rgba(255,255,255,0.4)", cursor: isBusy ? "not-allowed" : "pointer", boxShadow: "0 0 0 2px rgba(255,255,255,0.2), 0 4px 16px rgba(0,0,0,0.5)", transition: "transform 0.1s", flexShrink: 0 }}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.93)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          />
        </div>
      )}

      {/* Segnalazione form overlay after capture */}
      {status === "seg_form" && previewUrl && (
        <SegForm
          previewUrl={previewUrl}
          address={address}
          busy={segBusy}
          onConfirm={confirmSegnalazione}
          onRetry={retryPhoto}
        />
      )}

      {!isBusy && status !== "done" && status !== "seg_form" && (
        <button onClick={onClose}
          style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 20, lineHeight: "34px", textAlign: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
          ×
        </button>
      )}
    </div>
  );
}
