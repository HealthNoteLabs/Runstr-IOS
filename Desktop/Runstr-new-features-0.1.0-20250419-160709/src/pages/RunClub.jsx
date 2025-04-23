import { useEffect, useContext, useState } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { useRunFeed } from '../hooks/useRunFeed';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { PostList } from '../components/PostList';
import { RunFeedLoading } from '../components/RunFeedLoading';
import { handleAppBackground } from '../utils/nostr';
import globalFeedState from '../utils/globalFeedState';
import './RunClub.css';

export const RunClub = () => {
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [diagnosticInfo, setDiagnosticInfo] = useState('');
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
    loadedSupplementaryData
  } = useRunFeed();
  
  const {
    commentText,
    setCommentText,
    handleCommentClick,
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
          <p>No running posts found</p>
          <button 
            className="retry-button" 
            onClick={refreshFeed}
          >
            Refresh
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
};