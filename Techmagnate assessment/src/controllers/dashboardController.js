const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboardService');

/**
 * Tech Magnate Assessment — Module 3 dashboard controller.
 * GET /api/dashboard/tasks
 *
 * Query params:
 *   page, limit, search, status, priority, language, location,
 *   sortBy, sortOrder, columns
 */
const listTasks = asyncHandler(async (req, res) => {
  const result = await dashboardService.listTasks(req.query);

  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

const getTask = asyncHandler(async (req, res) => {
  const task = await dashboardService.getById(req.params.id);

  res.json({
    success: true,
    data: task,
  });
});

module.exports = { listTasks, getTask };
