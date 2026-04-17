import React, { useState } from "react";
import T from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { API } from "@/api";
import Icon from "@/shared/ui/Icon";

export default function ReportsModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const [downloading,setDownloading]=useState(null);
  const [msg,setMsg]=useState(null);
  const download=async(endpoint,label)=>{
    setDownloading(endpoint);setMsg(null);
    try{
      const res=await fetch(`${API}/reports/${endpoint}`,{headers:{Authorization:`Bearer ${auth.token}`}});
      if(!res.ok){setMsg({ok:false,text:"Errore generazione report"});return;}
      const blob=await res.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`${label}_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(url);
      setMsg({ok:true,text:`${label} scaricato`});
    }catch{setMsg({ok:false,text:"Errore di rete"});}
    setDownloading(null);setTimeout(()=>setMsg(null),3000);
  };
  const reports=[
    {id:"fleet",label:"Report completo flotta",desc:"Carburante + Officina + Segnalazioni in un unico file Excel",icon:"M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",always:true},
    {id:"segnalazioni",label:"Segnalazioni",desc:"Tutte le segnalazioni con tipo, stato, veicolo e data",icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",always:true},
    {id:"fuel",label:"Registro carburante",desc:"Tutti i rifornimenti con litri, costo, KM e stazione",icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6",perm:"fuel"},
    {id:"workshop",label:"Ordini officina",desc:"Tutti gli ordini con stato, meccanico, ETA e note",icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",perm:"workshop"},
  ].filter(r=>r.always||can(r.perm));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:T.font}}>
      <div style={{fontSize:13,color:T.textSub}}>Scarica i dati in formato Excel — compatibile con Microsoft Excel e Google Sheets</div>
      {msg&&<div style={{padding:"10px 16px",borderRadius:8,background:msg.ok?T.card:"#1a0808",border:`1px solid ${msg.ok?T.border:"#4a1a1a"}`,color:msg.ok?T.green:T.red,fontSize:13}}>{msg.text}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {reports.map(r=>(
          <div key={r.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
            <div style={{width:44,height:44,borderRadius:10,background:T.bg,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:T.blue}}>
              <Icon d={r.icon} size={20}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:3}}>{r.label}</div>
              <div style={{fontSize:12,color:T.textSub}}>{r.desc}</div>
            </div>
            <button onClick={()=>download(r.id,r.label)} disabled={downloading===r.id}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",background:downloading===r.id?T.bg:T.navActive,border:`1px solid ${downloading===r.id?T.border:T.blue+"55"}`,borderRadius:8,color:downloading===r.id?T.textDim:T.blue,cursor:downloading===r.id?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,whiteSpace:"nowrap"}}>
              <Icon d={downloading===r.id?"M12 2v4 M12 18v4":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"} size={14}/>
              {downloading===r.id?"Generazione…":"Scarica Excel"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
