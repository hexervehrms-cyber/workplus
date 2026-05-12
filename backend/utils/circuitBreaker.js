/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests to failing services
 * Automatically recovers when service becomes healthy
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();

    // Configuration
    this.failureThreshold = options.failureThreshold || 5; // Open after 5 failures
    this.successThreshold = options.successThreshold || 2; // Close after 2 successes in HALF_OPEN
    this.timeout = options.timeout || 60000; // 60 seconds before trying again
    this.name = options.name || 'CircuitBreaker';
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`⚡ [${this.name}] Circuit breaker entering HALF_OPEN state`);
      } else {
        // Circuit is open, use fallback
        if (fallback) {
          console.log(`⚡ [${this.name}] Circuit breaker OPEN, using fallback`);
          return fallback();
        }
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        console.log(`⚡ [${this.name}] Request failed, using fallback`);
        return fallback();
      }
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        this.lastStateChangeTime = Date.now();
        console.log(`✅ [${this.name}] Circuit breaker CLOSED - service recovered`);
      }
    }
  }

  /**
   * Record failed execution
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.lastStateChangeTime = Date.now();
      console.log(`❌ [${this.name}] Circuit breaker OPEN - service still failing`);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChangeTime = Date.now();
      console.log(`❌ [${this.name}] Circuit breaker OPEN - too many failures`);
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChangeTime: this.lastStateChangeTime,
      timeUntilRetry: this.state === 'OPEN' 
        ? Math.max(0, this.timeout - (Date.now() - this.lastFailureTime))
        : 0
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();
    console.log(`🔄 [${this.name}] Circuit breaker reset`);
  }
}

// Create circuit breakers for critical endpoints
export const dashboardStatsBreaker = new CircuitBreaker({
  name: 'DashboardStats',
  failureThreshold: 3,
  timeout: 30000
});

export const dashboardQuickStatsBreaker = new CircuitBreaker({
  name: 'DashboardQuickStats',
  failureThreshold: 3,
  timeout: 30000
});

export const attendanceBreaker = new CircuitBreaker({
  name: 'Attendance',
  failureThreshold: 5,
  timeout: 60000
});

export const leaveBreaker = new CircuitBreaker({
  name: 'Leave',
  failureThreshold: 5,
  timeout: 60000
});

export const expenseBreaker = new CircuitBreaker({
  name: 'Expense',
  failureThreshold: 5,
  timeout: 60000
});

export default CircuitBreaker;
