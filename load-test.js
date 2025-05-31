const fs = require('fs');
const axios = require('axios');
const path = require('path');

// Configuration
const CONFIG = {
  // Number of users to sample from generated_users.json
  sampleSize: 50,
  
  // Request frequency settings
  requestsPerSecond: 2,
  
  // Number of concurrent requests to send at once
  concurrentRequests: 1,
  
  // Total duration of test in seconds (0 = run once through all samples)
  testDurationSeconds: 0,
  
  // Timeout for each request in milliseconds
  requestTimeoutMs: 10000,
  
  // Whether to log detailed response information
  verbose: true,
  
  // File path to generated users
  usersFilePath: './generated_users.json',
  
  // Test target - 'azure' or 'vercel'
  testTarget: 'azure'
};

// Azure API configuration (same as your main app)
const azureUserApiCode = process.env.AZURE_USER_API_CODE || '';
const azureUserApiUrl = `${process.env.AZURE_USER_API_URL || ''}${azureUserApiCode ? `?code=${azureUserApiCode}` : ''}`;

// Vercel app configuration
const vercelAppUrl = 'https://eds-overlay-server.vercel.app/people';

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  responseTimes: [],
  errors: []
};

/**
 * Load and sample users from generated_users.json
 */
function loadSampleUsers() {
  try {
    console.log(`Loading users from ${CONFIG.usersFilePath}...`);
    
    if (!fs.existsSync(CONFIG.usersFilePath)) {
      throw new Error(`File not found: ${CONFIG.usersFilePath}`);
    }
    
    const usersData = JSON.parse(fs.readFileSync(CONFIG.usersFilePath, 'utf8'));
    const users = Array.isArray(usersData) ? usersData : usersData.users || [];
    
    if (users.length === 0) {
      throw new Error('No users found in the file');
    }
    
    console.log(`Found ${users.length} total users`);
    
    // Sample users randomly
    const sampleSize = Math.min(CONFIG.sampleSize, users.length);
    const sampledUsers = [];
    const usedIndices = new Set();
    
    while (sampledUsers.length < sampleSize) {
      const randomIndex = Math.floor(Math.random() * users.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        sampledUsers.push(users[randomIndex]);
      }
    }
    
    console.log(`Sampled ${sampledUsers.length} users for testing`);
    return sampledUsers;
    
  } catch (error) {
    console.error('Error loading users:', error.message);
    process.exit(1);
  }
}

/**
 * Extract slugs from sampled users
 */
function extractSlugs(users) {
  const slugs = users.map(user => user.slug).filter(slug => slug && slug.trim() !== '');
  
  console.log(`Extracted ${slugs.length} slugs:`, slugs);
  return slugs;
}

/**
 * Make a single API request
 */
async function makeRequest(slug) {
  const startTime = Date.now();
  
  try {
    let url, serviceName;
    
    if (CONFIG.testTarget === 'azure') {
      const apiUrl = new URL(azureUserApiUrl);
      apiUrl.searchParams.append('slug', slug);
      url = apiUrl.toString();
      serviceName = 'Azure API';
    } else if (CONFIG.testTarget === 'vercel') {
      url = `${vercelAppUrl}/${slug}`;
      serviceName = 'Vercel App';
    } else {
      throw new Error(`Invalid test target: ${CONFIG.testTarget}. Must be 'azure' or 'vercel'`);
    }
    
    if (CONFIG.verbose) {
      console.log(`Making ${serviceName} request for slug: ${slug}`);
      console.log(`URL: ${url}`);
    }
    
    const response = await axios.get(url, {
      timeout: CONFIG.requestTimeoutMs
    });
    
    const responseTime = Date.now() - startTime;
    stats.responseTimes.push(responseTime);
    stats.successfulRequests++;
    
    if (CONFIG.verbose) {
      console.log(`✅ ${serviceName} Success for ${slug} (${responseTime}ms):`, {
        status: response.status,
        ...(CONFIG.testTarget === 'azure' 
          ? { dataKeys: Object.keys(response.data || {}) }
          : { contentLength: response.headers['content-length'] || 'unknown' }
        )
      });
    } else {
      console.log(`✅ ${slug} (${responseTime}ms)`);
    }
    
    return { success: true, slug, responseTime, data: response.data };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    stats.failedRequests++;
    stats.errors.push({ slug, error: error.message, responseTime });
    
    console.log(`❌ Failed for ${slug} (${responseTime}ms): ${error.message}`);
    
    return { success: false, slug, responseTime, error: error.message };
  } finally {
    stats.totalRequests++;
  }
}

/**
 * Calculate statistics for a service
 */
function calculateServiceStats(serviceStats) {
  if (serviceStats.responseTimes.length > 0) {
    serviceStats.averageResponseTime = serviceStats.responseTimes.reduce((a, b) => a + b, 0) / serviceStats.responseTimes.length;
  }
  return serviceStats;
}

/**
 * Display statistics for a service
 */
function displayServiceStats(serviceName, serviceStats) {
  console.log(`\n${serviceName.toUpperCase()} RESULTS:`);
  console.log('-'.repeat(30));
  console.log(`Total Requests: ${serviceStats.totalRequests}`);
  console.log(`Successful: ${serviceStats.successfulRequests}`);
  console.log(`Failed: ${serviceStats.failedRequests}`);
  
  if (serviceStats.totalRequests > 0) {
    console.log(`Success Rate: ${((serviceStats.successfulRequests / serviceStats.totalRequests) * 100).toFixed(2)}%`);
  }
  
  console.log(`Average Response Time: ${serviceStats.averageResponseTime.toFixed(2)}ms`);
  
  if (serviceStats.responseTimes.length > 0) {
    const sortedTimes = serviceStats.responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    console.log(`Min Response Time: ${Math.min(...serviceStats.responseTimes)}ms`);
    console.log(`Max Response Time: ${Math.max(...serviceStats.responseTimes)}ms`);
    console.log(`P50 Response Time: ${p50}ms`);
    console.log(`P95 Response Time: ${p95}ms`);
    console.log(`P99 Response Time: ${p99}ms`);
  }
  
  if (serviceStats.errors.length > 0) {
    console.log(`\n${serviceName} Errors:`);
    serviceStats.errors.forEach(error => {
      console.log(`  ${error.slug}: ${error.error}`);
    });
  }
}

