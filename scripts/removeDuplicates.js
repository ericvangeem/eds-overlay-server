const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE_ID;
const containerId = process.env.COSMOS_DB_CONTAINER_ID;

// Initialize Cosmos DB client if credentials are available
let client, container;
if (endpoint && key) {
  client = new CosmosClient({ endpoint, key });
  container = client.database(databaseId).container(containerId);
}

/**
 * Remove duplicates from an array of user objects based on slug property
 * @param {Array} users - Array of user objects
 * @returns {Array} - Array with duplicates removed
 */
function removeDuplicatesBySlug(users) {
  const seen = new Set();
  const uniqueUsers = [];
  const duplicates = [];

  for (const user of users) {
    if (!user.slug) {
      console.warn(`⚠️  User without slug found: ${user.name || 'Unknown'}`);
      uniqueUsers.push(user); // Keep users without slugs
      continue;
    }

    if (seen.has(user.slug)) {
      duplicates.push(user);
      console.log(`🗑️  Duplicate found: ${user.name} (slug: ${user.slug})`);
    } else {
      seen.add(user.slug);
      uniqueUsers.push(user);
    }
  }

  return { uniqueUsers, duplicates };
}

/**
 * Process local JSON file
 */
async function processLocalFile(filePath) {
  try {
    console.log(`📁 Reading file: ${filePath}`);
    const data = await fs.readFile(filePath, 'utf8');
    const users = JSON.parse(data);

    console.log(`📊 Total users before deduplication: ${users.length}`);
    
    const { uniqueUsers, duplicates } = removeDuplicatesBySlug(users);
    
    console.log(`✅ Unique users: ${uniqueUsers.length}`);
    console.log(`🗑️  Duplicates removed: ${duplicates.length}`);

    // Create backup of original file
    const backupPath = filePath.replace('.json', '_backup.json');
    await fs.writeFile(backupPath, data);
    console.log(`💾 Backup created: ${backupPath}`);

    // Write deduplicated data
    await fs.writeFile(filePath, JSON.stringify(uniqueUsers, null, 2));
    console.log(`✅ Deduplicated data written to: ${filePath}`);

    // Write duplicates to separate file for review
    const duplicatesPath = filePath.replace('.json', '_duplicates.json');
    await fs.writeFile(duplicatesPath, JSON.stringify(duplicates, null, 2));
    console.log(`📋 Duplicates saved to: ${duplicatesPath}`);

  } catch (error) {
    console.error(`❌ Error processing file: ${error.message}`);
  }
}

/**
 * Process Cosmos DB users
 */
async function processCosmosDB() {
  if (!client) {
    console.error('❌ Cosmos DB credentials not found. Please set environment variables.');
    return;
  }

  try {
    console.log('🔍 Querying Cosmos DB for users...');
    
    // Query to get all users
    const querySpec = {
      query: "SELECT * FROM c"
    };

    const { resources: users } = await container.items.query(querySpec).fetchAll();
    console.log(`📊 Total users in Cosmos DB: ${users.length}`);

    const { uniqueUsers, duplicates } = removeDuplicatesBySlug(users);
    
    console.log(`✅ Unique users: ${uniqueUsers.length}`);
    console.log(`🗑️  Duplicates found: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log('\n🗑️  Removing duplicates from Cosmos DB...');
      
      for (const duplicate of duplicates) {
        try {
          await container.item(duplicate.id, duplicate.id).delete();
          console.log(`✅ Deleted duplicate: ${duplicate.name} (slug: ${duplicate.slug})`);
        } catch (error) {
          console.error(`❌ Failed to delete ${duplicate.name}: ${error.message}`);
        }
      }
      
      console.log(`✅ Successfully removed ${duplicates.length} duplicates from Cosmos DB`);
    } else {
      console.log('✅ No duplicates found in Cosmos DB');
    }

  } catch (error) {
    console.error(`❌ Error processing Cosmos DB: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  console.log('🔄 Starting duplicate removal process...\n');

  if (mode === '--cosmos' || mode === '-c') {
    await processCosmosDB();
  } else if (mode === '--file' || mode === '-f') {
    const filePath = args[1];
    if (!filePath) {
      console.error('❌ Please provide a file path: node removeDuplicates.js --file path/to/users.json');
      return;
    }
    await processLocalFile(filePath);
  } else {
    // Default: process the local users.json file
    const defaultPath = path.join(__dirname, 'users.json');
    await processLocalFile(defaultPath);
  }

  console.log('\n✅ Deduplication process completed!');
}

// Handle command line arguments
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  removeDuplicatesBySlug,
  processLocalFile,
  processCosmosDB
}; 