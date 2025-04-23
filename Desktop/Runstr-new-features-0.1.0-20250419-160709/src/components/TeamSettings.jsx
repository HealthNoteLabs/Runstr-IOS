import { useState, useContext } from 'react';
import { TeamsContext } from '../contexts/TeamsContext';
import { NostrContext } from '../contexts/NostrContext';

/**
 * TeamSettings component for configuring club options
 */
export const TeamSettings = () => {
  const { error } = useContext(TeamsContext);
  const { publicKey } = useContext(NostrContext);
  
  return (
    <div className="team-settings p-4 bg-gray-800 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Club Settings</h2>
      
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      <div className="space-y-4">
        {/* Nostr Authentication Status (Read-only) */}
        <div className="p-3 bg-gray-700/50 rounded-lg">
          <h3 className="font-medium">Nostr Status</h3>
          <p className="text-sm text-gray-400 mt-1">
            {publicKey 
              ? 'Connected with Nostr' 
              : 'Not connected with Nostr'}
          </p>
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>
          RUNSTR connects to Nostr running clubs to provide a 
          decentralized social experience for runners.
        </p>
      </div>
    </div>
  );
}; 