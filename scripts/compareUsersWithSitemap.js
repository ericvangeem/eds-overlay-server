import axios from 'axios';
import xml2js from 'xml2js';
import fs from 'fs/promises';
import path from 'path';

async function fetchSitemap(sitemapUrl) {
    try {
        console.log(`🔍 Fetching sitemap from: ${sitemapUrl}`);
        const response = await axios.get(sitemapUrl);
        const parser = new xml2js.Parser();
        
        // Parse the XML
        const result = await parser.parseStringPromise(response.data);
        
        // Extract URLs from the sitemap
        const urls = result.urlset.url.map(urlObj => urlObj.loc[0]);
        
        console.log(`✅ Found ${urls.length} URLs in sitemap`);
        return urls;
    } catch (error) {
        console.error('❌ Error fetching or parsing sitemap:', error.message);
        throw error;
    }
}

async function loadUsers(filePath) {
    try {
        console.log(`📂 Loading users from: ${filePath}`);
        const data = await fs.readFile(filePath, 'utf8');
        const users = JSON.parse(data);
        
        // Filter out users without slugs
        const usersWithSlugs = users.filter(user => user.slug && user.slug.trim() !== '');
        
        console.log(`✅ Loaded ${users.length} total users, ${usersWithSlugs.length} with valid slugs`);
        return usersWithSlugs;
    } catch (error) {
        console.error('❌ Error loading users:', error.message);
        throw error;
    }
}

function extractSlugsFromUrls(urls, baseUrl) {
    const slugs = new Set();
    
    urls.forEach(url => {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            
            // Handle URLs with /people/ prefix
            // Example: /people/joseph-mejia -> extract joseph-mejia
            const peopleMatch = pathname.match(/^\/people\/([^\/]+)$/);
            if (peopleMatch) {
                const slug = peopleMatch[1];
                if (slug && slug.trim() !== '') {
                    slugs.add(slug);
                }
            } else {
                // Fallback: remove leading and trailing slashes
                const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
                
                // If the path is not empty, it's likely a user slug
                if (cleanPath && cleanPath !== '') {
                    slugs.add(cleanPath);
                }
            }
        } catch (error) {
            console.warn(`⚠️  Could not parse URL: ${url}`);
        }
    });
    
    return Array.from(slugs);
}

function compareUsersWithSitemap(users, sitemapSlugs) {
    const userSlugs = users.map(user => user.slug);
    const sitemapSlugsSet = new Set(sitemapSlugs);
    
    // Find missing users (users that exist but are not in sitemap)
    const missingUsers = users.filter(user => !sitemapSlugsSet.has(user.slug));
    
    // Find extra slugs in sitemap (slugs in sitemap but not in users)
    const userSlugsSet = new Set(userSlugs);
    const extraSlugs = sitemapSlugs.filter(slug => !userSlugsSet.has(slug));
    
    // Find matching users (users that exist in both)
    const matchingUsers = users.filter(user => sitemapSlugsSet.has(user.slug));
    
    return {
        missingUsers,
        extraSlugs,
        matchingUsers,
        stats: {
            totalUsers: users.length,
            totalSitemapSlugs: sitemapSlugs.length,
            missingCount: missingUsers.length,
            extraCount: extraSlugs.length,
            matchingCount: matchingUsers.length
        }
    };
}

