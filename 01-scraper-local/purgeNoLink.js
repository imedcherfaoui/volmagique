/**
 * One‐off script: delete all docs in "deals" with no "link" field.
 */
import { Firestore } from "@google-cloud/firestore";

// Assumes GOOGLE_APPLICATION_CREDENTIALS is set to runner-sa.json
const db = new Firestore({ projectId: "volmagique-b1e7b" });

(async () => {
  const snap = await db.collection("deals").get();
  let deleted = 0;
  for (const doc of snap.docs) {
    // doc.data().link will be undefined if missing
    if (doc.get("link") === undefined) {
      await doc.ref.delete();
      console.log("Deleted:", doc.id);
      deleted++;
    }
  }
  console.log(`Done. Deleted ${deleted} docs without links.`);
  process.exit(0);
})().catch((err) => {
  console.error("Error purging docs:", err);
  process.exit(1);
});
