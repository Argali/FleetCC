export const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
export const BASE_URL = API.replace(/\/api$/, "");
