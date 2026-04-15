import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import App from "./App.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hide the pre-React loading screen after first paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (typeof window.__fcHideLoader === "function") window.__fcHideLoader();
  });
});
