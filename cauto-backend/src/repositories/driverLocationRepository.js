const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Map<userId, { lat, lng, name, userId, timestamp }>
const store = new Map();

const driverLocationRepository = {
  set(userId, data) {
    store.set(userId, { ...data, timestamp: Date.now() });
  },

  delete(userId) {
    store.delete(userId);
  },

  findAllActive(excludeUserId = null) {
    const now = Date.now();
    const result = [];
    for (const [id, loc] of store.entries()) {
      if (now - loc.timestamp < TTL_MS && id !== excludeUserId) {
        result.push({ lat: loc.lat, lng: loc.lng, name: loc.name, userId: loc.userId });
      }
    }
    return result;
  },
};

module.exports = driverLocationRepository;
