import React from "react";
import T from "@/theme";

function ApiError({ error, onRetry }) {
  return (
    <div style={{
      background: `${T.red}11`,
      border: `1px solid ${T.red}44`,
      borderRadius: 10,
      padding: "16px 20px",
      color: T.red,
      fontSize: 13,
      fontFamily: T.font,
      animation: "fadeIn 200ms ease-out, shake 400ms ease-out",
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Errore API</div>
      <div style={{ fontSize: 11, color: T.textSub, marginBottom: 10 }}>{error}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: `${T.red}22`,
            border: `1px solid ${T.red}44`,
            borderRadius: 6,
            color: T.red,
            padding: "5px 12px",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: T.font,
          }}
        >
          Riprova
        </button>
      )}
    </div>
  );
}

export default ApiError;
