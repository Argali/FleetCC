import React, { useState } from "react";
import { usePerms } from "@/core/permissions/PermContext";
import T from "@/theme";
import TabBar from "@/shared/ui/TabBar";
import FuelModule from "@/modules/fleet/FuelModule";
import SuppliersModule from "@/modules/fleet/SuppliersModule";
import CostsModule from "@/modules/fleet/CostsModule";

function FlottaModule(){
  const {can}=usePerms();
  const [activeTab,setActiveTab]=useState(can("fuel")?"fuel":can("suppliers")?"suppliers":"costs");

  const tabs=[
    can("fuel")&&{id:"fuel",label:"Carburante",icon:"M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6"},
    can("suppliers")&&{id:"suppliers",label:"Fornitori",icon:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"},
    can("costs")&&{id:"costs",label:"Costi",icon:"M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3"},
  ].filter(Boolean);

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab}/>
      {activeTab==="fuel"&&can("fuel")&&<FuelModule/>}
      {activeTab==="suppliers"&&can("suppliers")&&<SuppliersModule/>}
      {activeTab==="costs"&&can("costs")&&<CostsModule/>}
    </div>
  );
}

export default FlottaModule;
