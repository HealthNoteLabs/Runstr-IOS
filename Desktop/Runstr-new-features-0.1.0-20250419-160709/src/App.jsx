import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { NostrProvider } from './contexts/NostrProvider';
import { AuthProvider } from './components/AuthProvider';
import { AudioPlayerProvider } from './contexts/AudioPlayerProvider';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { TeamsProvider } from './contexts/TeamsContext';
import { ActivityModeProvider } from './contexts/ActivityModeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { MenuBar } from './components/MenuBar';
import { initializeNostr } from './utils/nostr';
import connectionManager from './utils/nostrConnectionManager';
import globalFeedState from './utils/globalFeedState';
import './App.css';

console.log("App.jsx is loading");

// Improved error boundary fallback
const ErrorFallback = () => (
  <div className="p-6 bg-red-900/30 border border-red-800 rounded-lg m-4">
    <h2 className="text-2xl font-bold text-white mb-4">App Loading Error</h2>
    <p className="text-red-300 mb-4">
      There was a problem loading the app. This could be due to network issues or a problem with the app itself.
    </p>
    <button 
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
    >
      Reload App
    </button>
  </div>
);

// Enhanced loading component with timeout detection
const EnhancedLoadingFallback = () => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  useEffect(() => {
    // After 5 seconds of loading, show a timeout warning
    const timeoutId = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-300">Loading RUNSTR...</p>
      
      {showTimeoutWarning && (
        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg max-w-md">
          <p className="text-yellow-300 text-center mb-2">
            Loading is taking longer than expected. Please be patient.
          </p>
          <p className="text-yellow-400 text-sm text-center">
            If this persists, try reloading the app.
          </p>
        </div>
      )}
    </div>
  );
};

// Lazy load AppRoutes with error handling
const AppRoutes = lazy(() => 
  import('./AppRoutes')
    .then(module => {
      console.log("AppRoutes module loaded successfully");
      return { default: module.default || module.AppRoutes };
    })
    .catch(error => {
      console.error("Error loading AppRoutes:", error);
      return { 
        default: () => <ErrorFallback /> 
      };
    })
);

const App = () => {
  const [hasError, setHasError] = useState(false);
  const [feedPreloadStatus, setFeedPreloadStatus] = useState({
    loading: false,
    progress: 0,
    error: null
  });
  
  // Enhanced Nostr preloading with connection management
  useEffect(() => {
    const preloadNostr = async () => {
      try {
        console.log('Initializing Nostr connection on app launch');
        
        // Register operation with connection manager with high priority
        const shouldYield = connectionManager.registerOperation(
          'app-init-nostr',
          'auth', // High priority operation
          null
        );
        
        if (shouldYield) {
          console.log('Nostr init yielding to higher priority operation, will retry');
          setTimeout(preloadNostr, 1000);
          return;
        }
        
        // Initialize Nostr first
        await initializeNostr();
        
        // Mark initialization as complete
        connectionManager.removeOperation('app-init-nostr');
        
        // Schedule feed preloading with a short delay to allow auth flows
        setTimeout(preloadFeed, 2000);
      } catch (error) {
        console.error('Error in Nostr initialization:', error);
        connectionManager.removeOperation('app-init-nostr');
      }
    };
    
    const preloadFeed = async () => {
      try {
        // Only start preloading if not already in progress
        if (globalFeedState.isPreloading || feedPreloadStatus.loading) {
          return;
        }
        
        // Register feed preloading as low-priority operation
        const shouldYield = connectionManager.registerOperation(
          'feed-preload',
          'feed',
          () => console.log('Feed preload yielded to higher priority operation')
        );
        
        if (shouldYield) {
          console.log('Deferring feed preload due to higher priority operations');
          setTimeout(preloadFeed, 3000);
          return;
        }
        
        // Update local state
        setFeedPreloadStatus({
          loading: true,
          progress: 0,
          error: null
        });
        
        // Update global state
        globalFeedState.isPreloading = true;
        globalFeedState.preloadProgress = 0;
        
        console.log('Starting background feed preload');
        
        // Step 1: Dynamic import of feed-related functions
        const { fetchRunningPosts, loadSupplementaryData } = await import('./utils/nostr');
        setFeedPreloadStatus(prev => ({ ...prev, progress: 10 }));
        globalFeedState.preloadProgress = 10;
        
        // Step 2: Fetch initial post data
        console.log('Preloading basic feed data');
        const posts = await fetchRunningPosts(15);
        
        if (posts && posts.length > 0) {
          // Update global state with fetched posts
          globalFeedState.updatePosts(posts);
          
          // Update progress
          setFeedPreloadStatus(prev => ({ ...prev, progress: 50 }));
          globalFeedState.preloadProgress = 50;
          
          // Step 3: Load supplementary data with lower priority
          console.log('Preloading supplementary feed data');
          const supplementaryData = await loadSupplementaryData(posts);
          
          if (supplementaryData) {
            // Process and store supplementary data
            globalFeedState.updateSupplementaryData(supplementaryData);
            
            // Update progress to complete
            setFeedPreloadStatus(prev => ({ ...prev, progress: 100, loading: false }));
            globalFeedState.preloadProgress = 100;
            console.log('Feed preload complete');
          }
        } else {
          console.log('No posts fetched during preload');
          setFeedPreloadStatus(prev => ({ 
            ...prev, 
            loading: false,
            error: 'No posts found during preload'
          }));
        }
      } catch (error) {
        console.error('Error preloading feed data:', error);
        setFeedPreloadStatus({
          loading: false,
          progress: 0,
          error: error.message
        });
      } finally {
        // Always clean up, whether successful or not
        globalFeedState.isPreloading = false;
        connectionManager.removeOperation('feed-preload');
      }
    };
    
    // Start the preloading process
    preloadNostr();
  }, []);
  
  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('Global error:', event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);
  
  if (hasError) {
    return <ErrorFallback />;
  }
  
  return (
    <Router>
      <NostrProvider>
        <AuthProvider>
          <AudioPlayerProvider>
            <SettingsProvider>
              <ActivityModeProvider>
                <RunTrackerProvider>
                  <TeamsProvider>
                    <div className="relative w-full h-full bg-[#111827] text-white">
                      <MenuBar />
                      <main className="pb-24 w-full mx-auto px-4 max-w-screen-md">
                        <Suspense fallback={<EnhancedLoadingFallback />}>
                          <AppRoutes />
                        </Suspense>
                      </main>
                    </div>
                  </TeamsProvider>
                </RunTrackerProvider>
              </ActivityModeProvider>
            </SettingsProvider>
          </AudioPlayerProvider>
        </AuthProvider>
      </NostrProvider>
    </Router>
  );
};

export default App;
