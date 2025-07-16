import fs from 'fs/promises';
import path from 'path';

/**
 * Validates if a slug is safe for URLs
 * @param {string} slug - The slug to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidSlug(slug) {
    if (!slug || typeof slug !== 'string') return false;
    
    // Check for invalid characters that could cause URL issues (including periods)
    const invalidChars = /[<>:"|?*\x00-\x1f.]/;
    if (invalidChars.test(slug)) return false;
    
    // Check for consecutive periods (could be confused with directory traversal)
    if (slug.includes('..')) return false;
    
    // Check for leading/trailing spaces
    if (slug.trim() !== slug) return false;
    
    return true;
}

/**
 * Fixes a slug to make it URL-safe
 * @param {string} slug - The original slug
 * @returns {string} - The fixed slug
 */
function fixSlug(slug) {
    if (!slug || typeof slug !== 'string') return '';
    
    let fixed = slug.trim();
    
    // Replace invalid characters with hyphens
    fixed = fixed.replace(/[<>:"|?*\x00-\x1f]/g, '-');
    
    // Replace periods with hyphens (except for the last one if it looks like a file extension)
    fixed = fixed.replace(/\./g, '-');
    
    // Replace consecutive hyphens with single hyphen
    fixed = fixed.replace(/-+/g, '-');
    
    // Remove leading and trailing hyphens
    fixed = fixed.replace(/^-+|-+$/g, '');
    
    // Convert to lowercase
    fixed = fixed.toLowerCase();
    
    // Replace spaces with hyphens
    fixed = fixed.replace(/\s+/g, '-');
    
    // Remove any remaining invalid characters
    fixed = fixed.replace(/[^a-z0-9\-]/g, '');
    
    // Ensure it's not empty
    if (!fixed) {
        fixed = 'user-' + Math.random().toString(36).substr(2, 9);
    }
    
    return fixed;
}

/**
 * Validates and optionally fixes user slugs
 * @param {Array} users - Array of user objects
 * @param {boolean} fixInvalid - Whether to fix invalid slugs
 * @returns {Object} - Results of validation/fixing
 */
function validateAndFixUserSlugs(users, fixInvalid = false) {
    const results = {
        valid: [],
        invalid: [],
        fixed: [],
        stats: {
            total: users.length,
            valid: 0,
            invalid: 0,
            fixed: 0
        }
    };
    
    users.forEach((user, index) => {
        const originalSlug = user.slug;
        
        if (!originalSlug) {
            results.invalid.push({
                user,
                index,
                originalSlug: null,
                fixedSlug: null,
                reason: 'Missing slug'
            });
            results.stats.invalid++;
            return;
        }
        
        if (isValidSlug(originalSlug)) {
            results.valid.push({
                user,
                index,
                originalSlug,
                fixedSlug: originalSlug
            });
            results.stats.valid++;
        } else {
            const fixedSlug = fixSlug(originalSlug);
            
            if (fixInvalid) {
                // Create a copy of the user with the fixed slug
                const fixedUser = { ...user, slug: fixedSlug };
                results.fixed.push({
                    user: fixedUser,
                    index,
                    originalSlug,
                    fixedSlug,
                    reason: 'Invalid slug fixed'
                });
                results.stats.fixed++;
            } else {
                results.invalid.push({
                    user,
                    index,
                    originalSlug,
                    fixedSlug,
                    reason: 'Invalid slug'
                });
                results.stats.invalid++;
            }
        }
    });
    
    return results;
}

/**
 * Generates a summary report
 * @param {Object} results - Validation results
 * @returns {string} - Summary text
 */
function generateSummary(results) {
    const { stats, invalid, fixed } = results;
    
    let summary = `=== SLUG VALIDATION SUMMARY ===\n\n`;
    summary += `📊 STATISTICS:\n`;
    summary += `   Total Users: ${stats.total}\n`;
    summary += `   ✅ Valid Slugs: ${stats.valid}\n`;
    summary += `   ❌ Invalid Slugs: ${stats.invalid}\n`;
    summary += `   🔧 Fixed Slugs: ${stats.fixed}\n\n`;
    
    if (invalid.length > 0) {
        summary += `❌ INVALID SLUGS (${invalid.length}):\n`;
        invalid.slice(0, 20).forEach((item, index) => {
            summary += `   ${index + 1}. ${item.user.name || 'Unknown'} (${item.originalSlug})\n`;
            summary += `      → Would be fixed to: ${item.fixedSlug}\n`;
            summary += `      → Reason: ${item.reason}\n`;
        });
        if (invalid.length > 20) {
            summary += `   ... and ${invalid.length - 20} more\n`;
        }
        summary += `\n`;
    }
    
    if (fixed.length > 0) {
        summary += `🔧 FIXED SLUGS (${fixed.length}):\n`;
        fixed.slice(0, 20).forEach((item, index) => {
            summary += `   ${index + 1}. ${item.user.name || 'Unknown'}\n`;
            summary += `      ${item.originalSlug} → ${item.fixedSlug}\n`;
        });
        if (fixed.length > 20) {
            summary += `   ... and ${fixed.length - 20} more\n`;
        }
        summary += `\n`;
    }
    
    summary += `=== END SUMMARY ===\n`;
    return summary;
}

/**
 * Saves results to files
 * @param {Object} results - Validation results
 * @param {string} outputDir - Output directory
 */
async function saveResults(results, outputDir = './output') {
    try {
        await fs.mkdir(outputDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Save invalid slugs
        if (results.invalid.length > 0) {
            const invalidPath = path.join(outputDir, `invalid-slugs-${timestamp}.json`);
            await fs.writeFile(invalidPath, JSON.stringify(results.invalid, null, 2));
            console.log(`💾 Invalid slugs saved to: ${invalidPath}`);
        }
        
        // Save fixed users
        if (results.fixed.length > 0) {
            const fixedPath = path.join(outputDir, `fixed-users-${timestamp}.json`);
            const fixedUsers = results.fixed.map(item => item.user);
            await fs.writeFile(fixedPath, JSON.stringify(fixedUsers, null, 2));
            console.log(`💾 Fixed users saved to: ${fixedPath}`);
        }
        
        // Save summary
        const summaryPath = path.join(outputDir, `slug-validation-summary-${timestamp}.txt`);
        const summary = generateSummary(results);
        await fs.writeFile(summaryPath, summary);
        console.log(`💾 Summary saved to: ${summaryPath}`);
        
    } catch (error) {
        console.error('❌ Error saving results:', error.message);
    }
}

async function main() {
    try {
        const usersFilePath = process.argv[2] || './scripts/users.json';
        const fixInvalid = process.argv.includes('--fix');
        const dryRun = process.argv.includes('--dry-run');
        
        console.log('🔍 Starting slug validation...\n');
        console.log(`📂 Loading users from: ${usersFilePath}`);
        console.log(`🔧 Fix invalid slugs: ${fixInvalid ? 'Yes' : 'No'}`);
        console.log(`🧪 Dry run: ${dryRun ? 'Yes' : 'No'}\n`);
        
        // Load users
        const data = await fs.readFile(usersFilePath, 'utf8');
        const users = JSON.parse(data);
        
        console.log(`✅ Loaded ${users.length} users`);
        
        // Validate and optionally fix slugs
        const results = validateAndFixUserSlugs(users, fixInvalid);
        
        // Print results
        console.log('\n📊 VALIDATION RESULTS:');
        console.log(`   Total Users: ${results.stats.total}`);
        console.log(`   ✅ Valid Slugs: ${results.stats.valid}`);
        console.log(`   ❌ Invalid Slugs: ${results.stats.invalid}`);
        console.log(`   🔧 Fixed Slugs: ${results.stats.fixed}`);
        
        if (results.invalid.length > 0) {
            console.log('\n❌ INVALID SLUGS:');
            results.invalid.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.user.name || 'Unknown'}: "${item.originalSlug}"`);
                console.log(`      → Would be fixed to: "${item.fixedSlug}"`);
            });
            if (results.invalid.length > 10) {
                console.log(`   ... and ${results.invalid.length - 10} more`);
            }
        }
        
        if (results.fixed.length > 0) {
            console.log('\n🔧 FIXED SLUGS:');
            results.fixed.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.user.name || 'Unknown'}: "${item.originalSlug}" → "${item.fixedSlug}"`);
            });
            if (results.fixed.length > 10) {
                console.log(`   ... and ${results.fixed.length - 10} more`);
            }
        }
        
        // Save results
        if (!dryRun) {
            console.log('\n💾 Saving results...');
            await saveResults(results);
        } else {
            console.log('\n🧪 Dry run - no files saved');
        }
        
        // Update original file if fixing and not dry run
        if (fixInvalid && !dryRun && results.fixed.length > 0) {
            const updatedUsers = users.map(user => {
                const fixedItem = results.fixed.find(item => item.user.id === user.id);
                return fixedItem ? fixedItem.user : user;
            });
            
            const backupPath = usersFilePath.replace('.json', `.backup-${Date.now()}.json`);
            await fs.writeFile(backupPath, JSON.stringify(users, null, 2));
            console.log(`💾 Backup saved to: ${backupPath}`);
            
            await fs.writeFile(usersFilePath, JSON.stringify(updatedUsers, null, 2));
            console.log(`✅ Updated ${usersFilePath} with fixed slugs`);
        }
        
        console.log('\n✅ Validation complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main(); 