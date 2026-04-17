import { useState, useCallback, useRef, useEffect } from "react";

export function useGeolocation() {
  const [pos, setPos] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const watchRef = useRef(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocalizzazione non supportata dal browser");
      return;
    }
    setGeoError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      p => setPos([p.coords.latitude, p.coords.longitude]),
      e => setGeoError(e.code === 1 ? "Permesso negato" : e.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }, []);

  const stop = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setPos(null);
    setGeoError(null);
  }, []);

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  return { pos, geoError, start, stop };
}
