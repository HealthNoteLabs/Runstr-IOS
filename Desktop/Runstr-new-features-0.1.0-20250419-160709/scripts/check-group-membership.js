// Group Membership Checker Script
// This script checks if a specified pubkey has joined the RUNSTR and Messi Run Club groups

// Import required modules - ensure you have these installed
// npm install nostr-tools ws

import { nip19, relayInit } from 'nostr-tools';
// For Node.js environments, you need to set WebSocket globally:
import WebSocket from 'ws';
// Make WebSocket available globally for nostr-tools
// @ts-ignore - globalThis is available in modern Node.js
globalThis.WebSocket = WebSocket;

// In browser environments, WebSocket is already available globally

// Target pubkey to check (in npub format)
const TARGET_NPUB = 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum';

// Define groups to check - exact values from test-nip29-terminal.js
const GROUPS = {
  RUNSTR: 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es',
  MESSI_RUN_CLUB: 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59'
};

// Additional group identifiers from the user's events
const GROUP_IDENTIFIERS = {
  '30023:97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322:8YjqXm4SKY-TauwjOfLXS': 'RUNSTR',
  '30023:1bda7e1f7396bda2d1ef99033da8fd2dc362810790df9be62f591038bb97c4d9:52120fe7': 'MESSI_RUN_CLUB'
};

// Decode the group identifiers for matching
const decodedGroups = {};

// Relay URLs - expanded list focused on NIP-29 support
const RELAYS = [
  'wss://groups.0xchat.com',  // Primary relay for NIP-29 groups
  'wss://nos.lol',
  'wss://relay.0xchat.com',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://eden.nostr.land',
  'wss://nostr.wine'
];

/**
 * Parse naddr and prepare group identifiers
 * This uses the same approach from test-nip29-terminal.js
 */
function parseNaddr(naddrString) {
  try {
    if (!naddrString) {
      console.error(`No naddr string provided`);
      return null;
    }
    
    // Decode the naddr string using nostr-tools NIP19 decoder
    const decodedData = nip19.decode(naddrString);
    
    if (!decodedData || !decodedData.data) {
      console.error(`Invalid naddr format - missing data after decoding`);
      return null;
    }
    
    const { data } = decodedData;
    
    // Handle different data formats that might come from decode
    let naddrData;
    if (data.type === 'naddr') {
      // Handle case where decodedData.data itself has a 'type' property
      naddrData = data;
    } else if (data.kind && data.pubkey && data.identifier) {
      // Handle direct data format
      naddrData = data;
    } else {
      console.error(`Invalid naddr data structure:`, data);
      return null;
    }
    
    return {
      kind: naddrData.kind,
      pubkey: naddrData.pubkey,
      identifier: naddrData.identifier,
      relays: naddrData.relays || []
    };
  } catch (error) {
    console.error(`Error parsing naddr:`, error);
    return null;
  }
}

/**
 * Pre-decode the group identifiers for better matching
 */
function decodeGroupIdentifiers() {
  for (const [groupName, groupNaddr] of Object.entries(GROUPS)) {
    try {
      const decoded = parseNaddr(groupNaddr);
      if (decoded) {
        decodedGroups[groupName] = decoded;
        console.log(`Decoded ${groupName}:`, decoded);
      }
    } catch (error) {
      console.log(`Error pre-decoding ${groupName}: ${error.message}`);
    }
  }
}

/**
 * Main function to check membership
 */
