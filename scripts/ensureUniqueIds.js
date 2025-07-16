import fs from 'fs/promises';
import path from 'path';

/**
 * Generates a unique ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} - A unique ID
 */
function generateUniqueId(prefix = 'user') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validates if an ID is valid (not empty, not null, not undefined)
 * @param {any} id - The ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidId(id) {
    return id !== null && id !== undefined && id !== '' && String(id).trim() !== '';
}

/**
 * Ensures all users have unique IDs
 * @param {Array} users - Array of user objects
 * @returns {Object} - Results of ID validation and fixing
 */
function ensureUniqueIds(users) {
    const results = {
        valid: [],
        missing: [],
        duplicates: [],
        fixed: [],
        stats: {
            total: users.length,
            valid: 0,
            missing: 0,
            duplicates: 0,
            fixed: 0
        }
    };
    
    // Track used IDs to detect duplicates
    const usedIds = new Set();
    const duplicateGroups = new Map(); // Group users by their ID
    
    // First pass: collect all users by ID
    users.forEach((user, index) => {
        const userId = user.id;
        
        if (!isValidId(userId)) {
            // Missing or invalid ID
            results.missing.push({
                user,
                index,
                originalId: userId,
                reason: 'Missing or invalid ID'
            });
            results.stats.missing++;
        } else {
            const idString = String(userId);
            
            // Group users by ID
            if (!duplicateGroups.has(idString)) {
                duplicateGroups.set(idString, []);
            }
            duplicateGroups.get(idString).push({
                user,
                index,
                originalId: idString
            });
        }
    });
    
    // Second pass: categorize as valid or duplicate
    duplicateGroups.forEach((userGroup, idString) => {
        if (userGroup.length === 1) {
            // Unique ID
            results.valid.push(userGroup[0]);
            results.stats.valid++;
        } else {
            // Duplicate ID - keep first, fix the rest
            results.stats.duplicates += userGroup.length - 1;
        }
    });
    
    // Reset valid count to actual count
    results.stats.valid = results.valid.length;
    
    // Second pass: fix missing and duplicate IDs
    let newIdCounter = 1;
    
    // Fix missing IDs
    results.missing.forEach(item => {
        const newId = generateUniqueId();
        const fixedUser = { ...item.user, id: newId };
        
        results.fixed.push({
            user: fixedUser,
            index: item.index,
            originalId: item.originalId,
            newId: newId,
            reason: 'Missing ID assigned'
        });
        results.stats.fixed++;
    });
    
    // Fix duplicate IDs
    duplicateGroups.forEach((duplicateUsers, duplicateId) => {
        // Keep the first user with this ID as is
        const firstUser = duplicateUsers[0];
        results.valid.push({
            user: firstUser.user,
            index: firstUser.index,
            originalId: firstUser.originalId
        });
        results.stats.valid++;
        
        // Fix the rest
        duplicateUsers.slice(1).forEach(duplicateUser => {
            const newId = generateUniqueId();
            const fixedUser = { ...duplicateUser.user, id: newId };
            
            results.fixed.push({
                user: fixedUser,
                index: duplicateUser.index,
                originalId: duplicateUser.originalId,
                newId: newId,
                reason: 'Duplicate ID fixed'
            });
            results.stats.fixed++;
        });
    });
    
    // Add duplicate users to the duplicates array for reporting
    duplicateGroups.forEach((duplicateUsers, duplicateId) => {
        duplicateUsers.slice(1).forEach(duplicateUser => {
            results.duplicates.push({
                user: duplicateUser.user,
                index: duplicateUser.index,
                originalId: duplicateUser.originalId
            });
        });
    });
    
    return results;
}

/**
 * Generates a summary report
 * @param {Object} results - ID validation results
 * @returns {string} - Summary text
 */
