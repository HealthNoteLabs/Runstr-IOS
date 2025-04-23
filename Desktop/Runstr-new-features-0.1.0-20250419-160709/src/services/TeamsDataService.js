/**
 * TeamsDataService.js
 * Centralized service for handling teams/clubs data
 */

import { getUserPublicKey } from '../utils/nostrClient';

class TeamsDataService {
  constructor() {
    this.teamsStorageKey = 'teamsData';
    this.membershipStorageKey = 'teamMemberships';
    this.teamMessagesKey = 'teamMessages';
    this.teamChallengesKey = 'teamChallenges';
    this.pinnedPostsKey = 'teamPinnedPosts';
    this.listeners = [];
  }
  
  /**
   * Initialize the teams data service
   */
  async initialize() {
    console.log('Initializing TeamsDataService');
    
    // Ensure local storage has team data structures
    if (!localStorage.getItem(this.teamsStorageKey)) {
      localStorage.setItem(this.teamsStorageKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.membershipStorageKey)) {
      localStorage.setItem(this.membershipStorageKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.teamMessagesKey)) {
      localStorage.setItem(this.teamMessagesKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.teamChallengesKey)) {
      localStorage.setItem(this.teamChallengesKey, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(this.pinnedPostsKey)) {
      localStorage.setItem(this.pinnedPostsKey, JSON.stringify([]));
    }
    
    // Notify listeners that initialization is complete
    this._notifyListeners('initialized', true);
    
    return true;
  }
  
  /**
   * Get all teams
   * @returns {Array} Array of team objects
   */
  getAllTeams() {
    const teamsJson = localStorage.getItem(this.teamsStorageKey);
    return teamsJson ? JSON.parse(teamsJson) : [];
  }
  
  /**
   * Get a team by ID
   * @param {string} teamId - Team ID
   * @returns {Object|null} Team object or null if not found
   */
  getTeamById(teamId) {
    const teams = this.getAllTeams();
    return teams.find(team => team.id === teamId) || null;
  }
  
  /**
   * Get teams that a user is a member of
   * @param {string} userId - User ID
   * @returns {Array} Array of team objects
   */
  getUserTeams(userId) {
    const teams = this.getAllTeams();
    const memberships = this.getUserMemberships(userId);
    const teamIds = memberships.map(m => m.teamId);
    
    return teams.filter(team => teamIds.includes(team.id));
  }
  
  /**
   * Create a new team
   * @param {Object} teamData - Team data
   * @returns {Object} Created team
   */
  async createTeam(teamData) {
    // Generate a UUID for the team ID if not provided
    const teamId = teamData.id || `team_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const newTeam = {
      id: teamId,
      name: teamData.name,
      description: teamData.description || '',
      picture: teamData.picture || '',
      creatorId: teamData.creatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPrivate: teamData.isPrivate || false,
      customFields: teamData.customFields || {},
      hasNostrGroup: false // No longer supporting direct Nostr group creation
    };
    
    // Save the team to local storage
    const teams = this.getAllTeams();
    teams.push(newTeam);
    localStorage.setItem(this.teamsStorageKey, JSON.stringify(teams));
    
    // Notify listeners
    this._notifyListeners('teams', teams);
    
    return newTeam;
  }
  
  /**
   * Get team memberships
   * @param {string} teamId - Team ID
   * @returns {Array} Array of membership objects
   */
  getMemberships(teamId) {
    const membershipsJson = localStorage.getItem(this.membershipStorageKey);
    const memberships = membershipsJson ? JSON.parse(membershipsJson) : [];
    return memberships.filter(m => m.teamId === teamId);
  }
  
  /**
   * Get memberships for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of membership objects
   */
  getUserMemberships(userId) {
    const membershipsJson = localStorage.getItem(this.membershipStorageKey);
    const memberships = membershipsJson ? JSON.parse(membershipsJson) : [];
    return memberships.filter(m => m.userId === userId);
  }
  
  /**
   * Add a member to a team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @param {string} role - Member role (default: 'member')
   * @returns {Promise<boolean>} Success status
   */
  async addMember(teamId, userId, role = 'member') {
    const team = this.getTeamById(teamId);
    if (!team) {
      console.error(`Team with ID ${teamId} not found`);
      return false;
    }
    
    // Check if already a member
    const memberships = this.getMemberships(teamId);
    const existingMembership = memberships.find(m => m.userId === userId);
    if (existingMembership) {
      console.log(`User ${userId} is already a member of team ${teamId}`);
      return true;
    }
    
    // Create membership
    const membership = {
      id: `membership_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      teamId,
      userId,
      role,
      joinedAt: new Date().toISOString()
    };
    
    // Save to local storage
    const allMemberships = JSON.parse(localStorage.getItem(this.membershipStorageKey) || '[]');
    allMemberships.push(membership);
    localStorage.setItem(this.membershipStorageKey, JSON.stringify(allMemberships));
    
    // Notify listeners
    this._notifyListeners('memberships', this.getMemberships(teamId));
    this._notifyListeners('myTeams');
    
    return true;
  }
  
