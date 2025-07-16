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
  const users = JSON.parse(fs.readFileSync('./output/missing-users-2025-07-15T03-10-12-367Z.json', 'utf8'));
  let upsertedCount = 0;
  let failedCount = 0;

  console.log(`📊 Starting to process ${users.length} users...`);

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      // user.slug = generateSlug(user.name || user.id);
      if (!user.id) user.id = crypto.randomUUID();
      
      // Add lastBulkUpdate timestamp
      user.lastBulkUpdate = new Date().toISOString(); 
      
      // Use upsert to create or update the user
      await container.items.upsert(user);
      console.log(`✅ Upserted: ${user.name} (${i + 1}/${users.length})`);
      upsertedCount++;
    } catch (err) {
      console.error(`❌ Failed for ${user.name} (${i + 1}/${users.length}): ${err.message}`);
      failedCount++;
    }
  }

  console.log('\n📈 Final Statistics:');
  console.log(`✅ Total upserted users: ${upsertedCount}`);
  console.log(`❌ Total failed users: ${failedCount}`);
  console.log(`📊 Total processed: ${upsertedCount + failedCount}`);
  console.log(`🎯 Success rate: ${((upsertedCount / (upsertedCount + failedCount)) * 100).toFixed(2)}%`);
}

loadUsers();
