import React, { useState, useCallback } from "react";
import { API } from "@/api";
import T, { alpha } from "@/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const MATERIALI = [
  { id: "carta",    label: "Carta",    color: "#60a5fa" },
  { id: "plastica", label: "Plastica", color: "#facc15" },
  { id: "organico", label: "Organico", color: "#4ade80" },
  { id: "vetro",    label: "Vetro",    color: "#34d399" },
  { id: "rsu",      label: "RSU",      color: "#f87171" },
];

const TIPI_MEZZO = [
  { id: "",                    label: "— Nessun tipo —" },
  { id: "compattatore_post",   label: "Compattatore Posteriore" },
  { id: "compattatore_lat",    label: "Compattatore Laterale" },
  { id: "campane",             label: "Campane" },
  { id: "vasca",               label: "Vasca" },
  { id: "scarrabile",          label: "Scarrabile" },
  { id: "satellite",           label: "Satellite" },
  { id: "porter",              label: "Porter / Ape" },
];

const SUB_TABS = [
  { id: "percorsi", label: "Percorsi" },
  { id: "gruppi",   label: "Gruppi" },
  { id: "zone",     label: "Zone" },
  { id: "punti",    label: "Punti" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise legacy string materiale → array of ids */
function parseMateriali(val) {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== "string") return [];
  // legacy: comma-separated labels or ids
  return val
    .split(/[,;|]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function inp(extra = {}) {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 7,
    border: `1px solid ${T.border}`,
    background: T.bg,
    color: T.text,
    fontSize: 13,
    fontFamily: T.font,
    outline: "none",
    boxSizing: "border-box",
    ...extra,
  };
}

// ─── MaterialiPicker ──────────────────────────────────────────────────────────

function MaterialiPicker({ value, onChange }) {
  const selected = parseMateriali(value);
  function toggle(id) {
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id];
    onChange(next);
  }
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {MATERIALI.map(m => {
        const on = selected.includes(m.id);
        return (
          <button
            key={m.id}
            onClick={() => toggle(m.id)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 20,
              border: `1.5px solid ${on ? m.color : T.border}`,
              background: on ? alpha(m.color, 15) : "transparent",
              color: on ? m.color : T.textSub,
              cursor: "pointer", fontSize: 12, fontFamily: T.font,
              fontWeight: on ? 700 : 400, transition: "all 0.15s",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? m.color : T.textDim, flexShrink: 0 }} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── TipoMezzoSelect ──────────────────────────────────────────────────────────

function TipoMezzoSelect({ value, onChange }) {
  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inp(),
        appearance: "none",
        cursor: "pointer",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a9bbf' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: 30,
      }}
    >
      {TIPI_MEZZO.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  );
}

// ─── EditForm ─────────────────────────────────────────────────────────────────

function EditForm({ form, setForm, onSave, onCancel, saving, nameKey = "name", showMateriali = true, showTipo = true }) {
  const name = form[nameKey] || "";
  const canSave = name.trim().length > 0 && !saving;

  function field(label, key, placeholder = "") {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <input
          value={form[key] || ""}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          style={inp()}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.border}`, background: alpha(T.bg, 60) }}>
      {field("Nome *", nameKey, "Nome…")}
      {field("Comune", "comune", "Comune…")}

      {showMateriali && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 6 }}>Materiali</div>
          <MaterialiPicker value={form.materiali ?? form.materiale} onChange={v => setForm(f => ({ ...f, materiali: v }))} />
        </div>
      )}

      {showTipo && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 4 }}>Tipo mezzo</div>
          <TipoMezzoSelect value={form.tipo_mezzo} onChange={v => setForm(f => ({ ...f, tipo_mezzo: v }))} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{
            flex: 1, padding: "9px", borderRadius: 7, cursor: canSave ? "pointer" : "not-allowed",
            background: canSave ? T.navActive : T.bg,
            border: `1px solid ${canSave ? alpha(T.blue, 40) : T.border}`,
            color: canSave ? T.blue : T.textDim,
            fontSize: 13, fontFamily: T.font, fontWeight: 700,
          }}
        >
          {saving ? "Salvataggio…" : "Salva"}
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "9px", borderRadius: 7, cursor: "pointer",
            background: "transparent", border: `1px solid ${T.border}`,
            color: T.textSub, fontSize: 13, fontFamily: T.font,
          }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

// ─── Generic entity row (expand → edit inline) ────────────────────────────────

function EntityRow({ item, nameKey, onSave, onDelete, auth, showMateriali = true, showTipo = true, accentColor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    setForm({ ...item, materiali: parseMateriali(item.materiali ?? item.materiale) });
    setOpen(true);
  }
  function cancelEdit() { setForm(null); setOpen(false); }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      await onSave(item, form);
      setOpen(false);
      setForm(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminare "${item[nameKey]}"?`)) return;
    setDeleting(true);
    try {
      await onDelete(item);
    } finally {
      setDeleting(false);
    }
  }

  const label = item[nameKey] || "—";
  const matIds = parseMateriali(item.materiali ?? item.materiale);
  const matLabels = matIds.map(id => MATERIALI.find(m => m.id === id)?.label || id).join(", ");
  const tipoLabel = TIPI_MEZZO.find(t => t.id === item.tipo_mezzo)?.label;

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10,
      overflow: "hidden", transition: "box-shadow 0.15s",
      boxShadow: open ? "0 2px 12px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.12)",
    }}>
      {/* Row header */}
      <div
        onClick={() => open ? cancelEdit() : startEdit()}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "11px 14px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor || item.color || item.fillColor || T.green, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[item.comune, matLabels || null, tipoLabel || null].filter(Boolean).join(" · ") || "Nessun dettaglio"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={e => { e.stopPropagation(); handleDelete(); }}
            disabled={deleting}
            title="Elimina"
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`,
              background: "transparent", color: T.red, cursor: deleting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
          <span style={{ color: open ? T.blue : T.textDim, fontSize: 12, transition: "transform 0.15s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
        </div>
      </div>

      {/* Inline edit form */}
      {open && form && (
        <EditForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={cancelEdit}
          saving={saving}
          nameKey={nameKey}
          showMateriali={showMateriali}
          showTipo={showTipo}
        />
      )}
    </div>
  );
}

// ─── GruppiRow (special: just name + color) ───────────────────────────────────

function GruppoRow({ gruppo, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() { setForm({ ...gruppo }); setOpen(true); }
  function cancelEdit() { setForm(null); setOpen(false); }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try { await onSave(gruppo, form); setOpen(false); setForm(null); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminare il gruppo "${gruppo.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(gruppo); } finally { setDeleting(false); }
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden", boxShadow: open ? "0 2px 12px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.12)" }}>
      <div onClick={() => open ? cancelEdit() : startEdit()} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: gruppo.color || T.blue, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{gruppo.name || "—"}</div>
          <div style={{ fontSize: 11, color: T.textDim }}>
            {[
              gruppo.routeIds?.length ? `${gruppo.routeIds.length} percors${gruppo.routeIds.length === 1 ? "o" : "i"}` : null,
              gruppo.zoneIds?.length ? `${gruppo.zoneIds.length} zon${gruppo.zoneIds.length === 1 ? "a" : "e"}` : null,
              gruppo.puntiIds?.length ? `${gruppo.puntiIds.length} punt${gruppo.puntiIds.length === 1 ? "o" : "i"}` : null,
            ].filter(Boolean).join(" · ") || "Gruppo vuoto"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting} title="Elimina"
            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", color: T.red, cursor: deleting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
          <span style={{ color: open ? T.blue : T.textDim, fontSize: 12, transform: open ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
        </div>
      </div>

      {open && form && (
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.border}`, background: alpha(T.bg, 60) }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 4 }}>Nome *</div>
            <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome gruppo…" style={inp()} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 6 }}>Colore</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {["#4ade80","#60a5fa","#fb923c","#c084fc","#f9a8d4","#facc15","#f87171","#34d399"].map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: form.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer", boxShadow: form.color === c ? "0 0 0 1px #000" : "none" }} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={!form.name?.trim() || saving}
              style={{ flex: 1, padding: "9px", borderRadius: 7, background: form.name?.trim() ? T.navActive : T.bg, border: `1px solid ${form.name?.trim() ? alpha(T.blue, 40) : T.border}`, color: form.name?.trim() ? T.blue : T.textDim, cursor: "pointer", fontSize: 13, fontFamily: T.font, fontWeight: 700 }}>
              {saving ? "Salvataggio…" : "Salva"}
            </button>
            <button onClick={cancelEdit} style={{ flex: 1, padding: "9px", borderRadius: 7, background: "transparent", border: `1px solid ${T.border}`, color: T.textSub, cursor: "pointer", fontSize: 13, fontFamily: T.font }}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper (sub-tab list) ───────────────────────────────────────────