  /**
   * Remove a member from a team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  removeMember(teamId, userId) {
    // Get all memberships
    const allMemberships = JSON.parse(localStorage.getItem(this.membershipStorageKey) || '[]');
    
    // Find the membership to remove
    const membershipIndex = allMemberships.findIndex(
      m => m.teamId === teamId && m.userId === userId
    );
    
    if (membershipIndex === -1) {
      console.error(`No membership found for user ${userId} in team ${teamId}`);
      return false;
    }
    
    // Remove the membership
    allMemberships.splice(membershipIndex, 1);
    localStorage.setItem(this.membershipStorageKey, JSON.stringify(allMemberships));
    
    // Notify listeners
    this._notifyListeners('memberships', this.getMemberships(teamId));
    this._notifyListeners('myTeams');
    
    return true;
  }
  
  /**
   * Get messages for a team
   * @param {string} teamId - Team ID
   * @returns {Array} Array of message objects
   */
  getTeamMessages(teamId) {
    const messagesJson = localStorage.getItem(this.teamMessagesKey);
    const messages = messagesJson ? JSON.parse(messagesJson) : [];
    return messages
      .filter(m => m.teamId === teamId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
  
  /**
   * Add a message to a team chat
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID of the sender
   * @param {string} content - Message content
   * @returns {Promise<Object>} Created message
   */
  async addTeamMessage(teamId, userId, content) {
    // Create the message
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      teamId,
      userId,
      content,
      timestamp: new Date().toISOString(),
      isPinned: false
    };
    
    // Save to local storage
    const allMessages = JSON.parse(localStorage.getItem(this.teamMessagesKey) || '[]');
    allMessages.push(message);
    localStorage.setItem(this.teamMessagesKey, JSON.stringify(allMessages));
    
    // Notify listeners
    this._notifyListeners('messages', this.getTeamMessages(teamId));
    
    return message;
  }
  
  /**
   * Get pinned posts for a team
   * @param {string} teamId - Team ID
   * @returns {Array} Array of pinned post objects
   */
  getPinnedPosts(teamId) {
    const pinnedJson = localStorage.getItem(this.pinnedPostsKey);
    const pinned = pinnedJson ? JSON.parse(pinnedJson) : [];
    return pinned.filter(p => p.teamId === teamId);
  }
  
  /**
   * Pin a post in a team
   * @param {string} teamId - Team ID
   * @param {Object} postData - Post data to pin
   * @returns {Object} Pinned post
   */
  pinPost(teamId, postData) {
    // Create pin object
    const pin = {
      id: `pin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      teamId,
      postId: postData.id,
      userId: postData.userId,
      content: postData.content,
      timestamp: postData.timestamp,
      pinnedAt: new Date().toISOString()
    };
    
    // Save to local storage
    const allPins = JSON.parse(localStorage.getItem(this.pinnedPostsKey) || '[]');
    allPins.push(pin);
    localStorage.setItem(this.pinnedPostsKey, JSON.stringify(allPins));
    
    // Notify listeners
    this._notifyListeners('pinnedPosts', this.getPinnedPosts(teamId));
    
    return pin;
  }
  
  /**
   * Get challenges for a team
   * @param {string} teamId - Team ID
   * @returns {Array} Array of challenge objects
   */
  getTeamChallenges(teamId) {
    const challengesJson = localStorage.getItem(this.teamChallengesKey);
    const challenges = challengesJson ? JSON.parse(challengesJson) : [];
    return challenges.filter(c => c.teamId === teamId);
  }
  
  /**
   * Add a listener for data changes
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  addListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  /**
   * Remove a listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  removeListener(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  
  /**
   * Notify listeners of data changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  _notifyListeners(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in TeamsDataService listener for event ${event}:`, error);
      }
    });
  }
}

const teamsDataService = new TeamsDataService();
export default teamsDataService; 