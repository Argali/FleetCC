import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId:    "e8585fda-9c50-4dcc-be6d-cd1ac2a9bc22",
    authority:   "https://login.microsoftonline.com/common",
    // BASE_URL is injected by Vite from the `base` config (e.g. /fleetcc/)
    redirectUri: window.location.origin + (import.meta.env.BASE_URL || "/"),
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
await msalInstance.initialize();
