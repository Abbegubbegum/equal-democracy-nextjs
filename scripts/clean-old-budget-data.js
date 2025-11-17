/**
 * Cleanup Script: Remove old budget votes and results with ObjectId sessionId
 *
 * This script removes all budget votes and results that still use the old
 * ObjectId format for sessionId. Use this if you want a fresh start.
 *
 * Run with: node scripts/clean-old-budget-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function cleanup() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get collections
    const budgetVotes = db.collection('budgetvotes');
    const budgetResults = db.collection('budgetresults');

    // 1. Delete votes with ObjectId sessionId
    const votesDeleted = await budgetVotes.deleteMany({
      sessionId: { $type: 'objectId' }
    });

    console.log(`\n🗑️  Deleted ${votesDeleted.deletedCount} votes with old ObjectId format`);

    // 2. Delete results with ObjectId sessionId
    const resultsDeleted = await budgetResults.deleteMany({
      sessionId: { $type: 'objectId' }
    });

    console.log(`🗑️  Deleted ${resultsDeleted.deletedCount} results with old ObjectId format`);

    // 3. Verify cleanup
    const remainingVotesWithObjectId = await budgetVotes.countDocuments({
      sessionId: { $type: 'objectId' }
    });

    const remainingResultsWithObjectId = await budgetResults.countDocuments({
      sessionId: { $type: 'objectId' }
    });

    console.log('\n📊 Cleanup Summary:');
    console.log(`  Votes deleted: ${votesDeleted.deletedCount}`);
    console.log(`  Results deleted: ${resultsDeleted.deletedCount}`);
    console.log(`  Remaining votes with ObjectId: ${remainingVotesWithObjectId}`);
    console.log(`  Remaining results with ObjectId: ${remainingResultsWithObjectId}`);

    if (remainingVotesWithObjectId === 0 && remainingResultsWithObjectId === 0) {
      console.log('\n✅ Cleanup completed successfully!');
      console.log('   All old data has been removed. You can now use the new sessionId format.');
    } else {
      console.log('\n⚠️ Some documents still have ObjectId sessionId');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run cleanup
cleanup();
