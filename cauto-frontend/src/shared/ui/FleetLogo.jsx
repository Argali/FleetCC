import React from "react";

function FleetLogo({size=36}){
  const uid=React.useId().replace(/:/g,"");
  const id=`grad-${uid}`;
  return(
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
      <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill={`url(#${id})`}/>
      <circle cx="58" cy="34" r="12" fill="white"/>
      <circle cx="58" cy="34" r="5" fill={`url(#${id})`}/>
      <line x1="58" y1="46" x2="58" y2="56" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="36" cy="52" r="6" fill="white"/>
      <path d="M30 64 Q36 58 42 64" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M18,82 Q50,64 82,74" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export default FleetLogo;
