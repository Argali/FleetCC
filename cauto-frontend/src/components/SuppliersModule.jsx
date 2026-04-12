import React, { useState } from "react";
import { useApi } from "../hooks/useApi";
import T from "../theme";
import Spinner from "./ui/Spinner";
import ApiError from "./ui/ApiError";

function SuppliersModule(){
  const {data:suppliers,loading,error,refetch}=useApi("/suppliers");
  const [search,setSearch]=useState("");
  const catColors={Carburante:T.blue,Ricambi:T.red,Pneumatici:T.yellow,Lubrificanti:T.green};
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  const filtered=suppliers.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.category.toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,fontFamily:T.font}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca fornitore o categoria..."
        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"11px 16px",color:T.text,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:10}}>
        {filtered.map(s=>(
          <div key={s.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>{s.name}</div>
              <span style={{fontSize:10,padding:"2px 10px",borderRadius:10,background:(catColors[s.category]||T.green)+"22",color:catColors[s.category]||T.green,fontWeight:600}}>{s.category}</span>
            </div>
            <div style={{fontSize:12,color:T.textSub,marginBottom:4}}>📞 {s.contact}</div>
            <div style={{fontSize:12,color:T.textSub}}>✉ {s.email}</div>
            {s.notes&&<div style={{fontSize:11,color:T.textDim,marginTop:8,fontStyle:"italic"}}>{s.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SuppliersModule;
