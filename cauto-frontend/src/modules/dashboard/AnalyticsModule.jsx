import React, { useState } from "react";
import T from "@/theme";
import TabBar from "@/shared/ui/TabBar";
import CruscottoModule from "@/modules/dashboard/CruscottoModule";
import ReportsModule from "@/modules/dashboard/ReportsModule";

export default function AnalyticsModule({onSelectVehicle}){
  const [activeTab,setActiveTab]=useState("cruscotto");
  const tabs=[
    {id:"cruscotto",label:"Cruscotto",icon:"M18 20V10 M12 20V4 M6 20v-6"},
    {id:"reports",label:"Report & Export",icon:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"},
  ];
  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab}/>
      {activeTab==="cruscotto"&&<CruscottoModule onSelectVehicle={onSelectVehicle}/>}
      {activeTab==="reports"&&<ReportsModule/>}
    </div>
  );
}
