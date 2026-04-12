import React from "react";
import { useAuth } from "../context/AuthContext";
import { usePerms } from "../context/PermContext";
import { useApi } from "../hooks/useApi";
import { API } from "../api";
import T, { statusColor, statusLabel } from "../theme";
import Spinner from "./ui/Spinner";
import ApiError from "./ui/ApiError";

function WorkshopModule(){
  const {auth}=useAuth();
  const {can}=usePerms();
  const {data:orders,loading,error,refetch}=useApi("/workshop/orders");
  const canEdit=can("workshop","edit");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,fontFamily:T.font}}>
      {!canEdit&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 16px",fontSize:12,color:T.textSub}}>👁 Solo lettura — il tuo ruolo non permette modifiche</div>}
      <div style={{display:"flex",gap:12}}>
        {["waiting_parts","in_progress","done"].map(col=>(
          <div key={col} style={{flex:1,background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[col]}}/>
              <span style={{fontSize:11,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8}}>{{"waiting_parts":"In Attesa","in_progress":"In Corso","done":"Completato"}[col]}</span>
              <span style={{fontSize:11,color:T.textDim,marginLeft:"auto",background:T.bg,padding:"1px 8px",borderRadius:10}}>{orders.filter(o=>o.status===col).length}</span>
            </div>
            {orders.filter(o=>o.status===col).map(o=>(
              <div key={o.id} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:12,marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:4}}>{o.vehicle}</div>
                <div style={{fontSize:11,color:T.textSub,marginBottom:6}}>{o.plate} · {o.type}</div>
                <div style={{fontSize:11,color:T.text+"88"}}>{o.notes}</div>
                {o.mechanic&&<div style={{fontSize:10,color:T.textDim,marginTop:4}}>👤 {o.mechanic}{o.eta?` · ETA ${o.eta}`:""}</div>}
                {canEdit&&col!=="done"&&(
                  <button onClick={async()=>{
                    const next=col==="waiting_parts"?"in_progress":"done";
                    await fetch(`${API}/workshop/orders/${o.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({status:next})});
                    refetch();
                  }} style={{marginTop:8,fontSize:11,padding:"4px 10px",background:T.navActive,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,cursor:"pointer",fontFamily:T.font}}>
                    → {col==="waiting_parts"?"Inizia":"Completa"}
                  </button>
                )}
              </div>
            ))}
            {orders.filter(o=>o.status===col).length===0&&<div style={{fontSize:12,color:T.textDim,textAlign:"center",paddingTop:24}}>Nessun ordine</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkshopModule;
