const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE_ID;
const containerId = process.env.COSMOS_DB_CONTAINER_ID;

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container(containerId);

// Query to get first 1000 users
const querySpec = {
  query: "SELECT * FROM c OFFSET 2000 LIMIT 6000"
};

async function printUserSlugs() {
  const { resources: users } = await container.items.query(querySpec).fetchAll();
  
  console.log('📋 Printing user slugs:');
  for (const user of users) {
    console.log(`${user.slug || 'NO_SLUG'}`);
  }
  // console.log(`\nTotal users: ${users.length}`);
}

async function updateUsers() {
  const { resources: users } = await container.items.query(querySpec).fetchAll();
  
  for (const user of users) {
    try {
      // Add new properties
      user.lastBulkUpdate = new Date().toISOString();
      user.isActive = true;
      
      // Update using id as both document id and partition key
      await container.item(user.id, user.id).replace(user);
      console.log(`✅ Updated: ${user.name} (ID: ${user.id})`);
    } catch (err) {
      console.error(`❌ Failed to update ${user.name} (ID: ${user.id}): ${err.message}`);
    }
  }

  console.log(`Completed updating ${users.length} users`);
}

// Check for print mode via command line argument
const printMode = process.argv.includes('--print') || process.argv.includes('-p');

if (printMode) {
  printUserSlugs().catch(console.error);
} else {
  updateUsers().catch(console.error);
} 
