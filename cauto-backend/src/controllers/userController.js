const userService = require("../services/userService");

const userController = {
  list(req, res, next) {
    try { res.json({ ok: true, data: userService.listUsers(req.user.role, req.tenant.id) }); }
    catch (err) { next(err); }
  },

  create(req, res, next) {
    try {
      const user = userService.createUser(req.body, req.user);
      res.status(201).json({ ok: true, data: user });
    } catch (err) { next(err); }
  },

  update(req, res, next) {
    try {
      const user = userService.updateUser(req.params.id, req.body, req.user);
      res.json({ ok: true, data: user });
    } catch (err) { next(err); }
  },

  deactivate(req, res, next) {
    try {
      userService.deactivateUser(req.params.id, req.user);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = userController;
