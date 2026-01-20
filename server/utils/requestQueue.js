/**
 * Request Queue
 * Manages concurrent request handling with configurable concurrency limit
 */

class RequestQueue {
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
    this.queue = [];
  }

  /**
   * Execute a function with concurrency control
   * @param {Function} fn - Async function to execute
   * @returns {Promise} Result of the function
   */
  async execute(fn) {
    // If under limit, execute immediately
    if (this.activeCount < this.maxConcurrent) {
      return this._executeNow(fn);
    }

    // Otherwise, queue the request
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
    });
  }

  /**
   * Execute function immediately
   * @private
   */
  async _executeNow(fn) {
    this.activeCount++;
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.activeCount--;
      this._processQueue();
    }
  }

  /**
   * Process queued requests
   * @private
   */
  _processQueue() {
    if (this.queue.length === 0 || this.activeCount >= this.maxConcurrent) {
      return;
    }

    const { fn, resolve, reject } = this.queue.shift();
    
    this._executeNow(fn)
      .then(resolve)
      .catch(reject);
  }

  /**
   * Get queue statistics
   * @returns {object} Queue stats
   */
  getStats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    // Reject all queued requests
    this.queue.forEach(({ reject }) => {
      reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

/**
 * Express middleware factory for request queue
 * @param {RequestQueue} queue - Request queue instance
 * @returns {Function} Express middleware
 */
function createQueueMiddleware(queue) {
  return (req, res, next) => {
    // Wrap the route handler execution in queue
    const originalSend = res.send;
    const originalJson = res.json;
    let handled = false;

    // Queue the request processing
    queue.execute(async () => {
      return new Promise((resolve) => {
        // Override response methods to detect completion
        res.send = function(...args) {
          if (!handled) {
            handled = true;
            resolve();
          }
          return originalSend.apply(res, args);
        };

        res.json = function(...args) {
          if (!handled) {
            handled = true;
            resolve();
          }
          return originalJson.apply(res, args);
        };

        // Continue to route handler
        next();
      });
    }).catch((error) => {
      // Queue error (e.g., queue cleared)
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
        });
      }
    });
  };
}

module.exports = RequestQueue;
module.exports.createQueueMiddleware = createQueueMiddleware;
