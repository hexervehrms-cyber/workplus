/**
 * Pagination Middleware
 * Provides consistent pagination across all list endpoints
 * Prevents memory exhaustion from large collections
 */

export const paginationDefaults = {
  page: 1,
  limit: 50,
  maxLimit: 500
};

/**
 * Parse and validate pagination parameters from request
 * @param {Object} req - Express request object
 * @returns {Object} Validated pagination params
 */
export const parsePaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || paginationDefaults.page);
  const limit = Math.min(
    paginationDefaults.maxLimit,
    Math.max(1, parseInt(req.query.limit) || paginationDefaults.limit)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build pagination metadata for response
 * @param {number} total - Total count of documents
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

/**
 * Middleware to attach pagination helpers to request
 */
export const paginationMiddleware = (req, res, next) => {
  req.pagination = parsePaginationParams(req);
  
  // Helper function to send paginated response
  res.paginate = (data, total) => {
    const meta = buildPaginationMeta(total, req.pagination.page, req.pagination.limit);
    
    return res.json({
      success: true,
      data,
      pagination: meta
    });
  };

  next();
};

/**
 * Apply pagination to Mongoose query
 * @param {Query} query - Mongoose query object
 * @param {Object} pagination - Pagination params from parsePaginationParams
 * @returns {Query} Query with pagination applied
 */
export const applyPagination = (query, pagination) => {
  return query.skip(pagination.skip).limit(pagination.limit);
};

export default paginationMiddleware;
