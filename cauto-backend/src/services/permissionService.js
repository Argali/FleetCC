const { AppError } = require("../middleware/errorHandler");
const permRepo     = require("../repositories/permissionRepository");

const permissionService = {
  getMatrix(userRole) {
    const matrix = permRepo.getMatrix();
    return {
      matrix,
      roles:     permRepo.ROLES,
      modules:   permRepo.MODULES,
      levels:    permRepo.LEVELS,
      my_access: matrix[userRole] || {},
    };
  },

  setMatrix(matrix) {
    if (!matrix) throw new AppError("Campo 'matrix' richiesto", 400);
    permRepo.setMatrix(matrix); // throws AppError-compatible on bad input
  },
};

module.exports = permissionService;