function generateSummary(results) {
    const { stats, missing, duplicates, fixed } = results;
    
    let summary = `=== UNIQUE ID VALIDATION SUMMARY ===\n\n`;
    summary += `📊 STATISTICS:\n`;
    summary += `   Total Users: ${stats.total}\n`;
    summary += `   ✅ Valid IDs: ${stats.valid}\n`;
    summary += `   ❌ Missing IDs: ${stats.missing}\n`;
    summary += `   🔄 Duplicate IDs: ${stats.duplicates}\n`;
    summary += `   🔧 Fixed IDs: ${stats.fixed}\n\n`;
    
    if (missing.length > 0) {
        summary += `❌ MISSING/INVALID IDS (${missing.length}):\n`;
        missing.slice(0, 20).forEach((item, index) => {
            summary += `   ${index + 1}. ${item.user.name || 'Unknown'} (ID: ${item.originalId || 'null'})\n`;
            summary += `      → Reason: ${item.reason}\n`;
        });
        if (missing.length > 20) {
            summary += `   ... and ${missing.length - 20} more\n`;
        }
        summary += `\n`;
    }
    
    if (duplicates.length > 0) {
        summary += `🔄 DUPLICATE IDS (${duplicates.length}):\n`;
        duplicates.slice(0, 20).forEach((item, index) => {
            summary += `   ${index + 1}. ${item.user.name || 'Unknown'} (ID: ${item.originalId})\n`;
        });
        if (duplicates.length > 20) {
            summary += `   ... and ${duplicates.length - 20} more\n`;
        }
        summary += `\n`;
    }
    
    if (fixed.length > 0) {
        summary += `🔧 FIXED IDS (${fixed.length}):\n`;
        fixed.slice(0, 20).forEach((item, index) => {
            summary += `   ${index + 1}. ${item.user.name || 'Unknown'}\n`;
            summary += `      ${item.originalId || 'null'} → ${item.newId}\n`;
            summary += `      → Reason: ${item.reason}\n`;
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
 * @param {Object} results - ID validation results
 * @param {string} outputDir - Output directory
 */
async function saveResults(results, outputDir = './output') {
    try {
        await fs.mkdir(outputDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Save missing IDs
        if (results.missing.length > 0) {
            const missingPath = path.join(outputDir, `missing-ids-${timestamp}.json`);
            await fs.writeFile(missingPath, JSON.stringify(results.missing, null, 2));
            console.log(`💾 Missing IDs saved to: ${missingPath}`);
        }
        
        // Save duplicate IDs
        if (results.duplicates.length > 0) {
            const duplicatesPath = path.join(outputDir, `duplicate-ids-${timestamp}.json`);
            await fs.writeFile(duplicatesPath, JSON.stringify(results.duplicates, null, 2));
            console.log(`💾 Duplicate IDs saved to: ${duplicatesPath}`);
        }
        
        // Save fixed users
        if (results.fixed.length > 0) {
            const fixedPath = path.join(outputDir, `fixed-users-${timestamp}.json`);
            const fixedUsers = results.fixed.map(item => item.user);
            await fs.writeFile(fixedPath, JSON.stringify(fixedUsers, null, 2));
            console.log(`💾 Fixed users saved to: ${fixedPath}`);
        }
        
        // Save summary
        const summaryPath = path.join(outputDir, `unique-id-summary-${timestamp}.txt`);
        const summary = generateSummary(results);
        await fs.writeFile(summaryPath, summary);
        console.log(`💾 Summary saved to: ${summaryPath}`);
        
    } catch (error) {
        console.error('❌ Error saving results:', error.message);
    }
}

/**
 * Finds duplicate ID groups for detailed reporting
 * @param {Array} users - Array of user objects
 * @returns {Map} - Groups of users with duplicate IDs
 */
function findDuplicateGroups(users) {
    const idGroups = new Map();
    
    users.forEach((user, index) => {
        const userId = user.id;
        if (isValidId(userId)) {
            const idString = String(userId);
            if (!idGroups.has(idString)) {
                idGroups.set(idString, []);
            }
            idGroups.get(idString).push({ user, index });
        }
    });
    
    // Filter to only groups with more than one user
    const duplicateGroups = new Map();
    idGroups.forEach((users, id) => {
        if (users.length > 1) {
            duplicateGroups.set(id, users);
        }
    });
    
    return duplicateGroups;
}

async function main() {
    try {
        const usersFilePath = process.argv[2] || './scripts/users.json';
        const fixIssues = process.argv.includes('--fix');
        const dryRun = process.argv.includes('--dry-run');
        const showDuplicates = process.argv.includes('--show-duplicates');
        
        console.log('🔍 Starting unique ID validation...\n');
        console.log(`📂 Loading users from: ${usersFilePath}`);
        console.log(`🔧 Fix issues: ${fixIssues ? 'Yes' : 'No'}`);
        console.log(`🧪 Dry run: ${dryRun ? 'Yes' : 'No'}\n`);
        
        // Load users
        const data = await fs.readFile(usersFilePath, 'utf8');
        const users = JSON.parse(data);
        
        console.log(`✅ Loaded ${users.length} users`);
        
        // Find duplicate groups for detailed reporting
        const duplicateGroups = findDuplicateGroups(users);
        
        if (showDuplicates && duplicateGroups.size > 0) {
            console.log('\n🔄 DUPLICATE ID GROUPS:');
            duplicateGroups.forEach((userGroup, duplicateId) => {
                console.log(`\n   ID "${duplicateId}" (${userGroup.length} users):`);
                userGroup.forEach((item, index) => {
                    console.log(`     ${index + 1}. ${item.user.name || 'Unknown'} (index: ${item.index})`);
                });
            });
        }
        
        // Validate and optionally fix IDs
        const results = ensureUniqueIds(users);
        
        // Print results
        console.log('\n📊 VALIDATION RESULTS:');
        console.log(`   Total Users: ${results.stats.total}`);
        console.log(`   ✅ Valid IDs: ${results.stats.valid}`);
        console.log(`   ❌ Missing IDs: ${results.stats.missing}`);
        console.log(`   🔄 Duplicate IDs: ${results.stats.duplicates}`);
        console.log(`   🔧 Fixed IDs: ${results.stats.fixed}`);
        
        if (results.missing.length > 0) {
            console.log('\n❌ MISSING/INVALID IDS:');
            results.missing.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.user.name || 'Unknown'}: "${item.originalId || 'null'}"`);
            });
            if (results.missing.length > 10) {
                console.log(`   ... and ${results.missing.length - 10} more`);
            }
        }
        
        if (results.fixed.length > 0) {
            console.log('\n🔧 FIXED IDS:');
            results.fixed.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.user.name || 'Unknown'}: "${item.originalId || 'null'}" → "${item.newId}"`);
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
        if (fixIssues && !dryRun && (results.fixed.length > 0 || results.missing.length > 0)) {
            console.log(`\n🔧 APPLYING FIXES:`);
            console.log(`   Found ${results.fixed.length} users to fix`);
            
            // Create updated users array
            const updatedUsers = users.map((user, index) => {
                // Check if this user was fixed
                const fixedItem = results.fixed.find(item => item.index === index);
                if (fixedItem) {
                    console.log(`   Index ${index}: "${user.id}" → "${fixedItem.user.id}"`);
                    return fixedItem.user;
                }
                return user;
            });
            
            const backupPath = usersFilePath.replace('.json', `.backup-${Date.now()}.json`);
            await fs.writeFile(backupPath, JSON.stringify(users, null, 2));
            console.log(`💾 Backup saved to: ${backupPath}`);
            
            await fs.writeFile(usersFilePath, JSON.stringify(updatedUsers, null, 2));
            console.log(`✅ Updated ${usersFilePath} with unique IDs`);
            console.log(`   Fixed ${results.fixed.length} users with new IDs`);
        }
        
        console.log('\n✅ ID validation complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main(); 