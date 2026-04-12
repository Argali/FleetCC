import React, { useState } from "react";
import { msalInstance, loginRequest } from "../msalConfig.js";
import { useAuth } from "../context/AuthContext";
import { API } from "../api";
import T from "../theme";
import FleetLogo from "./ui/FleetLogo";

function LoginScreen(){
  const {login}=useAuth();
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const [adminEmail,setAdminEmail]=useState("");
  const [adminPwd,setAdminPwd]=useState("");
  const [adminLoading,setAdminLoading]=useState(false);

  const handleMicrosoftLogin=async()=>{
    setLoading(true);setError(null);
    try{ await msalInstance.loginRedirect(loginRequest); }
    catch(e){ setError(e?.message||e?.errorCode||"Accesso non riuscito"); setLoading(false); }
  };

  const handleAdminLogin=async(e)=>{
    e.preventDefault();
    setAdminLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:adminEmail,password:adminPwd})});
      const d=await res.json();
      if(d.ok){ login(d.token,d.user,d.tenant); }
      else setError(d.error||"Credenziali non valide");
    }catch{ setError("Errore di rete"); }
    setAdminLoading(false);
  };

  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};

  return(
    <div style={{height:"100vh",background:T.sidebar,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",opacity:0.03,pointerEvents:"none"}}><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#60a5fa" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
      <div style={{width:400}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:14}}>
            <FleetLogo size={52}/>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:26,fontWeight:800,color:T.text,letterSpacing:-0.5}}>Fleet<span style={{color:T.green}}>CC</span></div>
              <div style={{fontSize:11,color:T.textSub,letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>Fleet Command Center</div>
            </div>
          </div>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:16,padding:32,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:6}}>Accesso operatori</div>
          <div style={{fontSize:13,color:T.textSub,marginBottom:28}}>Usa il tuo account Microsoft aziendale</div>
          {error&&<div style={{background:"#1a0808",border:"1px solid #4a1a1a",borderRadius:8,padding:"10px 14px",color:T.red,fontSize:13,marginBottom:16}}>{error}</div>}
          <button onClick={handleMicrosoftLogin} disabled={loading}
            style={{width:"100%",background:loading?"#1a2a3a":T.navActive,border:`1px solid ${T.blue}44`,borderRadius:10,color:loading?T.textDim:T.blue,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",fontFamily:T.font,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            {!loading&&<svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>}
            {loading?"Accesso in corso...":"Accedi con Microsoft"}
          </button>

          {/* Admin password login — collapsed by default */}
          <div style={{marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <button onClick={()=>{setShowAdmin(v=>!v);setError(null);}}
              style={{background:"transparent",border:"none",color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:T.font,padding:0}}>
              {showAdmin?"▲ Nascondi":"▼ Accesso amministratore"}
            </button>
            {showAdmin&&(
              <form onSubmit={handleAdminLogin} style={{display:"flex",flexDirection:"column",gap:10,marginTop:12}}>
                <input type="email" placeholder="Email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} required style={inp}/>
                <input type="password" placeholder="Password" value={adminPwd} onChange={e=>setAdminPwd(e.target.value)} required style={inp}/>
                <button type="submit" disabled={adminLoading}
                  style={{padding:"10px",background:T.navActive,border:`1px solid ${T.textDim}44`,borderRadius:8,color:T.textSub,cursor:adminLoading?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
                  {adminLoading?"Accesso...":"Accedi"}
                </button>
              </form>
            )}
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:T.textDim}}>FleetCC · Ferrara · v0.2.0</div>
      </div>
    </div>
  );
}

export default LoginScreen;
