/**
 * nostrConnectionManager.js
 * 
 * Centralized manager for coordinating Nostr operations with priority handling
 * to ensure critical operations like auth and team messaging aren't interrupted
 * by lower-priority tasks like feed loading.
 */

// Operation priority order (lower index = higher priority)
const PRIORITY_ORDER = ["auth", "teams", "posting", "feed"];

class NostrConnectionManager {
  constructor() {
    this.activeOperations = new Map();
  }

  /**
   * Register a new Nostr operation
   * @param {string} id - Unique identifier for this operation
   * @param {string} type - Type of operation ('auth', 'teams', 'posting', 'feed')
   * @param {Function} yieldCallback - Function to call if operation should yield
   * @returns {boolean} - Whether this operation should yield to a higher priority one
   */
  registerOperation(id, type, yieldCallback) {
    this.activeOperations.set(id, { 
      type, 
      yieldCallback, 
      timestamp: Date.now() 
    });
    
    return this.shouldYield(id, type);
  }

  /**
   * Remove an operation when it's complete
   * @param {string} id - Operation ID to remove
   */
  removeOperation(id) {
    this.activeOperations.delete(id);
  }

  /**
   * Check if an operation should yield to a higher priority one
   * @param {string} id - Operation ID to check
   * @param {string} type - Operation type
   * @returns {boolean} - Whether the operation should yield
   */
  shouldYield(id, type) {
    const currentPriority = PRIORITY_ORDER.indexOf(type);
    
    // If type isn't in the priority list, default to lowest priority
    if (currentPriority === -1) return true;
    
    for (const [opId, op] of this.activeOperations.entries()) {
      if (opId !== id) {
        const otherPriority = PRIORITY_ORDER.indexOf(op.type);
        
        // If the other operation has higher priority
        if (otherPriority !== -1 && otherPriority < currentPriority) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get a list of all active operations
   * @returns {Array} - Array of operation details
   */
  getActiveOperations() {
    return Array.from(this.activeOperations.entries()).map(([id, details]) => ({
      id,
      type: details.type,
      timestamp: details.timestamp,
      age: Date.now() - details.timestamp
    }));
  }

  /**
   * Check if there are any active operations of a specific type
   * @param {string} type - Type to check for
   * @returns {boolean} - Whether there are active operations of this type
   */
  hasActiveOperationsOfType(type) {
    for (const op of this.activeOperations.values()) {
      if (op.type === type) return true;
    }
    return false;
  }
}

// Singleton instance
const connectionManager = new NostrConnectionManager();
export default connectionManager; 