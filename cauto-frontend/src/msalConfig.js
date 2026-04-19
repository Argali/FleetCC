import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId:    "3c3b2922-0d6c-4f87-a769-55607b3e981e",
    authority:   "https://login.microsoftonline.com/65e803c0-672a-4162-85a7-e1a402843bd2",
    // Strip trailing slash so the URI matches exactly what's registered in Azure
    redirectUri: (window.location.origin + (import.meta.env.BASE_URL || "/")).replace(/\/$/, ""),
  },
  cache: {
    cacheLocation:          "sessionStorage",
    storeAuthStateInCookie: true, // Firefox ETP fix — cookie fallback when sessionStorage is blocked
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
// Initialized lazily in AppInner before first use — no top-level await
