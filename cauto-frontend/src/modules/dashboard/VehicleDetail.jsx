import React from "react";
import { usePerms } from "@/core/permissions/PermContext";
import { useApi } from "@/hooks/useApi";
import T, { statusColor, statusLabel } from "@/theme";
import Icon from "@/shared/ui/Icon";

function VehicleDetail({vehicle,onBack}){
  const {can}=usePerms();
  const {data:orders}=useApi("/workshop/orders",{skip:!can("workshop")});
  const {data:fuelEntries}=useApi("/fuel/entries",{skip:!can("fuel")});
  const vOrders=orders?orders.filter(o=>o.plate===vehicle.plate):[];
  const vFuel=fuelEntries?fuelEntries.filter(e=>e.vehicle===vehicle.name):[];
  const totalFuelCost=vFuel.reduce((s,e)=>s+parseFloat(e.cost_eur||0),0);
  const totalLiters=vFuel.reduce((s,e)=>s+parseFloat(e.liters||0),0);
  const sc=statusColor[vehicle.status]||T.green;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20,fontFamily:T.font}}>
      <button onClick={onBack} style={{alignSelf:"flex-start",display:"flex",alignItems:"center",gap:6,background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSub,padding:"7px 14px",cursor:"pointer",fontSize:13}}>
        <Icon d="M19 12H5 M12 19l-7-7 7-7" size={14}/> Torna indietro
      </button>
      <div style={{background:T.card,border:`1px solid ${sc}33`,borderRadius:14,padding:"22px 26px",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:T.text}}>{vehicle.name}</div>
            <div style={{fontSize:13,color:T.textSub,marginTop:4,fontFamily:T.mono}}>{vehicle.plate}</div>
          </div>
          <span style={{fontSize:12,padding:"5px 14px",borderRadius:20,background:sc+"22",color:sc,fontWeight:700,border:`1px solid ${sc}44`}}>{statusLabel[vehicle.status]}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginTop:20}}>
          {[["Settore",vehicle.sector||"—"],["Velocità",vehicle.speed_kmh>0?`${vehicle.speed_kmh} km/h`:"Fermo"],["Coordinate",vehicle.lat&&vehicle.lng?`${vehicle.lat.toFixed(3)}, ${vehicle.lng.toFixed(3)}`:"—"]].map(([label,value])=>(
            <div key={label} style={{background:T.bg,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
              <div style={{fontSize:13,color:T.text,fontFamily:T.mono}}>{value}</div>
            </div>
          ))}
          {vehicle.fuel_pct!=null&&(
            <div style={{background:T.bg,borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:10,color:T.textDim,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Carburante</div>
              <div style={{height:6,background:T.border,borderRadius:3,marginBottom:4}}>
                <div style={{height:"100%",width:`${vehicle.fuel_pct}%`,background:vehicle.fuel_pct<20?T.red:T.green,borderRadius:3}}/>
              </div>
              <div style={{fontSize:13,color:vehicle.fuel_pct<20?T.red:T.green,fontFamily:T.mono}}>{vehicle.fuel_pct}%</div>
            </div>
          )}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {can("workshop")&&(
          <div>
            <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:600}}>Storico officina</div>
            {vOrders.length===0
              ?<div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"20px",fontSize:13,color:T.textDim,textAlign:"center"}}>Nessun ordine trovato</div>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {vOrders.map(o=>(
                  <div key={o.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"12px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:600,color:T.text}}>{o.type}</span>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:statusColor[o.status]+"22",color:statusColor[o.status],fontWeight:600}}>{statusLabel[o.status]}</span>
                    </div>
                    <div style={{fontSize:12,color:T.textSub,marginBottom:4}}>{o.notes}</div>
                    <div style={{fontSize:11,color:T.textDim}}>{o.mechanic?`👤 ${o.mechanic}`:""}{o.eta?` · ETA ${o.eta}`:""}</div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
        {can("fuel")&&(
          <div>
            <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:600}}>Storico carburante</div>
            {vFuel.length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1,background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>Litri totali</div>
                  <div style={{fontSize:18,fontWeight:700,color:T.green,fontFamily:T.mono}}>{totalLiters} L</div>
                </div>
                <div style={{flex:1,background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>Costo totale</div>
                  <div style={{fontSize:18,fontWeight:700,color:T.green,fontFamily:T.mono}}>€{totalFuelCost.toFixed(2)}</div>
                </div>
              </div>
            )}
            {vFuel.length===0
              ?<div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"20px",fontSize:13,color:T.textDim,textAlign:"center"}}>Nessun rifornimento trovato</div>
              :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                {vFuel.map((e,i)=>(
                  <div key={i} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:12,color:T.text,fontFamily:T.mono}}>{e.date}</div>
                      <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{e.station}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.green,fontFamily:T.mono}}>{e.liters} L</div>
                      <div style={{fontSize:11,color:T.textDim}}>€{e.cost_eur}</div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}

export default VehicleDetail;
