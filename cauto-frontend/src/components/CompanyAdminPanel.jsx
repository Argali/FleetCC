import React, { useState, useEffect, useCallback } from "react";
import T from "../theme";
import { roleLabel } from "../theme";
import { useAuth } from "../context/AuthContext";
import { usePerms } from "../context/PermContext";
import { API } from "../api";
import { MODULE_META } from "../constants/moduleMeta";
import Spinner from "./ui/Spinner";

export default function CompanyAdminPanel(){
  const {auth}=useAuth();
  const {roles}=usePerms();
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",password:"",role:"coordinatore_operativo"});
  const [msg,setMsg]=useState(null);
  const [tenantModules,setTenantModules]=useState(null);

  const assignableRoles=roles.filter(r=>!["superadmin","company_admin"].includes(r));

  const load=useCallback(async()=>{
    setLoading(true);
    const r=await fetch(`${API}/admin/users`,{headers:{Authorization:`Bearer ${auth.token}`}});
    const d=await r.json();if(d.ok)setUsers(d.data);
    setLoading(false);
  },[auth.token]);

  useEffect(()=>{ load(); },[load]);

  useEffect(()=>{
    if(auth?.tenant?.modules) setTenantModules(auth.tenant.modules);
  },[auth?.tenant?.modules]);

  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};

  const createUser=async()=>{
    if(!newUser.name||!newUser.email||!newUser.password){setMsg({ok:false,text:"Tutti i campi sono obbligatori"});return;}
    const r=await fetch(`${API}/admin/users`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
    const d=await r.json();
    if(d.ok){setMsg({ok:true,text:"Utente creato"});setShowNew(false);setNewUser({name:"",email:"",password:"",role:"coordinatore_operativo"});load();}
    else setMsg({ok:false,text:d.error});
    setTimeout(()=>setMsg(null),3000);
  };
  const toggleUser=async(id,active)=>{
    await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({active})});
    load();
  };
  const changeRole=async(id,role)=>{
    await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({role})});
    load();
  };

  return(
    <div style={{fontFamily:T.font,display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <div style={{fontSize:18,fontWeight:700,color:T.text}}>Amministrazione Azienda</div>
        <div style={{fontSize:12,color:T.textSub,marginTop:2}}>Gestisci gli utenti della tua organizzazione</div>
      </div>

      {tenantModules&&(
        <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px"}}>
          <div style={{fontSize:11,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10,fontWeight:600}}>Moduli abilitati dalla piattaforma</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(MODULE_META).map(([mod,meta])=>{
              const enabled=tenantModules[mod]??false;
              return(
                <div key={mod} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:8,fontSize:11,fontWeight:600,
                  background:enabled?"#0a1a0a":"transparent",border:`1px solid ${enabled?T.green:T.border}`,color:enabled?T.green:T.textDim}}>
                  {meta.label}
                </div>
              );
            })}
          </div>
          <div style={{fontSize:10,color:T.textDim,marginTop:8}}>Contatta il supporto per modificare i moduli abilitati</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,color:T.textSub}}>{users.length} utenti nella tua organizzazione</div>
          <button onClick={()=>setShowNew(v=>!v)}
            style={{padding:"9px 16px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
            {showNew?"✕ Annulla":"+ Nuovo utente"}
          </button>
        </div>

        {msg&&<div style={{fontSize:13,padding:"10px 14px",borderRadius:8,background:msg.ok?T.card:"#1a0808",border:`1px solid ${msg.ok?T.border:"#4a1a1a"}`,color:msg.ok?T.green:T.red}}>{msg.text}</div>}

        {showNew&&(
          <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:18,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:14,color:T.text,fontWeight:600}}>Nuovo utente</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["Nome","text",newUser.name,v=>setNewUser(u=>({...u,name:v}))],
                ["Email","email",newUser.email,v=>setNewUser(u=>({...u,email:v}))],
                ["Password","password",newUser.password,v=>setNewUser(u=>({...u,password:v}))]].map(([label,type,val,set])=>(
                <div key={label}>
                  <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
                  <input type={type} value={val} onChange={e=>set(e.target.value)} style={inp}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>Ruolo</label>
                <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={inp}>
                  {assignableRoles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                </select>
              </div>
            </div>
            <button onClick={createUser}
              style={{alignSelf:"flex-start",padding:"9px 18px",background:T.navActive,border:`1px solid ${T.blue}55`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              Crea utente
            </button>
          </div>
        )}

        {loading?<Spinner/>:(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {users.map(u=>(
              <div key={u.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,opacity:u.active?1:0.5}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
                  <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{u.email}</div>
                </div>
                <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)}
                  style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",color:T.text,fontSize:11,outline:"none",fontFamily:T.font,cursor:"pointer"}}>
                  {assignableRoles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                </select>
                <div style={{width:8,height:8,borderRadius:"50%",background:u.active?T.green:T.textDim,flexShrink:0}}/>
                <button onClick={()=>toggleUser(u.id,!u.active)}
                  style={{fontSize:12,padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:u.active?T.red:T.green,cursor:"pointer",fontFamily:T.font}}>
                  {u.active?"Disattiva":"Riattiva"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
