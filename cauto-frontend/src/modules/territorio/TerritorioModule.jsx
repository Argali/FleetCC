import React, { useState, useEffect, useRef, useMemo } from "react";
import { API } from "@/api";
import T, { alpha } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatSegDate, extractComune } from "@/utils/geoUtils";
import TabBar from "@/shared/ui/TabBar";

const TIPO_META = {
  mancata_raccolta: { label: "Mancata raccolta", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  abbandono:        { label: "Abbandono",         color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  da_pulire:        { label: "Da pulire",          color: "#facc15", bg: "rgba(250,204,21,0.12)"  },
  altro:            { label: "Altro",              color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
};

const TERR_STATUS = {
  aperta:         { label: "Aperta",         color: "#f87171" },
  in_lavorazione: { label: "In lavorazione", color: "#facc15" },
  chiusa:         { label: "Chiusa",         color: "#4ade80" },
};

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ item, onClose, onPrev, onNext, hasPrev, hasNext }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const tm  = TIPO_META[item.seg.tipo]  || TIPO_META.altro;
  const sm  = TERR_STATUS[item.seg.status] || TERR_STATUS.aperta;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 4000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: 16 }}>

      {/* Close */}
      <button onClick={onClose}
        style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
        ×
      </button>

      {/* Prev / Next */}
      {hasPrev && (
        <button onClick={onPrev}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ‹
        </button>
      )}
      {hasNext && (
        <button onClick={onNext}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ›
        </button>
      )}

      {/* Image */}
      <img
        src={item.photo_url}
        alt="Foto intervento"
        style={{ maxWidth: "min(860px, calc(100vw - 100px))", maxHeight: "65vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 8px 48px rgba(0,0,0,0.6)" }}
      />

      {/* Info card below image */}
      <div style={{ marginTop: 16, background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 20px", width: "min(520px, calc(100vw - 32px))", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ padding: "2px 9px", borderRadius: 10, background: tm.bg, color: tm.color, fontSize: 11, fontWeight: 700 }}>{tm.label}</span>
          <span style={{ padding: "2px 9px", borderRadius: 10, background: `${sm.color}18`, color: sm.color, fontSize: 11, fontWeight: 700 }}>{sm.label}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2eaf5", marginBottom: 4 }}>
          {item.seg.address || `${item.seg.lat?.toFixed(5)}, ${item.seg.lng?.toFixed(5)}`}
        </div>
        {item.note && <div style={{ fontSize: 12, color: "rgba(226,234,245,0.7)", marginBottom: 6, lineHeight: 1.5 }}>{item.note}</div>}
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "rgba(226,234,245,0.45)" }}>
          <span>📷 {item.done_by_name}</span>
          <span>🕐 {formatSegDate(item.done_at)}</span>
        </div>
        <a href={item.photo_url} target="_blank" rel="noreferrer"
          style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: T.blue, textDecoration: "none", fontWeight: 600 }}>
          Apri originale ↗
        </a>
      </div>
    </div>
  );
}

