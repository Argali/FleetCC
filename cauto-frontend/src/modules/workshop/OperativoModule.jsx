import React, { useState, useEffect } from "react";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { API } from "@/api";
import T from "@/theme";
import TabBar from "@/shared/ui/TabBar";
import WorkshopModule from "@/modules/workshop/WorkshopModule";
import SegnalazioniModule from "@/modules/workshop/SegnalazioniModule";

function OperativoModule(){
  const {can}=usePerms();
  const {auth}=useAuth();
  const [activeTab,setActiveTab]=useState("segnalazioni");
  const [openCount,setOpenCount]=useState(0);

  // load badge count for open segnalazioni
  useEffect(()=>{
    fetch(`${API}/segnalazioni`,{headers:{Authorization:`Bearer ${auth.token}`}})
      .then(r=>r.json()).then(d=>{if(d.ok)setOpenCount(d.data.filter(s=>s.status!=="chiusa").length);}).catch(()=>{});
  },[auth.token]);

  const tabs=[
    can("workshop")&&{id:"workshop",label:"Ordini Officina",icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"},
    {id:"segnalazioni",label:"Segnalazioni",icon:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",badge:openCount},
  ].filter(Boolean);

  // make sure active tab is valid
  useEffect(()=>{if(!tabs.find(t=>t.id===activeTab)&&tabs.length)setActiveTab(tabs[0].id);},[tabs,activeTab]);

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab}/>
      {activeTab==="workshop"&&can("workshop")&&<WorkshopModule/>}
      {activeTab==="segnalazioni"&&<SegnalazioniModule/>}
    </div>
  );
}

export default OperativoModule;
