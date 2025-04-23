import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { runTracker } from '../services/RunTracker';
import { useActivityMode } from './ActivityModeContext';
import { ACTIVITY_TYPES } from '../services/RunDataService';

// Create the context
const RunTrackerContext = createContext(null);

// Custom hook to use the run tracker context
export const useRunTracker = () => {
  const context = useContext(RunTrackerContext);
  if (!context) {
    console.error('useRunTracker must be used within a RunTrackerProvider');
    // Return a fallback object with no-op functions to prevent crashes
    return {
      isTracking: false,
      isPaused: false,
      distance: 0,
      duration: 0,
      pace: 0,
      splits: [],
      splitsKm: [],
      splitsMi: [],
      elevation: { current: null, gain: 0, loss: 0 },
      activityType: ACTIVITY_TYPES.RUN,
      startRun: () => console.warn('RunTracker not initialized'),
      pauseRun: () => console.warn('RunTracker not initialized'),
      resumeRun: () => console.warn('RunTracker not initialized'),
      stopRun: () => console.warn('RunTracker not initialized'),
      runTracker
    };
  }
  return context;
};

// Provider component
export const RunTrackerProvider = ({ children }) => {
  const { mode: activityType } = useActivityMode();

  // Initialize state with try/catch to prevent fatal errors on startup
  const [trackingState, setTrackingState] = useState(() => {
    try {
      return {
        isTracking: runTracker.isTracking,
        isPaused: runTracker.isPaused,
        distance: runTracker.distance,
        duration: runTracker.duration,
        pace: runTracker.pace,
        splits: runTracker.splits,
        splitsKm: runTracker.splitsKm,
        splitsMi: runTracker.splitsMi,
        elevation: runTracker.elevation,
        activityType: runTracker.activityType || activityType
      };
    } catch (error) {
      console.error('Error initializing run tracker state:', error);
      return {
        isTracking: false,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        splits: [],
        splitsKm: [],
        splitsMi: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: activityType
      };
    }
  });

  // Listen for changes in the run tracker state
  useEffect(() => {
    try {
      const handleDistanceChange = (distance) => {
        setTrackingState(prev => ({ ...prev, distance }));
      };

      const handleDurationChange = (duration) => {
        setTrackingState(prev => ({ ...prev, duration }));
      };

      const handlePaceChange = (pace) => {
        setTrackingState(prev => ({ ...prev, pace }));
      };

      const handleSplitRecorded = (splitsData) => {
        setTrackingState(prev => ({
          ...prev,
          splits: splitsData.splits,
          splitsKm: splitsData.splitsKm,
          splitsMi: splitsData.splitsMi
        }));
      };

      const handleElevationChange = (elevation) => {
        setTrackingState(prev => ({ ...prev, elevation }));
      };

      const handleStatusChange = () => {
        setTrackingState(prev => ({
          ...prev,
          isTracking: runTracker.isTracking,
          isPaused: runTracker.isPaused
        }));
      };

      // Handler for saving completed runs to localStorage
      const handleRunStopped = (finalResults) => {
        console.log('Run completed:', finalResults);
        // The actual saving is now handled by the RunTracker service using RunDataService
      };

      // Subscribe to events from the run tracker
      runTracker.on('distanceChange', handleDistanceChange);
      runTracker.on('durationChange', handleDurationChange);
      runTracker.on('paceChange', handlePaceChange);
      runTracker.on('splitRecorded', handleSplitRecorded);
      runTracker.on('elevationChange', handleElevationChange);
      runTracker.on('statusChange', handleStatusChange);
      runTracker.on('stopped', handleRunStopped);

      // Check for active run state in localStorage on mount
      const savedRunState = localStorage.getItem('activeRunState');
      if (savedRunState) {
        try {
          const runData = JSON.parse(savedRunState);
          
          // Update state
          setTrackingState({
            isTracking: runData.isRunning,
            isPaused: runData.isPaused,
            distance: runData.distance,
            duration: runData.duration,
            pace: runData.pace,
            splits: runData.splits,
            splitsKm: runData.splitsKm,
            splitsMi: runData.splitsMi,
            elevation: runData.elevation,
            activityType: runData.activityType || activityType
          });
          
          // Restore tracking if active and not paused
          if (runData.isRunning && !runData.isPaused) {
            runTracker.restoreTracking(runData);
          } else if (runData.isRunning && runData.isPaused) {
            // We need to ensure the runTracker internal state matches our paused state
            runTracker.isTracking = true;
            runTracker.isPaused = true;
            runTracker.distance = runData.distance;
            runTracker.duration = runData.duration;
            runTracker.pace = runData.pace;
            runTracker.splits = [...runData.splits];
            runTracker.splitsKm = [...runData.splitsKm];
            runTracker.splitsMi = [...runData.splitsMi];
            runTracker.elevation = {...runData.elevation};
            runTracker.activityType = runData.activityType || activityType;
          }
        } catch (error) {
          console.error('Error restoring run state:', error);
          // If restoration fails, remove potentially corrupted state
          localStorage.removeItem('activeRunState');
        }
      }

      // Cleanup event listeners on unmount
      return () => {
        runTracker.off('distanceChange', handleDistanceChange);
        runTracker.off('durationChange', handleDurationChange);
        runTracker.off('paceChange', handlePaceChange);
        runTracker.off('splitRecorded', handleSplitRecorded);
        runTracker.off('elevationChange', handleElevationChange); 
        runTracker.off('statusChange', handleStatusChange);
        runTracker.off('stopped', handleRunStopped);
      };
    } catch (error) {
      console.error('Error setting up run tracker event listeners:', error);
      // Return empty cleanup function
      return () => {};
    }
  }, [activityType]); // Include activityType in dependencies

  // Save run state to localStorage when it changes
  useEffect(() => {
    try {
      if (trackingState.isTracking) {
        const runData = {
          isRunning: trackingState.isTracking,
          isPaused: trackingState.isPaused,
          distance: trackingState.distance,
          duration: trackingState.duration,
          pace: trackingState.pace,
          splits: trackingState.splits,
          splitsKm: trackingState.splitsKm,
          splitsMi: trackingState.splitsMi,
          elevation: trackingState.elevation,
          activityType: trackingState.activityType,
          timestamp: new Date().getTime()
        };
        
        localStorage.setItem('activeRunState', JSON.stringify(runData));
      } else {
        // Clear active run state when run is stopped
        localStorage.removeItem('activeRunState');
      }
    } catch (error) {
      console.error('Error saving run state:', error);
    }
  }, [trackingState]);

  // Update activity type in tracking state when it changes in context
  useEffect(() => {
    if (!trackingState.isTracking) {
      setTrackingState(prev => ({ ...prev, activityType }));
    }
  }, [activityType, trackingState.isTracking]);

  // Methods to control the run tracker
  const startRun = async () => {
    try {
      // Clear previous run data and set tracking state to running
      runTracker.distance = 0;
      runTracker.duration = 0;
      runTracker.pace = 0;
      runTracker.splits = [];
      runTracker.splitsKm = []; // Initialize empty km splits
      runTracker.splitsMi = []; // Initialize empty mile splits
      runTracker.elevation = { current: null, gain: 0, loss: 0, lastAltitude: null };
      
      // Start tracking with the current activity type
      await runTracker.start({ activityType });
      
      // Update state
      setTrackingState(prev => ({
        ...prev,
        isTracking: true,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        splits: [],
        splitsKm: [], // Set empty km splits
        splitsMi: [], // Set empty mile splits
        elevation: { gain: 0, loss: 0 }
      }));
      
      // Create the save state interval
      // ... existing interval code ...
    } catch (error) {
      console.error('Error starting run:', error);
      // ... error handling ...
    }
  };

  const pauseRun = async () => {
    try {
      await runTracker.pause();
      setTrackingState(prev => ({ ...prev, isPaused: true }));
    } catch (error) {
      console.error('Error pausing run:', error);
    }
  };

  const resumeRun = async () => {
    try {
      await runTracker.resume();
      setTrackingState(prev => ({ ...prev, isPaused: false }));
    } catch (error) {
      console.error('Error resuming run:', error);
    }
  };

  const stopRun = async () => {
    if (!trackingState.isTracking) return;

    try {
      await runTracker.stop();
      
      // Prepare the run data to save
      const runData = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        distance: trackingState.distance,
        duration: trackingState.duration,
        pace: trackingState.pace,
        splits: trackingState.splits,
        splitsKm: trackingState.splitsKm,
        splitsMi: trackingState.splitsMi,
        elevation: trackingState.elevation,
        activityType: trackingState.activityType
      };
      
      // Get existing run history from localStorage
      const storedHistory = localStorage.getItem('runHistory');
      const runHistory = storedHistory ? JSON.parse(storedHistory) : [];
      
      // Save updated history back to localStorage
      localStorage.setItem('runHistory', JSON.stringify([...runHistory, runData]));
      
      // Reset tracking state
      setTrackingState({
        isTracking: false,
        isPaused: false,
        distance: 0,
        duration: 0,
        pace: 0,
        splits: [],
        splitsKm: [],
        splitsMi: [],
        elevation: { current: null, gain: 0, loss: 0, lastAltitude: null },
        activityType: ACTIVITY_TYPES.RUNNING
      });
      
      return runData;
    } catch (err) {
      console.error('Error stopping run:', err);
      return null;
    }
  };

  // Provide both the state and methods to control the run tracker
  const value = {
    ...trackingState,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    runTracker // Expose the original instance for advanced use cases
  };

  return (
    <RunTrackerContext.Provider value={value}>
      {children}
    </RunTrackerContext.Provider>
  );
};

RunTrackerProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 