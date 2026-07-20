/**
 * Build standardised pagination metadata.
 * @param {number} total    - Total matching documents
 * @param {number} page     - Current page (1-based)
 * @param {number} limit    - Items per page
 */
const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPrevPage: page > 1,
});

/**
 * Parse and validate pagination query params.
 * Returns safe integer values with upper-bound enforcement.
 */
const parsePagination = (query, maxLimit = 100) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build a MongoDB sort object from query string.
 * e.g. ?sort=-createdAt,name → { createdAt: -1, name: 1 }
 * Defaults to { createdAt: -1 } if not provided.
 */
const buildSortObject = (sortQuery, defaultSort = { createdAt: -1 }) => {
  if (!sortQuery) return defaultSort;
  const sort = {};
  sortQuery.split(",").forEach((field) => {
    const trimmed = field.trim();
    if (trimmed.startsWith("-")) {
      sort[trimmed.substring(1)] = -1;
    } else {
      sort[trimmed] = 1;
    }
  });
  return Object.keys(sort).length ? sort : defaultSort;
};

/**
 * Build a safe date range filter for MongoDB queries.
 * Returns undefined if neither from nor to is provided.
 */
const buildDateRangeFilter = (from, to) => {
  if (!from && !to) return undefined;
  const filter = {};
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate)) filter.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate)) filter.$lte = toDate;
  }
  return Object.keys(filter).length ? filter : undefined;
};

/**
 * Escape special regex characters to prevent ReDoS attacks.
 * Always use this when building regex from user input.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build a case-insensitive search regex filter.
 * Applies escapeRegex to prevent ReDoS.
 */
const buildSearchFilter = (searchTerm, fields) => {
  if (!searchTerm?.trim()) return {};
  const regex = new RegExp(escapeRegex(searchTerm.trim()), "i");
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

module.exports = {
  buildPaginationMeta,
  parsePagination,
  buildSortObject,
  buildDateRangeFilter,
  escapeRegex,
  buildSearchFilter,
};