// ── Gallery tab ───────────────────────────────────────────────────────────────
function GalleriaTab({ segnalazioni }) {
  const isMobile   = useIsMobile();
  const [filterTipo,   setFilterTipo]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lightboxIdx,  setLightboxIdx]  = useState(null);

  // Flatten all photos from all interventions
  const photos = useMemo(() => {
    const out = [];
    segnalazioni.forEach(seg => {
      (seg.interventions || []).forEach(int => {
        if (int.photo_url) {
          out.push({
            id:          int.id,
            photo_url:   int.photo_url,
            note:        int.note,
            done_by_name:int.done_by_name,
            done_at:     int.done_at,
            seg,
          });
        }
      });
    });
    // Newest first
    return out.sort((a, b) => new Date(b.done_at) - new Date(a.done_at));
  }, [segnalazioni]);

  const filtered = photos.filter(p => {
    if (filterTipo   !== "all" && p.seg.tipo   !== filterTipo)   return false;
    if (filterStatus !== "all" && p.seg.status !== filterStatus) return false;
    return true;
  });

  const lbItem = lightboxIdx != null ? filtered[lightboxIdx] : null;

  if (photos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", color: T.textDim }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3, marginBottom: 14 }}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Nessuna foto ancora</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Le foto allegate agli interventi appariranno qui</div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, color: T.textSub }}>
          <span style={{ fontWeight: 700, color: T.text }}>{filtered.length}</span> foto
          {filtered.length !== photos.length && ` di ${photos.length} totali`}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[["all", "Tutti"], ["mancata_raccolta", "M. Raccolta"], ["abbandono", "Abbandono"], ["da_pulire", "Da pulire"], ["altro", "Altro"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilterTipo(k)}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterTipo === k ? (TIPO_META[k]?.color || T.blue) : T.border}`, background: filterTipo === k ? (TIPO_META[k]?.bg || T.navActive) : "transparent", color: filterTipo === k ? (TIPO_META[k]?.color || T.blue) : T.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
            {l}
          </button>
        ))}
        <div style={{ width: 1, background: T.border, margin: "0 4px" }} />
        {[["all", "Tutti gli stati"], ...Object.entries(TERR_STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} onClick={() => setFilterStatus(k)}
            style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === k ? (TERR_STATUS[k]?.color || T.blue) : T.border}`, background: filterStatus === k ? `${TERR_STATUS[k]?.color || T.blue}20` : "transparent", color: filterStatus === k ? (TERR_STATUS[k]?.color || T.blue) : T.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: T.textDim, fontSize: 13 }}>Nessuna foto corrisponde ai filtri</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
          {filtered.map((item, idx) => {
            const tm = TIPO_META[item.seg.tipo] || TIPO_META.altro;
            return (
              <div key={item.id} onClick={() => setLightboxIdx(idx)}
                style={{ position: "relative", borderRadius: 10, overflow: "hidden", cursor: "pointer", aspectRatio: "4/3", background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)"; }}>

                <img src={item.photo_url} alt="Foto"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

                {/* Gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />

                {/* Tipo badge top-left */}
                <div style={{ position: "absolute", top: 8, left: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 8, background: tm.bg, color: tm.color, fontSize: 10, fontWeight: 700, backdropFilter: "blur(4px)", border: `1px solid ${tm.color}44` }}>
                    {tm.label}
                  </span>
                </div>

                {/* Info bottom */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#e2eaf5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
                    {item.seg.address ? extractComune(item.seg.address) || item.seg.address : `${item.seg.lat?.toFixed(4)}, ${item.seg.lng?.toFixed(4)}`}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(226,234,245,0.55)" }}>
                    <span>{item.done_by_name}</span>
                    <span>{formatSegDate(item.done_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lbItem && (
        <Lightbox
          item={lbItem}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => i - 1)}
          onNext={() => setLightboxIdx(i => i + 1)}
          hasPrev={lightboxIdx > 0}
          hasNext={lightboxIdx < filtered.length - 1}
        />
      )}
    </div>
  );
}

// ── TerritorioDetail (unchanged) ──────────────────────────────────────────────
function TerritorioDetail({ segnalazione: s, auth, onClose, onRefresh }) {
  const [status,        setStatus]        = useState(s.status);
  const [statusLoading, setStatusLoading] = useState(false);
  const [note,          setNote]          = useState("");
  const [photo,         setPhoto]         = useState(null);
  const [sending,       setSending]       = useState(false);
  const [err,           setErr]           = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { setStatus(s.status); }, [s.status]);

  const tm = TIPO_META[s.tipo] || TIPO_META.altro;

  const changeStatus = async (newStatus) => {
    setStatusLoading(true);
    try {
      await fetch(`${API}/segnalazioni-territorio/${s.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
      onRefresh();
    } finally {
      setStatusLoading(false);
    }
  };

  const addIntervento = async (e) => {
    e.preventDefault();
    if (!note.trim() && !photo) { setErr("Aggiungi una nota o una foto"); return; }
    setSending(true); setErr(null);
    try {
      const fd = new FormData();
      if (note.trim()) fd.append("note", note.trim());
      if (photo) fd.append("photo", photo);
      const r = await fetch(`${API}/segnalazioni-territorio/${s.id}/intervento`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
        body: fd,
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Errore");
      setNote(""); setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
      onRefresh();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSending(false);
    }
  };

  const interventions = s.interventions || [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 3000, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: T.font }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 600, background: T.card, borderRadius: "16px 16px 0 0", border: `1px solid ${T.cardBorder}`, maxHeight: "90dvh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: tm.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{tm.label}</div>
            <div style={{ fontSize: 11, color: T.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.created_by_name} · {formatSegDate(s.created_at)}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textSub, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "4px 8px", flexShrink: 0 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px" }}>
            <div style={{ fontSize: 10, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 700 }}>Posizione</div>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: s.lat ? 4 : 0 }}>{s.address || "—"}</div>
            {s.lat && <div style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono }}>{s.lat.toFixed(6)}, {s.lng.toFixed(6)}</div>}
          </div>

          {s.note && (
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px" }}>
              <div style={{ fontSize: 10, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 700 }}>Nota</div>
              <div style={{ fontSize: 13, color: T.text }}>{s.note}</div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 10, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontWeight: 700 }}>Stato</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(TERR_STATUS).map(([k, v]) => (
                <button key={k} onClick={() => changeStatus(k)} disabled={statusLoading || status === k}
                  style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: `1px solid ${status === k ? v.color : T.border}`, background: status === k ? `${v.color}20` : "transparent", color: status === k ? v.color : T.textSub, fontSize: 11, fontWeight: 600, cursor: status === k || statusLoading ? "default" : "pointer", fontFamily: T.font, transition: "all 0.15s" }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {interventions.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, fontWeight: 700 }}>
                Interventi ({interventions.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {interventions.map(int => (
                  <div key={int.id} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (int.note || int.photo_url) ? 8 : 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{int.done_by_name}</span>
                      <span style={{ fontSize: 10, color: T.textDim }}>{formatSegDate(int.done_at)}</span>
                    </div>
                    {int.note && <div style={{ fontSize: 12, color: T.textSub, marginBottom: int.photo_url ? 8 : 0, lineHeight: 1.5 }}>{int.note}</div>}
                    {int.photo_url && (
                      <img src={int.photo_url} alt="Foto intervento"
                        style={{ width: "100%", borderRadius: 8, display: "block", cursor: "pointer", marginTop: 2 }}
                        onClick={() => window.open(int.photo_url, "_blank")} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12, fontWeight: 700 }}>Aggiungi intervento</div>
            <form onSubmit={addIntervento} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Descrivi l'intervento effettuato…"
                style={{ width: "100%", background: "#1a2332", border: `1px solid #263d5a`, borderRadius: 8, color: T.text, padding: "9px 12px", fontSize: 13, fontFamily: T.font, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => fileRef.current.click()}
                  style={{ padding: "8px 14px", background: "transparent", border: `1px solid ${photo ? T.green : T.border}`, borderRadius: 8, color: photo ? T.green : T.textSub, fontSize: 12, fontFamily: T.font, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  {photo ? photo.name.slice(0, 18) + "…" : "Allega foto"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} style={{ display: "none" }} />
                {photo && (
                  <button type="button" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 11, cursor: "pointer" }}>×</button>
                )}
                <button type="submit" disabled={sending}
                  style={{ marginLeft: "auto", padding: "8px 20px", background: T.navActive, border: `1px solid ${alpha(T.blue,33)}`, borderRadius: 8, color: T.blue, fontSize: 13, fontFamily: T.font, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {sending && <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${T.blue}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                  Salva
                </button>
              </div>
              {err && <div style={{ fontSize: 12, color: T.red }}>{err}</div>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SegnalazioniTab (existing list view) ──────────────────────────────────────
function SegnalazioniTab({ segnalazioni, auth, refetch }) {
  const isMobile   = useIsMobile();
  const [filterTipo,   setFilterTipo]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterComune, setFilterComune] = useState("all");
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState(null);

  const comuni = useMemo(() => {
    const set = new Set();
    segnalazioni.forEach(s => { const c = extractComune(s.address); if (c) set.add(c); });
    return [...set].sort((a, b) => a.localeCompare(b, "it"));
  }, [segnalazioni]);

  const filtered = segnalazioni.filter(s => {
    if (filterTipo   !== "all" && s.tipo   !== filterTipo)   return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterComune !== "all" && extractComune(s.address) !== filterComune) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.address || "").toLowerCase().includes(q) && !(s.note || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selectedFull = selected ? (segnalazioni.find(s => s.id === selected.id) || selected) : null;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca indirizzo o nota…"
          style={{ width: "100%", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.text, padding: "9px 14px", fontSize: 13, fontFamily: T.font, outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["all", "Tutti"], ["mancata_raccolta", "M. Raccolta"], ["abbandono", "Abbandono"], ["da_pulire", "Da pulire"], ["altro", "Altro"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilterTipo(k)}
              style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterTipo === k ? (TIPO_META[k]?.color || T.blue) : T.border}`, background: filterTipo === k ? (TIPO_META[k]?.bg || T.navActive) : "transparent", color: filterTipo === k ? (TIPO_META[k]?.color || T.blue) : T.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
              {l}
            </button>
          ))}
        </div>
        {comuni.length > 0 && (
          <select value={filterComune} onChange={e => setFilterComune(e.target.value)}
            style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, color: T.text, padding: "8px 12px", fontSize: 13, fontFamily: T.font, outline: "none", cursor: "pointer" }}>
            <option value="all">Tutti i comuni</option>
            {comuni.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["all", "Tutti gli stati"], ...Object.entries(TERR_STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${filterStatus === k ? (TERR_STATUS[k]?.color || T.blue) : T.border}`, background: filterStatus === k ? `${TERR_STATUS[k]?.color || T.blue}20` : "transparent", color: filterStatus === k ? (TERR_STATUS[k]?.color || T.blue) : T.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: T.textDim, fontSize: 14 }}>Nessuna segnalazione trovata</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {filtered.map(s => {
            const tm = TIPO_META[s.tipo] || TIPO_META.altro;
            const sm = TERR_STATUS[s.status] || TERR_STATUS.aperta;
            return (
              <div key={s.id} onClick={() => setSelected(s)}
                style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", display: "flex", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", transition: "box-shadow 0.15s,transform 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.24)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = ""; }}>
                <div style={{ width: 5, background: tm.color, flexShrink: 0 }} />
                <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: tm.bg, color: tm.color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{tm.label}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: `${sm.color}18`, color: sm.color, fontSize: 10, fontWeight: 700 }}>{sm.label}</span>
                    {(s.interventions || []).length > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: T.teal, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        {s.interventions.length}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.address || `${s.lat?.toFixed(5)}, ${s.lng?.toFixed(5)}`}
                  </div>
                  {s.note && <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.note}</div>}
                  <div style={{ fontSize: 10, color: T.textDim, display: "flex", gap: 8 }}>
                    <span>{s.created_by_name}</span>
                    <span>{formatSegDate(s.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedFull && (
        <TerritorioDetail
          segnalazione={selectedFull}
          auth={auth}
          onClose={() => setSelected(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

// ── Main module ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "segnalazioni", label: "Segnalazioni", icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" },
  { id: "galleria",     label: "Galleria",     icon: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
];

export default function TerritorioModule() {
  const { auth }  = useAuth();
  const { data, refetch } = useApi("/segnalazioni-territorio");
  const segnalazioni = data || [];
  const [activeTab, setActiveTab] = useState("segnalazioni");

  const statCounts = Object.fromEntries(
    Object.keys(TERR_STATUS).map(k => [k, segnalazioni.filter(s => s.status === k).length])
  );

  const photoCount = segnalazioni.reduce((n, s) => n + (s.interventions || []).filter(i => i.photo_url).length, 0);

  const tabs = TABS.map(t =>
    t.id === "galleria" ? { ...t, badge: photoCount } : t
  );

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>Segnalazioni Territorio</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(TERR_STATUS).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, color: v.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color, display: "inline-block" }} />
                {statCounts[k]} {v.label.toLowerCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "segnalazioni" && (
        <SegnalazioniTab segnalazioni={segnalazioni} auth={auth} refetch={refetch} />
      )}
      {activeTab === "galleria" && (
        <GalleriaTab segnalazioni={segnalazioni} />
      )}
    </div>
  );
}
