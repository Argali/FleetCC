import React from "react";
import { useApi } from "@/hooks/useApi";
import T from "@/theme";
import Spinner from "@/shared/ui/Spinner";
import ApiError from "@/shared/ui/ApiError";
import StatCard from "@/shared/ui/StatCard";

function FuelModule(){
  const {data:entries,loading:lE,error:eE,refetch:rE}=useApi("/fuel/entries");
  const {data:summary,loading:lS,error:eS,refetch:rS}=useApi("/fuel/summary");
  if(lE||lS)return<Spinner/>;if(eE)return<ApiError error={eE} onRetry={rE}/>;if(eS)return<ApiError error={eS} onRetry={rS}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,fontFamily:T.font}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {[["Litri Totali",`${summary.total_liters} L`,"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6"],["Costo Totale",`€${summary.total_cost_eur.toFixed(2)}`,"M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],["KM Totali",`${summary.total_km} km`,"M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0 M12 7v5l3 3"],["L/100 km",`${summary.avg_consumption_l100}`,"M13 2L3 14h9l-1 8 10-12h-9l1-8"]].map(([l,v,icon])=>(
          <StatCard key={l} label={l} value={v} icon={icon}/>
        ))}
      </div>
      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:T.bg}}>{["Data","Veicolo","Litri","Costo","KM","Stazione"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>)}</tr></thead>
          <tbody>{entries.map((e)=><tr key={`${e.date}-${e.vehicle}-${e.km}`} style={{borderTop:`1px solid ${T.border}`}}>
            <td style={{padding:"12px 16px",color:T.textSub,fontFamily:T.mono,fontSize:12}}>{e.date}</td>
            <td style={{padding:"12px 16px",color:T.text,fontWeight:500}}>{e.vehicle}</td>
            <td style={{padding:"12px 16px",color:T.green,fontFamily:T.mono}}>{e.liters} L</td>
            <td style={{padding:"12px 16px",color:T.green,fontFamily:T.mono}}>€{e.cost_eur}</td>
            <td style={{padding:"12px 16px",color:T.text+"88",fontFamily:T.mono}}>{e.km}</td>
            <td style={{padding:"12px 16px",color:T.textSub}}>{e.station}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export default FuelModule;
