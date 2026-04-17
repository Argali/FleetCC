export function distanceM([lat1, lon1], [lat2, lon2]) {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function fmtDist(km) {
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function fmtTime(s) {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export const NAV_ARROW = { 1:"↑", 2:"↗", 3:"↖", 4:"↑", 5:"↗", 6:"→", 7:"↪", 8:"⤾", 9:"⤿", 10:"↩", 11:"←", 12:"↙", 13:"↗", 14:"↗", 15:"↑", 23:"⬤", 24:"⬤" };

export function formatSegDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function extractComune(address) {
  if (!address) return null;
  const skip = /^(\d{5}|Italia|Province|Provincia|Città metropolitana|Comunità|Regione)/i;
  const parts = address.split(", ");
  const candidates = parts.slice(1).filter(p => !skip.test(p) && !/^\d+[a-zA-Z]?$/.test(p));
  return candidates[0] || null;
}

export async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "FleetCC/1.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    const parts = [
      a.road || a.pedestrian || a.path,
      a.house_number,
      a.town || a.city || a.village || a.municipality,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : d.display_name?.split(",")[0] || null;
  } catch {
    return null;
  }
}
