/**
 * globalFeedState.js
 * 
 * Global state object for feed data to persist between components and app sessions
 * Enables preloading feeds and caching data to improve performance
 */

// Global state for feed data
const globalFeedState = {
  // Posts and metadata
  allPosts: [],
  lastFetchTime: 0,
  isInitialized: false,
  activeSubscription: null,
  
  // Supplementary data maps
  supplementaryData: {
    profiles: new Map(),
    likes: new Set(),
    reposts: new Set(),
    comments: new Map(), // Map of post ID to comment count
    zaps: new Map(), // Map of post ID to zap totals
  },
  
  // Preloading state
  isPreloading: false,
  preloadProgress: 0,
  
  // Configuration 
  cacheValidityMinutes: 10, // How long the cache is valid
  
  /**
   * Check if the cached feed data is still valid
   * @returns {boolean} - Whether the cache is valid
   */
  isCacheValid() {
    const now = Date.now();
    return this.allPosts.length > 0 && 
           (now - this.lastFetchTime < this.cacheValidityMinutes * 60 * 1000);
  },
  
  /**
   * Store fetched posts in the global state
   * @param {Array} posts - Posts to store
   */
  updatePosts(posts) {
    if (posts && posts.length > 0) {
      this.allPosts = posts;
      this.lastFetchTime = Date.now();
    }
  },
  
  /**
   * Store supplementary data in the global state
   * @param {Object} data - Supplementary data object
   */
  updateSupplementaryData(data) {
    if (!data) return;
    
    // Process profiles
    if (data.profileEvents) {
      data.profileEvents.forEach(event => {
        try {
          const content = JSON.parse(event.content);
          this.supplementaryData.profiles.set(event.pubkey, {
            ...content,
            name: content.name || content.display_name || event.pubkey.slice(0, 8) + '...'
          });
        } catch (err) {
          console.error('Error parsing profile:', err);
        }
      });
    }
    
    // Process likes
    if (data.likes) {
      data.likes.forEach(event => {
        const tags = event.tags || [];
        const eventTag = tags.find(tag => tag[0] === 'e');
        if (eventTag && eventTag[1]) {
          this.supplementaryData.likes.add(eventTag[1]);
        }
      });
    }
    
    // Process reposts
    if (data.reposts) {
      data.reposts.forEach(event => {
        const tags = event.tags || [];
        const eventTag = tags.find(tag => tag[0] === 'e');
        if (eventTag && eventTag[1]) {
          this.supplementaryData.reposts.add(eventTag[1]);
        }
      });
    }
    
    // Process comments (count per post)
    if (data.comments) {
      data.comments.forEach(event => {
        const tags = event.tags || [];
        const rootTag = tags.find(tag => tag[0] === 'e' && (tag[3] === 'root' || !tag[3]));
        
        if (rootTag && rootTag[1]) {
          const postId = rootTag[1];
          const currentCount = this.supplementaryData.comments.get(postId) || 0;
          this.supplementaryData.comments.set(postId, currentCount + 1);
        }
      });
    }
    
    // Process zaps (total per post)
    if (data.zapReceipts) {
      data.zapReceipts.forEach(event => {
        try {
          const tags = event.tags || [];
          const descriptionTag = tags.find(tag => tag[0] === 'description');
          
          if (descriptionTag && descriptionTag[1]) {
            const zapRequest = JSON.parse(descriptionTag[1]);
            const zapTags = zapRequest.tags || [];
            const eventTag = zapTags.find(tag => tag[0] === 'e');
            
            if (eventTag && eventTag[1]) {
              const postId = eventTag[1];
              const amountTag = tags.find(tag => tag[0] === 'amount');
              const amount = amountTag && amountTag[1] ? parseInt(amountTag[1]) : 0;
              
              const currentTotal = this.supplementaryData.zaps.get(postId) || 0;
              this.supplementaryData.zaps.set(postId, currentTotal + amount);
            }
          }
        } catch (err) {
          console.error('Error processing zap receipt:', err);
        }
      });
    }
  },
  
  /**
   * Reset the cache to force a fresh fetch
   */
  invalidateCache() {
    this.lastFetchTime = 0;
  },
  
  /**
   * Clear all data (used when logging out)
   */
  clearAll() {
    this.allPosts = [];
    this.lastFetchTime = 0;
    this.isInitialized = false;
    this.activeSubscription = null;
    this.isPreloading = false;
    this.preloadProgress = 0;
    
    // Clear all supplementary data
    this.supplementaryData.profiles = new Map();
    this.supplementaryData.likes = new Set();
    this.supplementaryData.reposts = new Set();
    this.supplementaryData.comments = new Map();
    this.supplementaryData.zaps = new Map();
  }
};

export default globalFeedState; 