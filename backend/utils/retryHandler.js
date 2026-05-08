/**
 * Retry Handler - Implements exponential backoff for failed operations
 * Used for database operations, API calls, and email sending
 */

import logger from './logger.js';

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the operation
 */
export const retryWithBackoff = async (operation, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        logger.error(`Operation failed after ${maxRetries} retries`, {
          error: error.message,
          lastAttempt: attempt
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      const actualDelay = delay + jitter;

      logger.warn(`Operation failed, retrying in ${Math.round(actualDelay)}ms`, {
        attempt,
        maxRetries,
        error: error.message
      });

      if (onRetry) {
        onRetry(attempt, error, actualDelay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError;
};

/**
 * Retry database operations
 */
export const retryDatabaseOperation = async (operation, operationName = 'Database operation') => {
  return retryWithBackoff(operation, {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    onRetry: (attempt, error, delay) => {
      logger.warn(`${operationName} failed, retrying...`, {
        attempt,
        error: error.message,
        nextRetryIn: Math.round(delay)
      });
    }
  });
};

/**
 * Retry email sending
 */
export const retryEmailSending = async (operation, recipientEmail = 'unknown') => {
  return retryWithBackoff(operation, {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    onRetry: (attempt, error, delay) => {
      logger.warn(`Email sending failed for ${recipientEmail}, retrying...`, {
        attempt,
        error: error.message,
        nextRetryIn: Math.round(delay)
      });
    }
  });
};

/**
 * Retry API calls
 */
export const retryApiCall = async (operation, endpoint = 'unknown') => {
  return retryWithBackoff(operation, {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    onRetry: (attempt, error, delay) => {
      logger.warn(`API call to ${endpoint} failed, retrying...`, {
        attempt,
        error: error.message,
        nextRetryIn: Math.round(delay)
      });
    }
  });
};

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  constructor(operation, options = {}) {
    this.operation = operation;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await this.operation(...args);

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info('Circuit breaker reset to CLOSED state');
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        logger.error('Circuit breaker opened due to repeated failures', {
          failureCount: this.failureCount,
          threshold: this.failureThreshold
        });
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export default {
  retryWithBackoff,
  retryDatabaseOperation,
  retryEmailSending,
  retryApiCall,
  CircuitBreaker
};
