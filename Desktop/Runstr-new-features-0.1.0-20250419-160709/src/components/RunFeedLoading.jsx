import { useState, useEffect } from 'react';
import globalFeedState from '../utils/globalFeedState';
import './RunFeedLoading.css';

/**
 * RunFeedLoading component 
 * 
 * Displays loading state for the feed with enhanced feedback for preloading
 * Shows progress indicator when preloading is active
 */
export const RunFeedLoading = ({ showDetailedProgress = false }) => {
  const [progress, setProgress] = useState(globalFeedState.preloadProgress);
  const [isPreloading, setIsPreloading] = useState(globalFeedState.isPreloading);
  
  // Monitor preloading progress
  useEffect(() => {
    const checkProgress = () => {
      setProgress(globalFeedState.preloadProgress);
      setIsPreloading(globalFeedState.isPreloading);
    };
    
    // Initial check
    checkProgress();
    
    // Poll for updates
    const interval = setInterval(checkProgress, 200);
    return () => clearInterval(interval);
  }, []);
  
  if (!isPreloading) {
    // Regular loading spinner when not preloading
    return (
      <div className="feed-loading-container">
        <div className="feed-loading-spinner"></div>
        <p className="feed-loading-text">Loading feed...</p>
      </div>
    );
  }
  
  // Show progress bar during preloading
  return (
    <div className="feed-loading-container">
      <div className="feed-progress-bar-container">
        <div 
          className="feed-progress-bar"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      {showDetailedProgress && (
        <div className="feed-loading-details">
          {progress < 20 && "Connecting to Nostr network..."}
          {progress >= 20 && progress < 50 && "Fetching posts..."}
          {progress >= 50 && progress < 80 && "Loading profiles and interactions..."}
          {progress >= 80 && "Processing and preparing feed..."}
        </div>
      )}
      
      <p className="feed-loading-text">
        {showDetailedProgress ? 'Optimizing your feed experience...' : 'Loading feed...'}
      </p>
    </div>
  );
};

export default RunFeedLoading; 