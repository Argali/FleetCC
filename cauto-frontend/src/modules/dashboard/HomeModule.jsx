import React from "react";
import T from "@/theme";
import { statusLabel, statusColor } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { useApi } from "@/hooks/useApi";
import StatCard from "@/shared/ui/StatCard";

export default function HomeModule({onSelectVehicle}){
  const {can}=usePerms();
  const {auth}=useAuth();
  const {data:vehicles}=useApi("/gps/vehicles",{skip:!can("gps")});
  const {data:orders}=useApi("/workshop/orders",{skip:!can("workshop")});
  const {data:fuelSummary}=useApi("/fuel/summary",{skip:!can("fuel")});
  const {data:costs}=useApi("/costs/monthly",{skip:!can("costs")});

  const fleetActive=vehicles?vehicles.filter(v=>v.status==="active").length:null;
  const fleetIdle=vehicles?vehicles.filter(v=>v.status==="idle").length:null;
  const fleetWorkshop=vehicles?vehicles.filter(v=>v.status==="workshop").length:null;
  const lowFuel=vehicles?vehicles.filter(v=>v.fuel_pct!=null&&v.fuel_pct<20):[];
  const pendingOrders=orders?orders.filter(o=>o.status!=="done"):[];
  const currentMonth=costs?costs[costs.length-1]:null;
  const prevMonth=costs?costs[costs.length-2]:null;
  const costTrend=currentMonth&&prevMonth?Math.round(((currentMonth.total-prevMonth.total)/prevMonth.total)*100):null;
  const hour=new Date().getHours();
  const greeting=hour<12?"Buongiorno":"Buonasera";

  return(
    <div style={{display:"flex",flexDirection:"column",gap:22,fontFamily:T.font}}>
      <div>
        <div style={{fontSize:22,fontWeight:700,color:T.text}}>{greeting}, {auth.user.name.split(" ")[0]}</div>
        <div style={{fontSize:13,color:T.textSub,marginTop:4}}>Ecco il riepilogo operativo di oggi</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
        {can("gps")&&<StatCard label="Veicoli attivi" value={fleetActive} sub={`${fleetIdle??"—"} fermi · ${fleetWorkshop??"—"} in officina`} icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
        {can("workshop")&&<StatCard label="Ordini aperti" value={pendingOrders.length||null} sub={pendingOrders.length?`${pendingOrders.filter(o=>o.status==="waiting_parts").length} in attesa ricambi`:"Nessun ordine pendente"} color={pendingOrders.length?T.orange:T.green} alert={pendingOrders.length>0} icon="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>}
        {can("fuel")&&<StatCard label="Costo carburante" value={fuelSummary?`€${fuelSummary.total_cost_eur.toFixed(0)}`:null} sub={fuelSummary?`${fuelSummary.total_liters} L · ${fuelSummary.total_km} km`:null} icon="M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6"/>}
        {can("costs")&&currentMonth&&<StatCard label="Costi questo mese" value={`€${currentMonth.total}`} sub={costTrend!=null?(costTrend>0?`▲ +${costTrend}% vs mese scorso`:`▼ ${costTrend}% vs mese scorso`):null} color={costTrend>0?T.orange:T.green} alert={costTrend>10} icon="M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3"/>}
      </div>

      {(lowFuel.length>0||pendingOrders.filter(o=>o.status==="waiting_parts").length>0)&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2,fontWeight:600}}>Attenzione richiesta</div>
          {lowFuel.map(v=>(
            <div key={v.id} style={{background:"#1a100a",border:"1px solid #4a2a1a",borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:T.orange,flexShrink:0}}/>
              <div style={{flex:1}}><span style={{color:T.orange,fontWeight:600,fontSize:13}}>{v.name}</span><span style={{color:"#7a4a2a",fontSize:12}}> — carburante basso: </span><span style={{color:T.orange,fontSize:12,fontFamily:T.mono}}>{v.fuel_pct}%</span></div>
              <div style={{fontSize:11,color:"#4a3a2a"}}>{v.plate}</div>
            </div>
          ))}
          {pendingOrders.filter(o=>o.status==="waiting_parts").map(o=>(
            <div key={o.id} style={{background:"#0a0f1a",border:"1px solid #1a2a4a",borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:T.blue,flexShrink:0}}/>
              <div style={{flex:1}}><span style={{color:T.blue,fontWeight:600,fontSize:13}}>{o.vehicle}</span><span style={{color:"#3a3a6a",fontSize:12}}> — in attesa ricambi · </span><span style={{color:T.blue,fontSize:12}}>{o.type}</span></div>
              {o.eta&&<div style={{fontSize:11,color:"#3a3a6a"}}>ETA {o.eta}</div>}
            </div>
          ))}
        </div>
      )}

      {can("gps")&&vehicles&&vehicles.length>0&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Stato flotta</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:8}}>
            {vehicles.map(v=>(
              <div key={v.id} onClick={()=>onSelectVehicle(v)} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[v.status]??"#3a3a3a",flexShrink:0,boxShadow:`0 0 6px ${statusColor[v.status]??"#3a3a3a"}`}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.name}</div>
                  <div style={{fontSize:10,color:T.textDim}}>{v.plate}{v.sector?` · ${v.sector}`:""}</div>
                </div>
                {v.fuel_pct!=null&&<div style={{fontSize:10,color:v.fuel_pct<20?T.orange:T.textDim,fontFamily:T.mono,flexShrink:0}}>{v.fuel_pct}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {can("workshop")&&pendingOrders.length>0&&(
        <div>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12,fontWeight:600}}>Officina — ordini aperti</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pendingOrders.map(o=>(
              <div key={o.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,padding:"11px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:statusColor[o.status]??"#3a3a3a",flexShrink:0}}/>
                <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:T.text}}>{o.vehicle}</span><span style={{fontSize:12,color:T.textSub}}> · {o.type}</span></div>
                <div style={{fontSize:11,color:T.textDim,whiteSpace:"nowrap"}}>{statusLabel[o.status]}{o.eta?` · ETA ${o.eta}`:""}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
