import React from "react";
import { useApi } from "@/hooks/useApi";
import T from "@/theme";
import Spinner from "@/shared/ui/Spinner";
import ApiError from "@/shared/ui/ApiError";

function CostsModule(){
  const {data:costs,loading,error,refetch}=useApi("/costs/monthly");
  if(loading)return<Spinner/>;if(error)return<ApiError error={error} onRetry={refetch}/>;
  const max=Math.max(...costs.map(c=>c.total));
  return(
    <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:14,padding:24,fontFamily:T.font,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
      <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:20}}>Costi Mensili 2026</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:16,height:180}}>
        {costs.map(c=>{const s=v=>`${(v/max)*160}px`;return(
          <div key={c.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:11,color:T.green,fontFamily:T.mono,marginBottom:4}}>€{c.total}</div>
            <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:160,gap:2}}>
              {[[c.fuel,T.green+"88"],[c.maintenance,T.blue+"88"],[c.other,T.yellow+"88"]].map(([v,col],i)=><div key={i} style={{width:"100%",height:s(v),background:col,borderRadius:3}}/>)}
            </div>
            <div style={{fontSize:11,color:T.textSub,marginTop:6}}>{c.month.slice(5)}/{c.month.slice(2,4)}</div>
          </div>);})}
      </div>
      <div style={{display:"flex",gap:20,marginTop:18}}>{[[T.green,"Carburante"],[T.blue,"Manutenzione"],[T.yellow,"Altro"]].map(([col,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.textSub}}><div style={{width:10,height:10,borderRadius:2,background:col}}/>{l}</div>)}</div>
    </div>
  );
}

export default CostsModule;
