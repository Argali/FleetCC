const { randomUUID } = require("crypto");

let bugs = [];

module.exports = {
  getAll: () => [...bugs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  create: (data) => {
    const bug = {
      id: randomUUID(),
      ...data,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    bugs.push(bug);
    return bug;
  },
  updateStatus: (id, status) => {
    const idx = bugs.findIndex(b => b.id === id);
    if (idx === -1) return null;
    bugs[idx] = { ...bugs[idx], status, updatedAt: new Date().toISOString() };
    return bugs[idx];
  },
};
