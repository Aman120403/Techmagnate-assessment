const Task = require('../models/Task');
const {
  SORTABLE_FIELDS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../config/constants');
const ApiError = require('../utils/ApiError');

/**
 * Tech Magnate Assessment — dashboard queries.
 * Filtering / sorting / pagination all happen server-side.
 */
class DashboardService {
  //Creates a service method that receives all query parameters.
  async listTasks(query) {
    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      search,
      status,
      priority,
      language,
      location,
      sortBy = 'created_at',
      sortOrder = 'desc',
      columns,
    } = query;

    const pageNum = Math.max(1, Number(page) || DEFAULT_PAGE);
    let limitNum = Math.max(1, Number(limit) || DEFAULT_LIMIT);
    if (limitNum > MAX_LIMIT) limitNum = MAX_LIMIT;

    const filter = this.#buildFilter({ search, status, priority, language, location });
    const sort = this.#buildSort(sortBy, sortOrder);
    const projection = this.#buildProjection(columns);

    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Task.find(filter, projection).sort(sort).skip(skip).limit(limitNum).lean(),
      Task.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasNext: skip + items.length < total,
        hasPrev: pageNum > 1,
      },
    };
  }

  async getById(id) {
    const task = await Task.findById(id).lean();
    if (!task) {
      throw new ApiError(404, 'Task not found');
    }
    return task;
  }
//This defines a private method(#)
  #buildFilter({ search, status, priority, language, location }) {
    const filter = {};

    if (search && String(search).trim()) {
      const q = String(search).trim();
      // Prefer text index when available; regex fallback covers task_id / partials
      filter.$or = [
        { keyword: { $regex: escapeRegex(q), $options: 'i' } },//$options: 'i'means - Case-insensitive
        { task_id: { $regex: escapeRegex(q), $options: 'i' } },//escapeRegex() converts special characters(.) into literals so the search behaves as users expect.
        { language_code: { $regex: escapeRegex(q), $options: 'i' } },
      ];
    }

    if (status) {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) filter.status = statuses[0];
      else if (statuses.length > 1) filter.status = { $in: statuses };
    }

    if (priority !== undefined && priority !== null && priority !== '') {
      filter.priority = Number(priority);
    }

    if (language) {
      filter.language_code = String(language).toLowerCase().trim();
    }

    if (location !== undefined && location !== null && location !== '') {
      filter.location_code = Number(location);
    }

    return filter;
  }

  #buildSort(sortBy, sortOrder) {
    const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'created_at';
    const dir = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    return { [field]: dir };
  }

  /**
   * Column visibility — client sends ?columns=task_id,keyword,status
   * Always keep _id so the UI can key rows.
   */
  #buildProjection(columns) {
    if (!columns) return undefined;

    const list = String(columns)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);//Removes empty values.

    if (!list.length) return undefined;

    const projection = { _id: 1 };
    list.forEach((col) => {
      projection[col] = 1;
    });
    return projection;
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = new DashboardService();
