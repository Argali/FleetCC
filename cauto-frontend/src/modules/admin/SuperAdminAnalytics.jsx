import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import T, { alpha } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { API } from "@/api";
import Spinner from "@/shared/ui/Spinner";

const MODULE_LABELS_SHORT={gps:"GPS",cdr:"CDR",zone:"Zone",punti:"Punti",percorsi:"Percorsi",pdf_export:"PDF"};
const CHART_COLORS=["#60a5fa","#4ade80","#fb923c","#f472b6","#34d399","#facc15"];

export default function SuperAdminAnalytics(){
  const {auth}=useAuth();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r=await fetch(`${API}/superadmin/analytics`,{headers:{Authorization:`Bearer ${auth.token}`}});
        const d=await r.json();
        if(d.ok)setData(d.data);
      }catch{}
      setLoading(false);
    })();
  },[auth.token]);

  if(loading) return <Spinner/>;
  if(!data) return <div style={{color:T.textSub,fontSize:13}}>Impossibile caricare i dati</div>;

  const {summary,module_adoption,tenant_stats,inactive_alerts}=data;
  const chartData=module_adoption.map((m,i)=>({name:MODULE_LABELS_SHORT[m.module]||m.module,count:m.count,pct:m.pct,fill:CHART_COLORS[i%CHART_COLORS.length]}));

  const statCards=[
    {label:"Aziende attive",value:summary.active_tenants,color:T.blue},
    {label:"Utenti attivi",value:summary.total_users,color:T.green},
    {label:"Aziende inattive >7gg",value:summary.inactive_tenants,color:summary.inactive_tenants>0?T.orange:T.textSub},
    {label:"Aziende totali",value:summary.total_tenants,color:T.textSub},
  ];

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:22}}>
      <div>
        <div style={{fontSize:18,fontWeight:700,color:T.text}}>Analytics Piattaforma</div>
        <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Panoramica sull'adozione e attività dei tenant</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
        {statCards.map(s=>(
          <div key={s.label} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"16px 18px"}}>
            <div style={{fontSize:28,fontWeight:800,color:s.color,fontVariantNumeric:"tabular-nums"}}>{s.value}</div>
            <div style={{fontSize:11,color:T.textSub,marginTop:4,fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"18px 20px"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:16}}>Adozione moduli</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={32}>
            <XAxis dataKey="name" tick={{fill:T.textSub,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.textSub,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip
              contentStyle={{background:T.sidebar,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}
              formatter={(v,_n,p)=>[`${v} / ${summary.active_tenants} aziende (${p.payload.pct}%)`,"Tenant"]}
            />
            <Bar dataKey="count" radius={[4,4,0,0]}>
              {chartData.map((entry,i)=><Cell key={i} fill={entry.fill}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {inactive_alerts.length>0&&(
        <div style={{background:T.card,border:`1px solid ${alpha(T.orange,27)}`,borderRadius:10,padding:"18px 20px"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.orange,marginBottom:12}}>⚠ Allerta inattività ({inactive_alerts.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {inactive_alerts.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",background:"#1a0f00",border:"1px solid #2a1a00",borderRadius:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:T.orange,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{a.name}</div>
                  <div style={{fontSize:11,color:T.textDim}}>Ultimo accesso: {new Date(a.last_active).toLocaleDateString("it-IT")}</div>
                </div>
                <div style={{fontSize:12,color:T.orange,fontFamily:T.mono,fontWeight:700}}>{a.days_inactive} gg</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"18px 20px"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:14}}>Dettaglio tenant</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>
                {["Azienda","Piano","Utenti","Moduli","Ultimo accesso","Stato"].map(h=>(
                  <th key={h} style={{padding:"8px 14px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenant_stats.map(t=>(
                <tr key={t.id} style={{borderBottom:`1px solid ${alpha(T.border,13)}`}}>
                  <td style={{padding:"12px 14px",color:T.text,fontWeight:600}}>{t.name}</td>
                  <td style={{padding:"12px 14px",color:T.textSub}}>{t.plan}</td>
                  <td style={{padding:"12px 14px",color:T.blue,fontFamily:T.mono}}>{t.user_count}</td>
                  <td style={{padding:"12px 14px",color:T.green,fontFamily:T.mono}}>{t.modules_enabled} / 6</td>
                  <td style={{padding:"12px 14px",color:t.inactive?T.orange:T.textSub}}>
                    {new Date(t.last_active).toLocaleDateString("it-IT")}
                    {t.inactive&&<span style={{marginLeft:6,fontSize:10,color:T.orange}}>⚠</span>}
                  </td>
                  <td style={{padding:"12px 14px"}}>
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,fontWeight:600,
                      background:t.inactive?"#1a0a0a":"#0a1a0a",
                      color:t.inactive?T.orange:T.green,
                      border:`1px solid ${t.inactive?T.orange:T.green}44`}}>
                      {t.inactive?"Inattivo":"Attivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
