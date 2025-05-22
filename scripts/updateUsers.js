const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE_ID;
const containerId = process.env.COSMOS_DB_CONTAINER_ID;

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container(containerId);

async function updateUsers() {
  // Query to get first 100 users
  const querySpec = {
    query: "SELECT * FROM c OFFSET 0 LIMIT 100"
  };

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

updateUsers().catch(console.error); 
