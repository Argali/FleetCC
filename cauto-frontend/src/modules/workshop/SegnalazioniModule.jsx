import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { useApi } from "@/hooks/useApi";
import { API, BASE_URL } from "@/api";
import T from "@/theme";
import Spinner from "@/shared/ui/Spinner";
import Icon from "@/shared/ui/Icon";

const SEG_STATUS={aperta:{label:"Aperta",color:T.orange},in_lavorazione:{label:"In lavorazione",color:T.blue},chiusa:{label:"Chiusa",color:T.green}};
const SEG_TIPO={guasto:{label:"Guasto",color:T.yellow},incidente:{label:"Incidente",color:T.red},manutenzione:{label:"Manutenzione",color:T.blue}};

function SegnalazioniModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const {data:vehicles}=useApi("/gps/vehicles",{skip:!can("gps")});
  const [list,setList]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [msg,setMsg]=useState(null);
  const isManager=auth.user.role==="fleet_manager";
  const emptyForm={reporter_name:auth.user.name,settore:"",vehicle:"",plate:"",description:"",tipo:"guasto",available_from:"",photo:null};
  const [form,setForm]=useState(emptyForm);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const [photoPreview,setPhotoPreview]=useState(null);

  const handlePhoto=e=>{const file=e.target.files[0];if(!file)return;setForm(f=>({...f,photo:file}));setPhotoPreview(URL.createObjectURL(file));};
  const removePhoto=()=>{setForm(f=>({...f,photo:null}));setPhotoPreview(null);};
  const loadList=useCallback(async()=>{
    setLoading(true);
    try{const r=await fetch(`${API}/segnalazioni`,{headers:{Authorization:`Bearer ${auth.token}`}});const d=await r.json();if(d.ok)setList(d.data);}catch{}
    setLoading(false);
  },[auth.token]);
  useEffect(()=>{loadList();},[loadList]);

  const handleVehicleChange=e=>{const v=vehicles?.find(v=>v.name===e.target.value);setForm(f=>({...f,vehicle:e.target.value,plate:v?.plate||""}));};
  const submit=async()=>{
    if(!form.settore||!form.vehicle||!form.description){setMsg({ok:false,text:"Settore, veicolo e descrizione sono obbligatori"});return;}
    setSubmitting(true);setMsg(null);
    try{
      const fd=new FormData();
      ["reporter_name","settore","vehicle","plate","description","tipo","available_from"].forEach(k=>fd.append(k,form[k]||""));
      if(form.photo)fd.append("photo",form.photo);
      const r=await fetch(`${API}/segnalazioni`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`},body:fd});
      const d=await r.json();
      if(d.ok){setMsg({ok:true,text:"Segnalazione inviata"});setShowForm(false);setForm(emptyForm);setPhotoPreview(null);loadList();}
      else setMsg({ok:false,text:d.error});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setSubmitting(false);setTimeout(()=>setMsg(null),4000);
  };
  const updateStatus=async(id,status)=>{await fetch(`${API}/segnalazioni/${id}/status`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status})});loadList();};
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};
  const lbl={fontSize:11,color:T.textSub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600};
  const openSeg=list.filter(s=>s.status!=="chiusa");
  const closedSeg=list.filter(s=>s.status==="chiusa");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:T.font}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{fontSize:13,color:T.textSub}}>Riporta un problema, guasto o incidente su un veicolo</div>
        <button onClick={()=>{setShowForm(v=>!v);setMsg(null);}} style={{padding:"9px 18px",background:T.navActive,border:`1px solid ${T.green}44`,borderRadius:8,color:T.green,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
          {showForm?"✕ Annulla":"+ Nuova segnalazione"}
        </button>
      </div>

      {msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.ok?T.card:"#1a0808",border:`1px solid ${msg.ok?T.border:"#4a1a1a"}`,color:msg.ok?T.green:T.red,fontSize:13}}>{msg.text}</div>}

      {showForm&&(
        <div style={{background:T.card,border:`1px solid ${T.green}33`,borderRadius:12,padding:22,display:"flex",flexDirection:"column",gap:16,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text}}>Nuova segnalazione</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div><label style={lbl}>Nome segnalante</label><input value={form.reporter_name} onChange={e=>set("reporter_name")(e.target.value)} style={inp}/></div>
            <div><label style={lbl}>Settore</label><input value={form.settore} onChange={e=>set("settore")(e.target.value)} style={inp} placeholder="Es. Zona Nord…"/></div>
          </div>
          <div>
            <label style={lbl}>Veicolo</label>
            {vehicles?.length>0
              ?<select value={form.vehicle} onChange={handleVehicleChange} style={inp}><option value="">— Seleziona veicolo —</option>{vehicles.map(v=><option key={v.id} value={v.name}>{v.name} · {v.plate}</option>)}</select>
              :<input value={form.vehicle} onChange={e=>set("vehicle")(e.target.value)} style={inp} placeholder="Nome del camion"/>
            }
          </div>
          <div><label style={lbl}>Cosa è successo</label><textarea value={form.description} onChange={e=>set("description")(e.target.value)} rows={4} style={{...inp,resize:"vertical",lineHeight:1.6}} placeholder="Descrivi il problema…"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <label style={lbl}>Tipo</label>
              <div style={{display:"flex",gap:8}}>
                {Object.entries(SEG_TIPO).map(([key,{label,color}])=>(
                  <button key={key} type="button" onClick={()=>set("tipo")(key)}
                    style={{flex:1,padding:"9px 6px",borderRadius:8,cursor:"pointer",fontFamily:T.font,fontSize:12,fontWeight:form.tipo===key?700:400,background:form.tipo===key?color+"22":T.bg,border:`1px solid ${form.tipo===key?color:T.border}`,color:form.tipo===key?color:T.textSub,transition:"all 0.15s"}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Disponibile dal</label><input type="date" value={form.available_from} onChange={e=>set("available_from")(e.target.value)} style={{...inp,colorScheme:"dark"}}/></div>
          </div>
          <div>
            <label style={lbl}>Foto (opzionale)</label>
            {!photoPreview
              ?<label style={{display:"flex",alignItems:"center",gap:10,padding:"13px 18px",background:T.bg,border:`2px dashed ${T.border}`,borderRadius:8,cursor:"pointer"}}>
                <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
                <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" size={18}/>
                <span style={{fontSize:13,color:T.textSub}}>Clicca per allegare una foto</span>
              </label>
              :<div style={{position:"relative",display:"inline-block"}}>
                <img src={photoPreview} alt="preview" style={{maxHeight:200,maxWidth:"100%",borderRadius:8,border:`1px solid ${T.border}`,display:"block"}}/>
                <button onClick={removePhoto} style={{position:"absolute",top:6,right:6,background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:6,color:T.red,padding:"3px 10px",cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            }
          </div>
          <button onClick={submit} disabled={submitting} style={{alignSelf:"flex-end",padding:"11px 26px",background:T.navActive,border:`1px solid ${T.green}44`,borderRadius:8,color:T.green,cursor:submitting?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
            {submitting?"Invio in corso…":"Invia segnalazione"}
          </button>
        </div>
      )}

      {loading?<Spinner/>:list.length===0
        ?<div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"40px",textAlign:"center",color:T.textDim,fontSize:13}}>Nessuna segnalazione presente</div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {openSeg.map(s=>(
            <div key={s.id} style={{background:T.card,border:`1px solid ${s.tipo==="incidente"?"#4a1a1a":s.tipo==="manutenzione"?"#1a2a4a":T.cardBorder}`,borderRadius:12,padding:"16px 20px",boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  {s.tipo&&SEG_TIPO[s.tipo]&&<span style={{fontSize:11,padding:"2px 10px",borderRadius:10,background:SEG_TIPO[s.tipo].color+"22",color:SEG_TIPO[s.tipo].color,fontWeight:700,border:`1px solid ${SEG_TIPO[s.tipo].color}44`}}>{SEG_TIPO[s.tipo].label}</span>}
                  <span style={{fontSize:14,fontWeight:700,color:T.text}}>{s.vehicle}</span>
                  {s.plate&&<span style={{fontSize:11,color:T.textSub,fontFamily:T.mono}}>{s.plate}</span>}
                  <span style={{fontSize:11,color:T.textDim}}>· {s.settore}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:SEG_STATUS[s.status]?.color+"22",color:SEG_STATUS[s.status]?.color,fontWeight:600,border:`1px solid ${SEG_STATUS[s.status]?.color}44`}}>{SEG_STATUS[s.status]?.label}</span>
                  {isManager&&s.status!=="chiusa"&&(
                    <select value={s.status} onChange={e=>updateStatus(s.id,e.target.value)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",color:T.text,fontSize:11,outline:"none",cursor:"pointer",fontFamily:T.font}}>
                      <option value="aperta">Aperta</option><option value="in_lavorazione">In lavorazione</option><option value="chiusa">Chiusa</option>
                    </select>
                  )}
                </div>
              </div>
              <div style={{fontSize:13,color:T.text+"aa",lineHeight:1.6,marginBottom:10}}>{s.description}</div>
              {s.photo_url&&<div style={{marginBottom:10}}><img src={`${BASE_URL}${s.photo_url}`} alt="foto" style={{maxHeight:220,maxWidth:"100%",borderRadius:8,border:`1px solid ${T.border}`,display:"block",cursor:"pointer"}} onClick={()=>window.open(`${BASE_URL}${s.photo_url}`,"_blank")}/></div>}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:T.textDim}}>👤 {s.reporter_name}</div>
                {s.available_from&&<div style={{fontSize:11,color:T.textDim}}>🔧 Disponibile dal {s.available_from}</div>}
                <div style={{fontSize:11,color:T.textDim,marginLeft:"auto"}}>{new Date(s.created_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            </div>
          ))}
          {closedSeg.length>0&&(
            <details style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 16px"}}>
              <summary style={{fontSize:13,color:T.textSub,cursor:"pointer",userSelect:"none"}}>Segnalazioni chiuse ({closedSeg.length})</summary>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>
                {closedSeg.map(s=>(
                  <div key={s.id} style={{background:T.bg,borderRadius:8,padding:"10px 14px",opacity:0.6}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <div><span style={{fontSize:13,fontWeight:600,color:T.text}}>{s.vehicle}</span><span style={{fontSize:11,color:T.textDim}}> · {s.settore}</span></div>
                      <span style={{fontSize:11,color:T.green}}>Chiusa</span>
                    </div>
                    <div style={{fontSize:12,color:T.textSub,marginTop:4}}>{s.description}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      }
    </div>
  );
}

export default SegnalazioniModule;
