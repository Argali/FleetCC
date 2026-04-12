import React from "react";
import T from "../../theme";
import Icon from "./Icon";

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,marginBottom:20,flexShrink:0}}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{
            padding:"10px 20px 11px",
            background:"transparent",
            border:"none",
            borderBottom: active===t.id ? `2px solid ${T.tabLine}` : "2px solid transparent",
            color: active===t.id ? T.blue : T.textSub,
            cursor:"pointer",
            fontSize:14,
            fontFamily:T.font,
            fontWeight: active===t.id ? 600 : 400,
            marginBottom:-1,
            transition:"color 0.15s, border-color 0.15s",
            display:"flex",
            alignItems:"center",
            gap:7,
            position:"relative",
          }}>
          {t.icon && <span style={{opacity:active===t.id?1:0.6}}><Icon d={t.icon} size={14}/></span>}
          {t.label}
          {t.badge > 0 && (
            <span style={{background:T.orange,color:"#000",fontSize:9,fontWeight:700,borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default TabBar;