function SectionHeader({ label, count }) {
  return (
    <div style={{ fontSize: 10, color: T.textSub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
      {label} <span style={{ color: T.textDim, fontWeight: 400 }}>({count})</span>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: T.textDim, fontSize: 13 }}>
      Nessun {label} ancora
    </div>
  );
}

// ─── EditoreModule ────────────────────────────────────────────────────────────

export default function EditoreModule({ routes, loadRoutes, zones, setZones, punti, setPunti, gruppi, setGruppi, auth }) {
  const [subTab, setSubTab] = useState("percorsi");
  const [busyId, setBusyId] = useState(null); // track which item is saving

  // ── Save handlers ─────────────────────────────────────────────────────────

  const saveRoute = useCallback(async (item, form) => {
    const body = {
      name: form.name,
      comune: form.comune || "",
      materiali: form.materiali ?? [],
      materiale: (form.materiali ?? []).join(", "),
      tipo_mezzo: form.tipo_mezzo || "",
      color: item.color,
      opacity: item.opacity,
    };
    const res = await fetch(`${API}/gps/routes/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth?.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Salvataggio fallito");
    await loadRoutes();
  }, [auth, loadRoutes]);

  const deleteRoute = useCallback(async (item) => {
    await fetch(`${API}/gps/routes/${item.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth?.token}` },
    });
    await loadRoutes();
  }, [auth, loadRoutes]);

  const saveZone = useCallback(async (item, form) => {
    const updated = {
      ...item,
      name: form.name,
      comune: form.comune || "",
      materiali: form.materiali ?? [],
      materiale: (form.materiali ?? []).join(", "),
      tipo_mezzo: form.tipo_mezzo || "",
    };
    setZones(zs => zs.map(z => z.id === item.id ? updated : z));
  }, [setZones]);

  const deleteZone = useCallback(async (item) => {
    setZones(zs => zs.filter(z => z.id !== item.id));
  }, [setZones]);

  const savePunto = useCallback(async (item, form) => {
    const updated = {
      ...item,
      nome: form.nome,
      comune: form.comune || "",
      materiali: form.materiali ?? [],
      materiale: (form.materiali ?? []).join(", "),
      tipo_mezzo: form.tipo_mezzo || "",
    };
    setPunti(ps => ps.map(p => p.id === item.id ? updated : p));
  }, [setPunti]);

  const deletePunto = useCallback(async (item) => {
    setPunti(ps => ps.filter(p => p.id !== item.id));
  }, [setPunti]);

  const saveGruppo = useCallback(async (item, form) => {
    const updated = { ...item, name: form.name, color: form.color || item.color };
    setGruppi(gs => gs.map(g => g.id === item.id ? updated : g));
  }, [setGruppi]);

  const deleteGruppo = useCallback(async (item) => {
    setGruppi(gs => gs.filter(g => g.id !== item.id));
  }, [setGruppi]);

  // ── Render ────────────────────────────────────────────────────────────────

  const routeList = routes || [];
  const zoneList = zones || [];
  const puntiList = punti || [];
  const gruppiList = gruppi || [];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.card }}>
        {SUB_TABS.map(t => {
          const count = t.id === "percorsi" ? routeList.length : t.id === "gruppi" ? gruppiList.length : t.id === "zone" ? zoneList.length : puntiList.length;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                flex: 1, padding: "12px 8px", border: "none", borderBottom: active ? `2px solid ${T.blue}` : "2px solid transparent",
                background: "transparent", color: active ? T.blue : T.textSub,
                cursor: "pointer", fontSize: 13, fontFamily: T.font, fontWeight: active ? 700 : 400,
                transition: "all 0.15s",
              }}
            >
              {t.label}
              <span style={{ marginLeft: 5, fontSize: 11, color: active ? T.blue : T.textDim, fontWeight: 400 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* ── Percorsi ── */}
        {subTab === "percorsi" && (
          <>
            <SectionHeader label="Percorsi" count={routeList.length} />
            {routeList.length === 0
              ? <EmptyState label="percorso" />
              : routeList.map(r => (
                  <div key={r.id} style={{ marginBottom: 8 }}>
                    <EntityRow
                      item={r}
                      nameKey="name"
                      onSave={saveRoute}
                      onDelete={deleteRoute}
                      auth={auth}
                      showMateriali
                      showTipo
                      accentColor={r.color}
                    />
                  </div>
                ))
            }
          </>
        )}

        {/* ── Gruppi ── */}
        {subTab === "gruppi" && (
          <>
            <SectionHeader label="Gruppi" count={gruppiList.length} />
            {gruppiList.length === 0
              ? <EmptyState label="gruppo" />
              : gruppiList.map(g => (
                  <div key={g.id} style={{ marginBottom: 8 }}>
                    <GruppoRow
                      gruppo={g}
                      onSave={saveGruppo}
                      onDelete={deleteGruppo}
                    />
                  </div>
                ))
            }
          </>
        )}

        {/* ── Zone ── */}
        {subTab === "zone" && (
          <>
            <SectionHeader label="Zone" count={zoneList.length} />
            {zoneList.length === 0
              ? <EmptyState label="zona" />
              : zoneList.map(z => (
                  <div key={z.id} style={{ marginBottom: 8 }}>
                    <EntityRow
                      item={z}
                      nameKey="name"
                      onSave={saveZone}
                      onDelete={deleteZone}
                      auth={auth}
                      showMateriali
                      showTipo
                      accentColor={z.fillColor || z.borderColor}
                    />
                  </div>
                ))
            }
          </>
        )}

        {/* ── Punti ── */}
        {subTab === "punti" && (
          <>
            <SectionHeader label="Punti" count={puntiList.length} />
            {puntiList.length === 0
              ? <EmptyState label="punto" />
              : puntiList.map(p => (
                  <div key={p.id} style={{ marginBottom: 8 }}>
                    <EntityRow
                      item={p}
                      nameKey="nome"
                      onSave={savePunto}
                      onDelete={deletePunto}
                      auth={auth}
                      showMateriali
                      showTipo
                      accentColor={p.color}
                    />
                  </div>
                ))
            }
          </>
        )}
      </div>
    </div>
  );
}
