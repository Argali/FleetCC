import React from "react";
import T from "@/theme";
import FleetLogo from "@/shared/ui/FleetLogo";

export default function ModuleSpinner() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 200,
      gap: 10,
      color: T.textSub,
      fontSize: 13,
      fontFamily: T.font,
      animation: "fadeIn 200ms ease-out 120ms both",
    }}>
      <FleetLogo size={20} />
      <span>Caricamento...</span>
    </div>
  );
}
