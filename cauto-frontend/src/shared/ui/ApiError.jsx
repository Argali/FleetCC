import React from "react";
import T from "@/theme";

function ApiError({error,onRetry}){return<div style={{background:"#1a0a0a",border:"1px solid #4a1a1a",borderRadius:10,padding:"16px 20px",color:T.red,fontSize:13,fontFamily:T.font}}><div style={{fontWeight:600,marginBottom:4}}>Errore API</div><div style={{fontSize:11,color:"#7a3a3a",marginBottom:10}}>{error}</div>{onRetry&&<button onClick={onRetry} style={{background:"#2a0a0a",border:"1px solid #4a1a1a",borderRadius:6,color:T.red,padding:"5px 12px",cursor:"pointer",fontSize:12}}>Riprova</button>}</div>;}

export default ApiError;
