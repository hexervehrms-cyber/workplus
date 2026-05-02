/**
 * Standardized API Response Wrapper
 * Ensures all API responses follow consistent format
 */

export class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

/**
 * Send standardized success response
 */
export const sendSuccess = (res, data = null, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data || [],
    timestamp: new Date().toISOString()
  });
};

/**
 * Send standardized error response
 */
export const sendError = (res, message = "Error", statusCode = 500, code = "ERROR", data = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    data: data || [],
    timestamp: new Date().toISOString()
  });
};

/**
 * Send paginated response
 */
export const sendPaginated = (res, data = [], total = 0, page = 1, limit = 10, message = "Success") => {
  const pages = Math.ceil(total / limit);
  
  return res.status(200).json({
    success: true,
    message,
    data: Array.isArray(data) ? data : [],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages
    },
    timestamp: new Date().toISOString()
  });
};

export default {
  ApiResponse,
  sendSuccess,
  sendError,
  sendPaginated
};