/**
 * Calculate and display statistics
 */
function displayStats() {
  calculateServiceStats(stats);
  
  console.log('\n' + '='.repeat(50));
  console.log('LOAD TEST RESULTS');
  console.log('='.repeat(50));
  
  displayServiceStats('Service', stats);
  
  // Combined stats
  const totalRequests = stats.totalRequests;
  const totalSuccessful = stats.successfulRequests;
  const totalFailed = stats.failedRequests;
  
  if (totalRequests > 0) {
    console.log(`\nCOMBINED RESULTS:`);
    console.log('-'.repeat(30));
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${totalSuccessful}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Overall Success Rate: ${((totalSuccessful / totalRequests) * 100).toFixed(2)}%`);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send multiple requests concurrently
 */
async function sendConcurrentRequests(slugs, startIndex, count) {
  const requests = [];
  
  for (let i = 0; i < count && (startIndex + i) < slugs.length; i++) {
    const slug = slugs[startIndex + i];
    requests.push(makeRequest(slug));
  }
  
  if (requests.length === 0) return [];
  
  console.log(`Sending ${requests.length} concurrent requests...`);
  const results = await Promise.all(requests);
  
  return results;
}

/**
 * Send concurrent requests for duration-based testing
 */
async function sendConcurrentRequestsForDuration(slugs, endTime) {
  const requests = [];
  
  for (let i = 0; i < CONFIG.concurrentRequests; i++) {
    const randomSlug = slugs[Math.floor(Math.random() * slugs.length)];
    requests.push(makeRequest(randomSlug));
  }
  
  console.log(`Sending ${requests.length} concurrent requests...`);
  const results = await Promise.all(requests);
  
  return results;
}

/**
 * Main load test function
 */
async function runLoadTest() {
  // Validate test target
  if (!['azure', 'vercel'].includes(CONFIG.testTarget)) {
    console.error(`Invalid test target: ${CONFIG.testTarget}. Must be 'azure' or 'vercel'`);
    process.exit(1);
  }
  
  const serviceName = CONFIG.testTarget === 'azure' ? 'Azure API' : 'Vercel App';
  const serviceUrl = CONFIG.testTarget === 'azure' ? azureUserApiUrl : vercelAppUrl;
  
  console.log(`Starting ${serviceName} Load Test`);
  console.log('Configuration:', CONFIG);
  console.log(`${serviceName} URL:`, serviceUrl);
  console.log('');
  
  // Load and prepare test data
  const users = loadSampleUsers();
  const slugs = extractSlugs(users);
  
  if (slugs.length === 0) {
    console.error('No valid slugs found in user objects. Exiting.');
    process.exit(1);
  }
  
  // Calculate timing based on concurrent requests
  const batchesPerSecond = CONFIG.requestsPerSecond / CONFIG.concurrentRequests;
  const delayBetweenBatches = batchesPerSecond > 0 ? 1000 / batchesPerSecond : 0;
  
  const startTime = Date.now();
  
  console.log(`\nStarting load test with ${slugs.length} slugs...`);
  console.log(`Testing: ${serviceName}`);
  console.log(`Request frequency: ${CONFIG.requestsPerSecond} requests/second`);
  console.log(`Concurrent requests per batch: ${CONFIG.concurrentRequests}`);
  console.log(`Batches per second: ${batchesPerSecond.toFixed(2)}`);
  console.log(`Delay between batches: ${delayBetweenBatches.toFixed(2)}ms`);
  
  if (CONFIG.testDurationSeconds > 0) {
    console.log(`Test duration: ${CONFIG.testDurationSeconds} seconds`);
    
    // Run for specified duration with concurrent requests
    const endTime = startTime + (CONFIG.testDurationSeconds * 1000);
    
    while (Date.now() < endTime) {
      await sendConcurrentRequestsForDuration(slugs, endTime);
      
      if (Date.now() < endTime && delayBetweenBatches > 0) {
        await sleep(delayBetweenBatches);
      }
    }
  } else {
    // Run through all slugs with concurrent batches
    let currentIndex = 0;
    
    while (currentIndex < slugs.length) {
      await sendConcurrentRequests(slugs, currentIndex, CONFIG.concurrentRequests);
      currentIndex += CONFIG.concurrentRequests;
      
      // Don't sleep after the last batch
      if (currentIndex < slugs.length && delayBetweenBatches > 0) {
        await sleep(delayBetweenBatches);
      }
    }
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`\nLoad test completed in ${(totalTime / 1000).toFixed(2)} seconds`);
  
  displayStats();
}

// Handle command line arguments for configuration overrides
process.argv.slice(2).forEach(arg => {
  const [key, value] = arg.split('=');
  if (key && value && CONFIG.hasOwnProperty(key.replace('--', ''))) {
    const configKey = key.replace('--', '');
    // Handle boolean and string values appropriately
    if (configKey === 'testTarget') {
      CONFIG[configKey] = value;
    } else {
      CONFIG[configKey] = isNaN(value) ? value : Number(value);
    }
  }
});

// Run the load test
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, CONFIG }; 