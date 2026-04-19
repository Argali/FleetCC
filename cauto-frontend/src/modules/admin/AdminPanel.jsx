import React, { useState, useEffect, useCallback } from "react";
import T, { alpha, roleLabel, moduleLabel, levelColor } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { API } from "@/api";
import TabBar from "@/shared/ui/TabBar";
import Spinner from "@/shared/ui/Spinner";

export default function AdminPanel(){
  const {auth}=useAuth();
  const {matrix,roles,levels,loadPerms}=usePerms();
  const [activeTab,setActiveTab]=useState("permissions");
  const [localMatrix,setLocalMatrix]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);
  const [users,setUsers]=useState([]);
  const [usersLoading,setUsersLoading]=useState(false);
  const [showNewUser,setShowNewUser]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",password:"",role:"coordinatore_operativo"});
  const [userMsg,setUserMsg]=useState(null);
  // Only show modules that the SuperAdmin has enabled for this tenant.
  // Fall back to all modules when no config is present so the table is never empty.
  const tenantModules = auth?.tenant?.modules || {};
  const ALL_MODULES   = ["gps","navigation","foto_timbrata","cdr","zone","punti","percorsi","pdf_export","workshop","fuel","suppliers","costs"];
  const hasModuleConfig = Object.keys(tenantModules).length > 0;
  const modules         = hasModuleConfig ? ALL_MODULES.filter(m => tenantModules[m]) : ALL_MODULES;

  useEffect(()=>{ if(matrix)setLocalMatrix(JSON.parse(JSON.stringify(matrix))); },[matrix]);
  const loadUsers=useCallback(async()=>{
    setUsersLoading(true);
    const res=await fetch(`${API}/admin/users`,{headers:{Authorization:`Bearer ${auth.token}`}});
    const d=await res.json();if(d.ok)setUsers(d.data);
    setUsersLoading(false);
  },[auth.token]);
  useEffect(()=>{ if(activeTab==="users")loadUsers(); },[activeTab,loadUsers]);

  const saveMatrix=async()=>{
    setSaving(true);setSaveMsg(null);
    try{
      const res=await fetch(`${API}/permissions`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({matrix:localMatrix})});
      const d=await res.json();
      if(d.ok){setSaveMsg({ok:true,text:"Permessi salvati"});loadPerms();}
      else setSaveMsg({ok:false,text:d.error});
    }catch{setSaveMsg({ok:false,text:"Errore di rete"});}
    setSaving(false);setTimeout(()=>setSaveMsg(null),3000);
  };
  const setLevel=(role,mod,level)=>setLocalMatrix(m=>({...m,[role]:{...m[role],[mod]:level}}));
  const createUser=async()=>{
    if(!newUser.name||!newUser.email||!newUser.password){setUserMsg({ok:false,text:"Tutti i campi sono obbligatori"});return;}
    const res=await fetch(`${API}/admin/users`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
    const d=await res.json();
    if(d.ok){setUserMsg({ok:true,text:"Utente creato"});setShowNewUser(false);setNewUser({name:"",email:"",password:"",role:"coordinatore_operativo"});loadUsers();}
    else setUserMsg({ok:false,text:d.error});
    setTimeout(()=>setUserMsg(null),3000);
  };
  const toggleUser=async(id,active)=>{ await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({active})}); loadUsers(); };
  const changeRole=async(id,role)=>{ await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({role})}); loadUsers(); };
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};

  const adminTabs=[
    {id:"permissions",label:"Permessi",icon:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"},
    {id:"users",label:"Utenti",icon:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"},
  ];

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={adminTabs} active={activeTab} onChange={setActiveTab}/>

      {activeTab==="permissions"&&localMatrix&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr>
                  <th style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`}}>Modulo</th>
                  {roles.map(r=><th key={r} style={{padding:"12px 16px",textAlign:"center",color:T.textSub,fontWeight:600,fontSize:11,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{roleLabel[r]||r}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map(mod=>(
                  <tr key={mod} style={{borderBottom:`1px solid ${alpha(T.border,13)}`}}>
                    <td style={{padding:"14px 16px",color:T.text,fontWeight:600}}>{moduleLabel[mod]||mod}</td>
                    {roles.map(role=>{
                      const current=localMatrix[role]?.[mod]||"none";
                      return(
                        <td key={role} style={{padding:"8px 16px",textAlign:"center"}}>
                          <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
                            {levels.map(lvl=>(
                              <button key={lvl} onClick={()=>setLevel(role,mod,lvl)}
                                style={{padding:"4px 9px",fontSize:10,borderRadius:6,cursor:"pointer",fontFamily:T.font,fontWeight:current===lvl?700:400,background:current===lvl?levelColor[lvl]+"33":"transparent",border:`1px solid ${current===lvl?levelColor[lvl]:T.border}`,color:current===lvl?levelColor[lvl]:T.textDim,transition:"all 0.1s"}}>
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18}}>
            <button onClick={saveMatrix} disabled={saving} style={{padding:"10px 22px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:8,color:T.blue,cursor:saving?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              {saving?"Salvando...":"💾 Salva e applica"}
            </button>
            {saveMsg&&<div style={{fontSize:13,color:saveMsg.ok?T.green:T.red}}>{saveMsg.text}</div>}
          </div>
          <div style={{display:"flex",gap:16,marginTop:14}}>
            {[["none","Nessun accesso"],["view","Solo lettura"],["edit","Modifica"],["full","Accesso completo"]].map(([l,desc])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.textSub}}>
                <div style={{width:8,height:8,borderRadius:2,background:levelColor[l]}}/>{desc}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab==="users"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,color:T.textSub}}>{users.length} utenti</div>
            <button onClick={()=>setShowNewUser(v=>!v)} style={{padding:"9px 16px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              {showNewUser?"✕ Annulla":"+ Nuovo utente"}
            </button>
          </div>
          {userMsg&&<div style={{fontSize:13,padding:"10px 14px",borderRadius:8,background:userMsg.ok?T.card:"#1a0808",border:`1px solid ${userMsg.ok?T.border:"#4a1a1a"}`,color:userMsg.ok?T.green:T.red}}>{userMsg.text}</div>}
          {showNewUser&&(
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{fontSize:14,color:T.text,fontWeight:600}}>Nuovo utente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["Nome","text",newUser.name,v=>setNewUser(u=>({...u,name:v}))],["Email","email",newUser.email,v=>setNewUser(u=>({...u,email:v}))],["Password","password",newUser.password,v=>setNewUser(u=>({...u,password:v}))]].map(([label,type,val,set])=>(
                  <div key={label}>
                    <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} style={inp}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>Ruolo</label>
                  <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={inp}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createUser} style={{alignSelf:"flex-start",padding:"9px 18px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>Crea utente</button>
            </div>
          )}
          {usersLoading?<Spinner/>:
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.map(u=>(
                <div key={u.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,opacity:u.active?1:0.5,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
                    <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{u.email}</div>
                  </div>
                  <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",color:T.text,fontSize:11,outline:"none",fontFamily:T.font,cursor:"pointer"}}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                  <div style={{width:8,height:8,borderRadius:"50%",background:u.active?T.green:T.textDim,flexShrink:0}}/>
                  <button onClick={()=>toggleUser(u.id,!u.active)} style={{fontSize:12,padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:u.active?T.red:T.green,cursor:"pointer",fontFamily:T.font}}>
                    {u.active?"Disattiva":"Riattiva"}
                  </button>
                </div>
              ))}
            </div>
          }
        </div>
      )}
    </div>
  );
}
