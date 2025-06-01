const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
require('dotenv').config();

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE_ID;
const containerId = process.env.COSMOS_DB_CONTAINER_ID;

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container(containerId);

function generateSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadUsers() {
  const users = JSON.parse(fs.readFileSync('./scripts/users.json', 'utf8'));

  for (const user of users) {
    try {
      user.slug = generateSlug(user.name || user.id);
      if (!user.id) user.id = crypto.randomUUID();
      
      // Use upsert to create or update the user
      await container.items.upsert(user);
      console.log(`✅ Upserted: ${user.name}`);
    } catch (err) {
      console.error(`❌ Failed for ${user.name}: ${err.message}`);
    }
  }
}

loadUsers();
