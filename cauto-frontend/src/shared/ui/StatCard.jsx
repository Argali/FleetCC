import React from "react";
import T from "@/theme";
import Icon from "@/shared/ui/Icon";

function StatCard({label,value,sub,color=T.green,alert=false,icon}){
  return(
    <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,padding:"18px 20px",display:"flex",flexDirection:"column",gap:6,fontFamily:T.font,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{label}</div>
        {icon&&<div style={{color:T.textDim}}><Icon d={icon} size={16}/></div>}
      </div>
      <div style={{fontSize:28,fontWeight:700,color:alert?T.orange:color,fontFamily:T.mono,lineHeight:1}}>{value??<span style={{color:T.textDim}}>—</span>}</div>
      {sub&&<div style={{fontSize:11,color:alert?"#7a4a2a":T.textSub}}>{sub}</div>}
    </div>
  );
}

export default StatCard;
