const store = require("../data/bugs");

const bugRepository = {
  findAll:      ()            => store.getAll(),
  create:       (data)        => store.create(data),
  updateStatus: (id, status)  => store.updateStatus(id, status) || null,
};

module.exports = bugRepository;