async function checkMembership() {
  console.log(`\n=== Group Membership Checker ===`);
  console.log(`Checking membership for: ${TARGET_NPUB}`);
  
  try {
    // Decode the npub to get hex pubkey
    const { data: pubkey } = nip19.decode(TARGET_NPUB);
    console.log(`Decoded pubkey: ${pubkey}`);
    
    // Pre-decode the group identifiers
    decodeGroupIdentifiers();
    
    // Array to store connected relays
    const connectedRelays = [];
    
    // Connect to each relay
    for (const url of RELAYS) {
      try {
        const relay = relayInit(url);
        relay.on('connect', () => {
          console.log(`Connected to ${url}`);
        });
        
        relay.on('error', () => {
          console.log(`Failed to connect to ${url}`);
        });
        
        await relay.connect();
        connectedRelays.push(relay);
      } catch (error) {
        console.log(`Error connecting to ${url}: ${error?.message || 'Unknown error'}`);
      }
    }
    
    if (connectedRelays.length === 0) {
      console.log('Failed to connect to any relays. Please check your internet connection.');
      return;
    }
    
    console.log(`Connected to ${connectedRelays.length} relay(s)`);
    
    // Check if the user has joined either group
    const membershipStatus = await checkUserGroups(connectedRelays, pubkey);
    
    // Close all relay connections
    for (const relay of connectedRelays) {
      relay.close();
    }
    
    // Display results
    console.log('\n=== Results ===');
    for (const [group, isMember] of Object.entries(membershipStatus)) {
      console.log(`${group}: ${isMember ? 'Member ✓' : 'Not a member ✗'}`);
    }
    
    // Summarize findings
    const memberOfAny = Object.values(membershipStatus).some(status => status);
    if (memberOfAny) {
      console.log('\nThe user has joined at least one of the specified groups.');
    } else {
      console.log('\nThe user has not joined any of the specified groups.');
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

/**
 * Check if a user has joined specified groups
 * @param {Array} relays - Connected relay objects
 * @param {string} pubkey - User's pubkey in hex format
 * @returns {Object} - Membership status for each group
 */
async function checkUserGroups(relays, pubkey) {
  console.log('\nFetching user group list...');
  
  // Initialize result object
  const result = Object.keys(GROUPS).reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
  
  // Create filter for NIP-51 group list events (kind 30001)
  const filter = {
    kinds: [30001], // NIP-51 group list
    authors: [pubkey],
    limit: 20
  };
  
  // Increase timeout for more reliable results
  const timeout = 8000; // 8 seconds
  
  // Create promises for each relay
  const promises = relays.map(relay => {
    return new Promise((resolve) => {
      let events = [];
      
      // Subscribe to events
      const sub = relay.sub([filter]);
      
      sub.on('event', event => {
        events.push(event);
      });
      
      // Set timeout for response
      setTimeout(() => {
        sub.unsub();
        resolve(events);
      }, timeout);
    });
  });
  
  // Wait for all promises to resolve
  const allEvents = await Promise.all(promises);
  
  // Flatten events array
  const events = allEvents.flat();
  
  console.log(`Found ${events.length} group list events`);
  
  // Process events to check group membership
  if (events.length > 0) {
    // Sort events by creation time, newest first
    events.sort((a, b) => b.created_at - a.created_at);
    
    for (const event of events) {
      console.log(`Processing event created at ${new Date(event.created_at * 1000).toISOString()}`);
      
      // Look for group tags - variants include 'a', 'group'
      const groupTags = event.tags.filter(tag => tag[0] === 'a' || tag[0] === 'group');
      
      if (groupTags.length > 0) {
        console.log(`Found ${groupTags.length} group references in event`);
        
        // Debug: log all group tags
        groupTags.forEach((tag, i) => {
          console.log(`Group tag ${i}: ${JSON.stringify(tag)}`);
        });
        
        // Check each group tag against our target groups
        for (const tag of groupTags) {
          const groupIdentifier = tag[1]; // Get the group identifier from the tag
          console.log(`Checking group identifier: ${groupIdentifier}`);
          
          // First, check direct match with known group identifiers
          if (GROUP_IDENTIFIERS[groupIdentifier]) {
            const matchedGroup = GROUP_IDENTIFIERS[groupIdentifier];
            result[matchedGroup] = true;
            console.log(`✓ Found direct membership match for ${matchedGroup}`);
            continue;
          }
          
          // Check against each target group using decoded data
          for (const [groupName] of Object.entries(GROUPS)) {
            if (!decodedGroups[groupName]) continue;
            
            // Generate the expected NIP-29 group ID format: kind:pubkey:identifier
            const decodedGroup = decodedGroups[groupName];
            const expectedNip29Format = `${decodedGroup.kind}:${decodedGroup.pubkey}:${decodedGroup.identifier}`;
            
            // Also check for alternative kind formats (30023 is often used instead of 39000)
            const alternativeFormat = `30023:${decodedGroup.pubkey}:${decodedGroup.identifier}`;
            
            // Log the expected formats we're looking for
            console.log(`Expected formats for ${groupName}:`);
            console.log(`- Primary: ${expectedNip29Format}`);
            console.log(`- Alternative: ${alternativeFormat}`);
            
            // Try multiple matching patterns
            if (
              // Direct match of group identifier
              groupIdentifier === expectedNip29Format ||
              // Match alternative format
              groupIdentifier === alternativeFormat ||
              // Match the identifier using just the pubkey and identifier
              groupIdentifier.includes(`${decodedGroup.pubkey}:${decodedGroup.identifier}`) ||
              // Match partial identifier 
              (decodedGroup.identifier && groupIdentifier.includes(decodedGroup.identifier)) ||
              // Match partial pubkey with kind
              groupIdentifier.includes(`30023:${decodedGroup.pubkey}`) ||
              // Match any relay-specific format that might be used
              groupIdentifier.includes(`${decodedGroup.kind}:${decodedGroup.pubkey}`)
            ) {
              result[groupName] = true;
              console.log(`✓ Found membership for ${groupName}`);
            }
          }
        }
      } else {
        console.log('No group tags found in this event');
      }
    }
  }
  
  return result;
}

// Run the script
checkMembership().catch(error => {
  console.error('Unhandled error:', error);
  console.error('Script execution failed.');
}); 