import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId:    "e8585fda-9c50-4dcc-be6d-cd1ac2a9bc22",
    authority:   "https://login.microsoftonline.com/common",
    // Strip trailing slash so the URI matches exactly what's registered in Azure
    redirectUri: (window.location.origin + (import.meta.env.BASE_URL || "/")).replace(/\/$/, ""),
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
// Initialized lazily in AppInner before first use — no top-level await
