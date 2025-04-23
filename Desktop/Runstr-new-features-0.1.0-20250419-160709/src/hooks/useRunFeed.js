import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  initializeNostr, 
  fetchRunningPosts, 
  loadSupplementaryData, 
  processPostsWithData,
  searchRunningContent
} from '../utils/nostr';
import globalFeedState from '../utils/globalFeedState';
import connectionManager from '../utils/nostrConnectionManager';

export const useRunFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLikes, setUserLikes] = useState(new Set());
  const [userReposts, setUserReposts] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadedSupplementaryData, setLoadedSupplementaryData] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(7); // New state for display limit
  const [allPosts, setAllPosts] = useState(globalFeedState.allPosts || []); // Use global cache
  const timeoutRef = useRef(null);
  const initialLoadRef = useRef(globalFeedState.isInitialized);
  const subscriptionRef = useRef(null);

  // Initialize Nostr as soon as the hook is used, even if component isn't visible
  useEffect(() => {
    const initNostr = async () => {
      // Only initialize once
      if (!globalFeedState.isInitialized) {
        // Register with connection manager
        const shouldYield = connectionManager.registerOperation(
          'feed-hook-init',
          'feed',
          null
        );
        
        if (shouldYield) {
          console.log('Feed hook init yielding to higher priority operation');
          // Try again later
          setTimeout(initNostr, 2000);
          return;
        }
        
        await initializeNostr();
        globalFeedState.isInitialized = true;
        connectionManager.removeOperation('feed-hook-init');
      }
    };
    
    initNostr();
  }, []);

  // Background fetch for new posts
  const setupBackgroundFetch = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up a recurring fetch every 60 seconds
    timeoutRef.current = setInterval(async () => {
      console.log('Background fetch: Checking for new posts');
      
      // Check if we should yield to higher priority operations
      const operationId = `feed-background-fetch-${Date.now()}`;
      const shouldYield = connectionManager.registerOperation(
        operationId,
        'feed',
        null
      );
      
      if (shouldYield) {
        console.log('Background feed fetch yielding to higher priority operation');
        connectionManager.removeOperation(operationId);
        return;
      }
      
      try {
        // Only fetch posts that are newer than our most recent post
        const newestPostTime = globalFeedState.allPosts.length > 0 
          ? Math.max(...globalFeedState.allPosts.map(p => p.created_at)) * 1000
          : undefined;
          
        // Only fetch if we haven't fetched in the last 30 seconds
        const now = Date.now();
        if (now - globalFeedState.lastFetchTime < 30000) {
          console.log('Skipping background fetch, last fetch was too recent');
          connectionManager.removeOperation(operationId);
          return;
        }
        
        globalFeedState.lastFetchTime = now;
        
        // Fetch new posts
        const limit = 10; // Fetch just a few new posts
        const runPostsArray = await fetchRunningPosts(limit, newestPostTime);
        
        if (runPostsArray.length === 0) {
          console.log('No new posts found in background fetch');
          connectionManager.removeOperation(operationId);
          return;
        }
        
        console.log(`Background fetch: Found ${runPostsArray.length} new posts`);
        
        // Load supplementary data in parallel
        const supplementaryData = await loadSupplementaryData(runPostsArray);
        
        // Process posts with all the data
        const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
        
        // Update global cache with new posts
        if (processedPosts.length > 0) {
          // Remove duplicates and merge with existing posts
          const existingIds = new Set(globalFeedState.allPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          
          if (newPosts.length > 0) {
            // Update global feed state
            globalFeedState.updatePosts([...newPosts, ...globalFeedState.allPosts]);
            
            // Update local state if component is mounted
            setAllPosts(prevPosts => {
              const mergedPosts = [...newPosts, ...prevPosts];
              return mergedPosts;
            });
            
            // Update displayed posts
            setPosts(prevPosts => {
              // Create merged array with new posts at the top
              const mergedPosts = [...newPosts, ...prevPosts];
              
              // Only display up to the display limit
              return mergedPosts.slice(0, displayLimit);
            });
            
            // Update user interactions
            updateUserInteractions(supplementaryData);
          }
        }
      } catch (error) {
        console.error('Error in background fetch:', error);
        // Don't set error state - this is a background operation
      } finally {
        connectionManager.removeOperation(operationId);
      }
    }, 60000); // Check every minute
    
    // Store reference to cleanup
    subscriptionRef.current = timeoutRef.current;
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [displayLimit]);

  // Extract user interactions logic to reuse
  const updateUserInteractions = useCallback((supplementaryData) => {
    const newUserLikes = new Set([...userLikes]);
    const newUserReposts = new Set([...userReposts]);
    
    supplementaryData.likes?.forEach(like => {
      try {
        if (window.nostr && like.pubkey === window.nostr.getPublicKey()) {
          const postId = like.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) newUserLikes.add(postId);
        }
      } catch (err) {
        console.error('Error processing user likes:', err);
      }
    });
    
    supplementaryData.reposts?.forEach(repost => {
      try {
        if (window.nostr && repost.pubkey === window.nostr.getPublicKey()) {
          const postId = repost.tags.find(tag => tag[0] === 'e')?.[1];
          if (postId) newUserReposts.add(postId);
        }
      } catch (err) {
        console.error('Error processing user reposts:', err);
      }
    });
    
    setUserLikes(newUserLikes);
    setUserReposts(newUserReposts);
  }, [userLikes, userReposts]);

  // Main function to fetch run posts
  const fetchRunPostsViaSubscription = useCallback(async () => {
    try {
      // Register with connection manager
      const operationId = `feed-fetch-posts-${Date.now()}`;
      const shouldYield = connectionManager.registerOperation(
        operationId,
        'feed',
        null
      );
      
      if (shouldYield) {
        console.log('Feed post fetch yielding to higher priority operation, will try again later');
        setTimeout(() => fetchRunPostsViaSubscription(), 1000);
        return;
      }
      
      setLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Check if preloading is in progress
      if (globalFeedState.isPreloading) {
        console.log(`Feed preloading in progress: ${globalFeedState.preloadProgress}%, waiting to complete...`);
        
        // Wait for preloading to finish or timeout after 3 seconds
        await Promise.race([
          new Promise(resolve => {
            const checkInterval = setInterval(() => {
              if (!globalFeedState.isPreloading) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 200);
          }),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      }
      
      // Initialize Nostr first
      await initializeNostr();

      // Check if we have cached posts that are recent enough
      const isCacheValid = globalFeedState.isCacheValid();
                        
      if (isCacheValid) {
        console.log('Using cached posts from global feed state');
        setAllPosts(globalFeedState.allPosts);
        setPosts(globalFeedState.allPosts.slice(0, displayLimit));
        
        // Extract user interactions from cached data
        if (globalFeedState.supplementaryData) {
          // Update likes/reposts from cache
          const newUserLikes = new Set();
          const newUserReposts = new Set();
          
          // Check user's pubkey
          try {
            const userPubkey = window.nostr?.getPublicKey();
            
            if (userPubkey) {
              // Process cached likes/reposts that belong to the user
              globalFeedState.supplementaryData.likes.forEach(postId => {
                newUserLikes.add(postId);
              });
              
              globalFeedState.supplementaryData.reposts.forEach(postId => {
                newUserReposts.add(postId);
              });
              
              setUserLikes(newUserLikes);
              setUserReposts(newUserReposts);
            }
          } catch (err) {
            console.error('Error extracting user interactions from cache:', err);
          }
        }
        
        setLoading(false);
        
        // Start background update with lower priority
        setupBackgroundFetch();
        connectionManager.removeOperation(operationId);
        return;
      }

      // Set timestamp for paginated loading
      const since = page > 1 ? Date.now() - (page * 7 * 24 * 60 * 60 * 1000) : undefined;
      const limit = 21; // Load 21 posts initially (3 pages worth)

      // Fetch posts with running hashtags
      const runPostsArray = await fetchRunningPosts(limit, since);
      
      console.log(`Fetched ${runPostsArray.length} running posts`);
      
      // If we got no results with tags, try a content search as fallback
      if (runPostsArray.length === 0 && page === 1) {
        console.log('No tagged running posts found, trying content search');
        const contentPosts = await searchRunningContent(limit, 72); // 72 hours
        
        if (contentPosts.length > 0) {
          console.log(`Found ${contentPosts.length} posts through content search`);
          
          // Load supplementary data in parallel for all posts
          const supplementaryData = await loadSupplementaryData(contentPosts);
          
          // Process posts with all the data
          const processedPosts = await processPostsWithData(contentPosts, supplementaryData);
          
          // Update global cache
          globalFeedState.updatePosts(processedPosts);
          globalFeedState.updateSupplementaryData(supplementaryData);
          
          // Update state with all processed posts, but only display up to the limit
          setAllPosts(processedPosts);
          setPosts(processedPosts.slice(0, displayLimit));
          
          // Update user interactions
          updateUserInteractions(supplementaryData);
          
          setHasMore(contentPosts.length >= limit);
          setLoading(false);
          initialLoadRef.current = true;
          
          // Set up background fetch
          setupBackgroundFetch();
          connectionManager.removeOperation(operationId);
          return;
        }
      }
      
      // If we didn't get enough posts, there may not be more to load
      if (runPostsArray.length < limit) {
        setHasMore(false);
      }
      
      // Skip processing if we didn't get any posts
      if (runPostsArray.length === 0) {
        if (page === 1) {
          setPosts([]);
          setAllPosts([]);
          setError('No running posts found. Try again later.');
        }
        setLoading(false);
        connectionManager.removeOperation(operationId);
        return;
      }
      
      // Load supplementary data in parallel for all posts
      const supplementaryData = await loadSupplementaryData(runPostsArray);
      
      // Process posts with all the data
      const processedPosts = await processPostsWithData(runPostsArray, supplementaryData);
      
      // Update global cache
      globalFeedState.updatePosts(processedPosts);
      globalFeedState.updateSupplementaryData(supplementaryData);
      
      // Update state with processed posts
      if (page === 1) {
        setAllPosts(processedPosts);
        setPosts(processedPosts.slice(0, displayLimit)); // Only display up to the limit
      } else {
        // For pagination, append new posts, removing duplicates
        setAllPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = processedPosts.filter(p => !existingIds.has(p.id));
          const mergedPosts = [...prevPosts, ...newPosts];
          
          // Update global cache
          globalFeedState.updatePosts(mergedPosts);
          
          return mergedPosts;
        });
        // Update displayed posts
        setPosts(prevPosts => {
          const allPostsCombined = [...prevPosts, ...processedPosts];
          const uniquePosts = [];
          const seen = new Set();
          
          // Remove duplicates
          allPostsCombined.forEach(post => {
            if (!seen.has(post.id)) {
              seen.add(post.id);
              uniquePosts.push(post);
            }
          });
          
          return uniquePosts.slice(0, displayLimit); // Only display up to the limit
        });
      }
      
      // Update user interactions
      updateUserInteractions(supplementaryData);
      
      initialLoadRef.current = true;
      
      // Set up background fetch
      setupBackgroundFetch();
    } catch (err) {
      console.error('Error fetching running posts:', err);
      setError(`Failed to load posts: ${err.message}`);
    } finally {
      setLoading(false);
      connectionManager.removeOperation(`feed-fetch-posts-${Date.now()}`);
    }
  }, [page, displayLimit, updateUserInteractions, setupBackgroundFetch]);

  // Load more posts function - increases the display limit
  const loadMorePosts = useCallback(() => {
    setDisplayLimit(prevLimit => prevLimit + 7); // Increase display limit by 7
  }, []);

  // Check if we can load more posts
  const canLoadMore = useCallback(() => {
    return allPosts.length > displayLimit;
  }, [allPosts.length, displayLimit]);

  // Load next page of posts from the network
  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  }, [loading, hasMore]);

  // Initial load
  useEffect(() => {
    // If we have preloaded data, use it immediately
    if (globalFeedState.allPosts.length > 0 && globalFeedState.isCacheValid()) {
      setAllPosts(globalFeedState.allPosts);
      setPosts(globalFeedState.allPosts.slice(0, displayLimit));
      setLoading(false);
      // Still do a background update for freshness
      setupBackgroundFetch();
    }
    // Otherwise, if not already initialized, fetch data
    else if (!initialLoadRef.current) {
      fetchRunPostsViaSubscription();
    }
    
    // Cleanup function when component unmounts
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [fetchRunPostsViaSubscription, displayLimit, setupBackgroundFetch]);

  // Update displayed posts when displayLimit changes
  useEffect(() => {
    if (allPosts.length > 0) {
      setPosts(allPosts.slice(0, displayLimit));
    }
    
    // If we're showing all available posts but there might be more on the server
    if (allPosts.length <= displayLimit && hasMore && !loading) {
      loadNextPage();
    }
  }, [displayLimit, allPosts, hasMore, loading, loadNextPage]);

  // Handle comment click to toggle comment visibility
  const handleCommentClick = async (postId) => {
    setPosts(prevPosts => {
      return prevPosts.map(post => {
        if (post.id === postId) {
          // If comments aren't loaded yet, load them first
          if (!post.commentsLoaded) {
            // This would be implemented to fetch comments from Nostr
            console.log('Loading comments for post', postId);
            
            // In a real implementation, you would fetch comments here
            loadSupplementaryData([postId], 'comments')
              .then(commentData => {
                // Mark this post as having had its supplementary data loaded
                setLoadedSupplementaryData(prev => new Set([...prev, postId]));
                
                // Update posts with the loaded comments
                setPosts(latestPosts => {
                  return latestPosts.map(p => {
                    if (p.id === postId) {
                      // Mark comments as loaded and add fetched comments
                      return { 
                        ...p, 
                        commentsLoaded: true,
                        // Use the comment data from the response, or fallback to existing comments
                        comments: commentData?.[postId] || p.comments || []
                      };
                    }
                    return p;
                  });
                });
              });
          }
          
          // Toggle comment visibility
          return { ...post, showComments: !post.showComments };
        }
        return post;
      });
    });
    
    // Return a promise that resolves when comments are loaded
    return new Promise(resolve => {
      // In a real implementation, this would resolve when comments are fetched
      setTimeout(resolve, 1500);
    });
  };

  return {
    posts,
    setPosts,
    loading,
    error,
    userLikes,
    setUserLikes,
    userReposts,
    setUserReposts,
    loadSupplementaryData,
    loadMorePosts,
    fetchRunPostsViaSubscription,
    loadedSupplementaryData,
    canLoadMore,
    handleCommentClick
  };
}; 