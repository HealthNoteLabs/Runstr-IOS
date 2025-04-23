import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from './PostList';
import { RunFeedLoading } from './RunFeedLoading';
import { handleAppBackground } from '../utils/nostr';
import globalFeedState from '../utils/globalFeedState';
import './RunClub.css';

const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use the custom hooks
  const {
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
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    handleLike,
    handleRepost,
    handleZap,
    handleComment
  } = usePostInteractions({
    posts,
    setPosts,
    setUserLikes,
    setUserReposts,
    loadSupplementaryData,
    loadedSupplementaryData,
    defaultZapAmount
  });

  // Handle app lifecycle events for Android
  useEffect(() => {
    // Cleanup function for when component unmounts
    return () => {
      // Close any active connections when component unmounts
      handleAppBackground();
    };
  }, []);

  // Simple diagnostic function to test connectivity
  const diagnoseConnection = async () => {
    setDiagnosticInfo('Testing connection to Nostr relays...');
    try {
      // Import the diagnose function
      const { diagnoseConnection } = await import('../utils/nostr');
      
      // Run the comprehensive diagnostic
      const results = await diagnoseConnection();
      
      if (results.error) {
        setDiagnosticInfo(`Connection error: ${results.error}`);
        return;
      }
      
      if (results.generalEvents > 0) {
        // We can at least connect and fetch some posts
        setDiagnosticInfo(`Connection successful! Fetched ${results.generalEvents} general posts.`);
        
        if (results.runningEvents > 0) {
          // We found running-specific posts too
          setDiagnosticInfo(`Success! Found ${results.runningEvents} running-related posts. Refreshing feed...`);
          refreshFeed();
        } else {
          // Connected but no running posts
          setDiagnosticInfo('Connected to relays and found general posts, but no running posts found.');
        }
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setDiagnosticInfo(`Diagnostic error: ${error.message}`);
    }
  };

  // Function to handle feed refresh with visual feedback
  const refreshFeed = async () => {
    if (loading) return; // Prevent multiple refreshes
    
    setIsRefreshing(true);
    await fetchRunPostsViaSubscription();
    
    // Reset refresh state after a short delay to show animation
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Toggle debug overlay visibility
  const toggleDebug = () => {
    setShowDebug(prev => !prev);
  };
  
  // Check if the feed is being preloaded
  const isPreloading = globalFeedState.isPreloading;
  
  return (
    <div className="run-club-container">
      <button 
        className={`feed-header-button ${isRefreshing ? 'refreshing' : ''}`}
        onClick={refreshFeed}
        disabled={loading || isPreloading}
        aria-label="Refresh RUNSTR feed"
      >
        <h2>RUNSTR FEED</h2>
        {isRefreshing && (
          <span className="refresh-indicator">⟳</span>
        )}
      </button>
      
      {(loading && posts.length === 0) || isPreloading ? (
        <RunFeedLoading showDetailedProgress={isPreloading} />
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <div className="error-buttons">
            <button 
              className="retry-button" 
              onClick={refreshFeed}
            >
              Retry
            </button>
            <button 
              className="diagnose-button" 
              onClick={diagnoseConnection}
            >
              Diagnose Connection
            </button>
          </div>
          {diagnosticInfo && (
            <div className="diagnostic-info">
              <p>{diagnosticInfo}</p>
            </div>
          )}
        </div>
      ) : posts.length === 0 ? (
        <div className="no-posts-message">
          <p>No running posts found. Follow some runners or post your own run!</p>
          <button 
            className="retry-button" 
            onClick={refreshFeed}
          >
            Refresh
          </button>
          <button 
            className="diagnose-button" 
            onClick={diagnoseConnection}
          >
            Diagnose Connection
          </button>
        </div>
      ) : (
        <>
          <PostList
            posts={posts}
            loading={loading}
            page={1}
            userLikes={userLikes}
            userReposts={userReposts}
            handleLike={handleLike}
            handleRepost={handleRepost}
            handleZap={(post) => handleZap(post, wallet)}
            handleCommentClick={handleCommentClick}
            handleComment={handleComment}
            commentText={commentText}
            setCommentText={setCommentText}
            wallet={wallet}
          />
          
          {/* Load More Button */}
          {canLoadMore() && (
            <div className="load-more-container">
              <button 
                className="load-more-button" 
                onClick={loadMorePosts}
                disabled={loading}
              >
                {loading ? <RunFeedLoading /> : 'Load More Posts'}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Debug toggle button */}
      <button 
        onClick={toggleDebug}
        className="debug-toggle"
        style={{
          bottom: showDebug ? '200px' : '10px'
        }}
      >
        {showDebug ? 'X' : '🐞'}
      </button>
      
      {/* Debug overlay - remove after debugging */}
      {showDebug && (
        <div className="debug-overlay">
          <h3>Debug Info</h3>
          <p>Connected relays: {window.NDK?.pool?.relays?.size || 0}</p>
          <p>Posts loaded: {posts?.length || 0}</p>
          <p>Feed error: {error || 'None'}</p>
          <p>Loading state: {loading ? 'Loading' : 'Idle'}</p>
          <p>Preloading: {globalFeedState.isPreloading ? `${globalFeedState.preloadProgress}%` : 'No'}</p>
          <p>Cache valid: {globalFeedState.isCacheValid() ? 'Yes' : 'No'}</p>
          <p>User interactions: {userLikes?.size || 0} likes, {userReposts?.size || 0} reposts</p>
          <div className="debug-actions">
            <button 
              onClick={refreshFeed}
              className="debug-button"
            >
              Refresh Feed
            </button>
            <button 
              onClick={diagnoseConnection}
              className="debug-button secondary"
            >
              Test Connection
            </button>
            <button
              onClick={() => globalFeedState.invalidateCache()}
              className="debug-button warning"
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunClub; 