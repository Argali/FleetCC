import React from "react";
import T from "../theme";
import { statusLabel, statusColor } from "../theme";
import { usePerms } from "../context/PermContext";
import { useApi } from "../hooks/useApi";
import Spinner from "./ui/Spinner";
import StatCard from "./ui/StatCard";

export default function CruscottoModule({onSelectVehicle}){
  const {can}=usePerms();
  const {data:vehicles,loading:lV}=useApi("/gps/vehicles",{skip:!can("gps")});
  const {data:fuelEntries,loading:lF}=useApi("/fuel/entries",{skip:!can("fuel")});
  const {data:orders,loading:lO}=useApi("/workshop/orders",{skip:!can("workshop")});
  const {data:costs,loading:lC}=useApi("/costs/monthly",{skip:!can("costs")});
  if(lV||lF||lO||lC)return<Spinner/>;

  const vFuel={};
  fuelEntries?.forEach(e=>{
    if(!vFuel[e.vehicle])vFuel[e.vehicle]={liters:0,cost:0,refills:0,lastKm:0};
    vFuel[e.vehicle].liters+=Number(e.liters);vFuel[e.vehicle].cost+=parseFloat(e.cost_eur);vFuel[e.vehicle].refills+=1;
    if(e.km>vFuel[e.vehicle].lastKm)vFuel[e.vehicle].lastKm=e.km;
  });
  const vOrders={};orders?.forEach(o=>{vOrders[o.vehicle]=(vOrders[o.vehicle]||0)+1;});
  const rows=(vehicles||[]).map(v=>({...v,f:vFuel[v.name]||null,ordersCount:vOrders[v.name]||0}));
  const totalLiters=Object.values(vFuel).reduce((s,f)=>s+f.liters,0);
  const totalFuelCost=Object.values(vFuel).reduce((s,f)=>s+f.cost,0);
  const totalOrders=orders?.length||0;
  const currentMonth=costs?costs[costs.length-1]:null;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20,fontFamily:T.font}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {vehicles&&<StatCard label="Veicoli in flotta" value={vehicles.length} icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
        {can("fuel")&&<StatCard label="Litri totali" value={`${totalLiters.toFixed(0)} L`} icon="M3 22V8l9-6 9 6v14H3z"/>}
        {can("fuel")&&<StatCard label="Costo carburante" value={`€${totalFuelCost.toFixed(0)}`} icon="M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>}
        {can("workshop")&&<StatCard label="Ordini officina" value={totalOrders} color={totalOrders>0?T.orange:T.green} alert={totalOrders>0} icon="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
        {can("costs")&&currentMonth&&<StatCard label="Costi aprile" value={`€${currentMonth.total}`} icon="M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3"/>}
      </div>
      <div>
        <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Dettaglio per veicolo</div>
        <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:T.bg}}>
                {["Veicolo","Stato",can("gps")&&"Odom. km",can("fuel")&&"Litri",can("fuel")&&"Costo carb.",can("fuel")&&"Rifornimenti",can("workshop")&&"Interventi",can("gps")&&"Carburante",""].filter(Boolean).map(h=>(
                  <th key={h} style={{padding:"12px 16px",textAlign:h===""?"center":"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(v=>(
                <tr key={v.id} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"14px 16px"}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{v.name}</div><div style={{fontSize:10,color:T.textDim,fontFamily:T.mono}}>{v.plate}</div></td>
                  <td style={{padding:"14px 16px"}}><span style={{fontSize:10,padding:"3px 10px",borderRadius:10,background:statusColor[v.status]+"22",color:statusColor[v.status],fontWeight:600}}>{statusLabel[v.status]}</span></td>
                  {can("gps")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.text,fontFamily:T.mono,fontSize:12}}>{v.f?.lastKm?v.f.lastKm.toLocaleString("it-IT"):"—"}</td>}
                  {can("fuel")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.green,fontFamily:T.mono,fontSize:12}}>{v.f?`${v.f.liters} L`:"—"}</td>}
                  {can("fuel")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.green,fontFamily:T.mono,fontSize:12}}>{v.f?`€${v.f.cost.toFixed(2)}`:"—"}</td>}
                  {can("fuel")&&<td style={{padding:"14px 16px",textAlign:"right",color:T.text+"88",fontSize:12}}>{v.f?v.f.refills:"—"}</td>}
                  {can("workshop")&&<td style={{padding:"14px 16px",textAlign:"right",fontSize:12}}><span style={{color:v.ordersCount>0?T.orange:T.textDim}}>{v.ordersCount}</span></td>}
                  {can("gps")&&<td style={{padding:"14px 16px",textAlign:"right",minWidth:90}}>
                    {v.fuel_pct!=null?<><div style={{height:4,background:T.border,borderRadius:2,marginBottom:2}}><div style={{height:"100%",width:`${v.fuel_pct}%`,background:v.fuel_pct<20?T.red:T.green,borderRadius:2}}/></div><div style={{fontSize:10,color:v.fuel_pct<20?T.red:T.textDim,textAlign:"right"}}>{v.fuel_pct}%</div></>:"—"}
                  </td>}
                  <td style={{padding:"14px 16px",textAlign:"center"}}><button onClick={()=>onSelectVehicle(v)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,color:T.text,padding:"5px 12px",cursor:"pointer",fontSize:12,fontFamily:T.font,whiteSpace:"nowrap"}}>Dettaglio →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {can("costs")&&costs&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Costi mensili</div>
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:T.bg}}>{["Mese","Carburante","Manutenzione","Altro","Totale"].map(h=><th key={h} style={{padding:"12px 16px",textAlign:h==="Mese"?"left":"right",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>)}</tr></thead>
              <tbody>{costs.map(c=>(
                <tr key={c.month} style={{borderTop:`1px solid ${T.border}`}}>
                  <td style={{padding:"12px 16px",color:T.textSub,fontFamily:T.mono}}>{c.month}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.green,fontFamily:T.mono}}>€{c.fuel}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.blue,fontFamily:T.mono}}>€{c.maintenance}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.yellow,fontFamily:T.mono}}>€{c.other}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",color:T.text,fontFamily:T.mono,fontWeight:700}}>€{c.total}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
