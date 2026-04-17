import React, { useState } from "react";
import { API } from "@/api";
import T from "@/theme";

export default function BugReportModal({ auth, onClose }) {
  const [form, setForm] = useState({ title: "", category: "errore", description: "", steps: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const inp = { width: "100%", background: "#1a2332", border: `1px solid #263d5a`, borderRadius: 8, color: "#e2eaf5", padding: "9px 12px", fontSize: 13, fontFamily: T.font, outline: "none", boxSizing: "border-box" };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { setError("Titolo e descrizione obbligatori."); return; }
    setSending(true); setError(null);
    try {
      const r = await fetch(`${API}/bugs`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.ok) { setSent(true); setTimeout(onClose, 2200); }
      else setError(d.error || "Errore nell'invio");
    } catch { setError("Errore di rete"); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#0a1628", border: "1px solid #2e4a6a", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", fontFamily: T.font }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #263d5a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🐛</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2eaf5" }}>Segnala un bug</div>
              <div style={{ fontSize: 11, color: "#7a9bbf", marginTop: 1 }}>Il report sarà inviato al team FleetCC</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#3d5a7a", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {sent ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#4ade80" }}>Bug inviato, grazie!</div>
            <div style={{ fontSize: 12, color: "#7a9bbf", marginTop: 6 }}>Il team è stato notificato. Chiusura automatica…</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <div style={{ background: "#1a0808", border: "1px solid #4a1a1a", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>{error}</div>}
            <div>
              <label style={{ fontSize: 11, color: "#7a9bbf", display: "block", marginBottom: 5, fontWeight: 600 }}>Titolo *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Descrivi brevemente il problema" style={inp} required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#7a9bbf", display: "block", marginBottom: 5, fontWeight: 600 }}>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                <option value="errore">Errore / Crash</option>
                <option value="ui">Interfaccia (UI)</option>
                <option value="funzionalita">Funzionalità</option>
                <option value="performance">Performance</option>
                <option value="altro">Altro</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#7a9bbf", display: "block", marginBottom: 5, fontWeight: 600 }}>Descrizione *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4}
                placeholder="Cosa è successo? Qual era il comportamento atteso?" style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#7a9bbf", display: "block", marginBottom: 5, fontWeight: 600 }}>Passi per riprodurre <span style={{ fontWeight: 400, color: "#3d5a7a" }}>(opzionale)</span></label>
              <textarea value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} rows={3}
                placeholder={"1. Vai su...\n2. Clicca su...\n3. Vedi l'errore"} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
            </div>
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button type="submit" disabled={sending}
                style={{ flex: 1, padding: "11px", background: sending ? "#1a2332" : "#0f2540", border: "1px solid #60a5fa55", borderRadius: 8, color: sending ? "#3d5a7a" : "#60a5fa", cursor: sending ? "not-allowed" : "pointer", fontSize: 14, fontFamily: T.font, fontWeight: 600 }}>
                {sending ? "Invio in corso…" : "Invia bug report"}
              </button>
              <button type="button" onClick={onClose}
                style={{ padding: "11px 18px", background: "transparent", border: "1px solid #263d5a", borderRadius: 8, color: "#7a9bbf", cursor: "pointer", fontSize: 14, fontFamily: T.font }}>
                Annulla
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
