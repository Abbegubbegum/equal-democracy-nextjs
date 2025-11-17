/**
 * Migration Script: Convert BudgetVote and BudgetResult sessionId from ObjectId to String
 *
 * This script migrates existing budget votes and results to use the new string-based
 * sessionId format (e.g., "vallentuna-2025") instead of MongoDB ObjectIds.
 *
 * Run with: node scripts/migrate-budget-sessionids.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get collections
    const budgetSessions = db.collection('budgetsessions');
    const budgetVotes = db.collection('budgetvotes');
    const budgetResults = db.collection('budgetresults');

    // 1. Check for votes with ObjectId sessionId
    const votesWithObjectId = await budgetVotes.find({
      sessionId: { $type: 'objectId' }
    }).toArray();

    console.log(`\n📊 Found ${votesWithObjectId.length} votes with ObjectId sessionId`);

    // 2. Migrate votes
    let voteMigrationCount = 0;
    for (const vote of votesWithObjectId) {
      // Find the corresponding budget session
      const session = await budgetSessions.findOne({ _id: vote.sessionId });

      if (session && session.sessionId) {
        // Update vote with string sessionId
        await budgetVotes.updateOne(
          { _id: vote._id },
          { $set: { sessionId: session.sessionId } }
        );
        voteMigrationCount++;
        console.log(`  ✓ Migrated vote ${vote._id} to sessionId: ${session.sessionId}`);
      } else {
        console.log(`  ⚠️ Could not find session for vote ${vote._id}, deleting orphaned vote...`);
        await budgetVotes.deleteOne({ _id: vote._id });
      }
    }

    console.log(`\n✅ Migrated ${voteMigrationCount} votes`);

    // 3. Check for results with ObjectId sessionId
    const resultsWithObjectId = await budgetResults.find({
      sessionId: { $type: 'objectId' }
    }).toArray();

    console.log(`\n📊 Found ${resultsWithObjectId.length} results with ObjectId sessionId`);

    // 4. Migrate results
    let resultMigrationCount = 0;
    for (const result of resultsWithObjectId) {
      // Find the corresponding budget session
      const session = await budgetSessions.findOne({ _id: result.sessionId });

      if (session && session.sessionId) {
        // Update result with string sessionId
        await budgetResults.updateOne(
          { _id: result._id },
          { $set: { sessionId: session.sessionId } }
        );
        resultMigrationCount++;
        console.log(`  ✓ Migrated result ${result._id} to sessionId: ${session.sessionId}`);
      } else {
        console.log(`  ⚠️ Could not find session for result ${result._id}, deleting orphaned result...`);
        await budgetResults.deleteOne({ _id: result._id });
      }
    }

    console.log(`\n✅ Migrated ${resultMigrationCount} results`);

    // 5. Verify migration
    const remainingVotesWithObjectId = await budgetVotes.countDocuments({
      sessionId: { $type: 'objectId' }
    });

    const remainingResultsWithObjectId = await budgetResults.countDocuments({
      sessionId: { $type: 'objectId' }
    });

    console.log('\n📊 Migration Summary:');
    console.log(`  Votes migrated: ${voteMigrationCount}`);
    console.log(`  Results migrated: ${resultMigrationCount}`);
    console.log(`  Remaining votes with ObjectId: ${remainingVotesWithObjectId}`);
    console.log(`  Remaining results with ObjectId: ${remainingResultsWithObjectId}`);

    if (remainingVotesWithObjectId === 0 && remainingResultsWithObjectId === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️ Some documents still have ObjectId sessionId');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run migration
migrate();