async function saveResults(results, outputDir = './output') {
    try {
        // Create output directory if it doesn't exist
        await fs.mkdir(outputDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Save missing users
        if (results.missingUsers.length > 0) {
            const missingUsersPath = path.join(outputDir, `missing-users-${timestamp}.json`);
            await fs.writeFile(missingUsersPath, JSON.stringify(results.missingUsers, null, 2));
            console.log(`💾 Missing users saved to: ${missingUsersPath}`);
        }
        
        // Save extra slugs
        if (results.extraSlugs.length > 0) {
            const extraSlugsPath = path.join(outputDir, `extra-slugs-${timestamp}.json`);
            await fs.writeFile(extraSlugsPath, JSON.stringify(results.extraSlugs, null, 2));
            console.log(`💾 Extra slugs saved to: ${extraSlugsPath}`);
        }
        
        // Save summary report
        const summaryPath = path.join(outputDir, `comparison-summary-${timestamp}.txt`);
        const summary = generateSummary(results);
        await fs.writeFile(summaryPath, summary);
        console.log(`💾 Summary report saved to: ${summaryPath}`);
        
    } catch (error) {
        console.error('❌ Error saving results:', error.message);
    }
}

function generateSummary(results) {
    const { stats, missingUsers, extraSlugs } = results;
    
    let summary = `=== USER VS SITEMAP COMPARISON SUMMARY ===\n\n`;
    summary += `📊 STATISTICS:\n`;
    summary += `   Total Users: ${stats.totalUsers}\n`;
    summary += `   Total Sitemap URLs: ${stats.totalSitemapSlugs}\n`;
    summary += `   Matching Users: ${stats.matchingCount}\n`;
    summary += `   Missing Users: ${stats.missingCount}\n`;
    summary += `   Extra Sitemap Slugs: ${stats.extraCount}\n\n`;
    
    if (missingUsers.length > 0) {
        summary += `❌ MISSING USERS (${missingUsers.length}):\n`;
        missingUsers.forEach((user, index) => {
            summary += `   ${index + 1}. ${user.name || 'Unknown'} (slug: ${user.slug})\n`;
        });
        summary += `\n`;
    }
    
    if (extraSlugs.length > 0) {
        summary += `⚠️  EXTRA SITEMAP SLUGS (${extraSlugs.length}):\n`;
        extraSlugs.forEach((slug, index) => {
            summary += `   ${index + 1}. ${slug}\n`;
        });
        summary += `\n`;
    }
    
    summary += `=== END SUMMARY ===\n`;
    return summary;
}

async function main() {
    try {
        // Get command line arguments
        const sitemapUrl = process.argv[2];
        const usersFilePath = process.argv[3] || './scripts/users.json';
        
        if (!sitemapUrl) {
            console.error('❌ Usage: node compareUsersWithSitemap.js <sitemap-url> [users-file-path]');
            console.error('Example: node compareUsersWithSitemap.js https://yoursite.com/sitemap.xml ./scripts/users.json');
            process.exit(1);
        }
        
        console.log('🚀 Starting user vs sitemap comparison...\n');
        
        // Fetch sitemap and load users in parallel
        const [sitemapUrls, users] = await Promise.all([
            fetchSitemap(sitemapUrl),
            loadUsers(usersFilePath)
        ]);
        
        // Extract slugs from sitemap URLs
        console.log('\n🔍 Extracting slugs from sitemap URLs...');
        const sitemapSlugs = extractSlugsFromUrls(sitemapUrls, sitemapUrl);
        console.log(`✅ Extracted ${sitemapSlugs.length} unique slugs from sitemap`);
        
        // Compare users with sitemap
        console.log('\n🔍 Comparing users with sitemap...');
        const results = compareUsersWithSitemap(users, sitemapSlugs);
        
        // Print results
        console.log('\n📊 COMPARISON RESULTS:');
        console.log(`   Total Users: ${results.stats.totalUsers}`);
        console.log(`   Total Sitemap URLs: ${results.stats.totalSitemapSlugs}`);
        console.log(`   ✅ Matching Users: ${results.stats.matchingCount}`);
        console.log(`   ❌ Missing Users: ${results.stats.missingCount}`);
        console.log(`   ⚠️  Extra Sitemap Slugs: ${results.stats.extraCount}`);
        
        if (results.missingUsers.length > 0) {
            console.log('\n❌ MISSING USERS:');
            results.missingUsers.slice(0, 10).forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.name || 'Unknown'} (slug: ${user.slug})`);
            });
            if (results.missingUsers.length > 10) {
                console.log(`   ... and ${results.missingUsers.length - 10} more`);
            }
        }
        
        if (results.extraSlugs.length > 0) {
            console.log('\n⚠️  EXTRA SITEMAP SLUGS:');
            results.extraSlugs.slice(0, 10).forEach((slug, index) => {
                console.log(`   ${index + 1}. ${slug}`);
            });
            if (results.extraSlugs.length > 10) {
                console.log(`   ... and ${results.extraSlugs.length - 10} more`);
            }
        }
        
        // Save results to files
        console.log('\n💾 Saving results to files...');
        await saveResults(results);
        
        console.log('\n✅ Comparison complete!');
        
    } catch (error) {
        console.error('❌ Error in main process:', error.message);
        process.exit(1);
    }
}

// Run the script
main(); 