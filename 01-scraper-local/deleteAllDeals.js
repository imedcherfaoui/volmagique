// deleteAllDeals.js
import { Firestore } from "@google-cloud/firestore";

const PROJECT_ID = "volmagique-b1e7b";
const BATCH_SIZE = 500;

const db = new Firestore({ projectId: PROJECT_ID });

/**
 * Recursively delete all documents in a collection in batches.
 * @param {string} collectionPath
 */
async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.limit(BATCH_SIZE).get();

  if (snapshot.empty) {
    console.log(`✅ All documents in '${collectionPath}' have been deleted.`);
    return;
  }

  // Delete this batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(
    `Deleted batch of ${snapshot.size} documents from '${collectionPath}'`
  );

  // Recurse on next batch
  // Give Firestore a moment in case of rate‐limits
  await new Promise((r) => setTimeout(r, 500));
  return deleteCollection(collectionPath);
}

deleteCollection("deals").catch((err) => {
  console.error("Error deleting collection:", err);
  process.exit(1);
});
