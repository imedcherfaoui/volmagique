// quick-firestore-test.js
const { Firestore, Timestamp } = require("@google-cloud/firestore");
const db = new Firestore({ projectId: "volmagique-b1e7b" });

(async () => {
  await db.collection("deals").doc("test_write").set({
    city: "TEST",
    price: 42,
    createdAt: Timestamp.now(),
  });
  console.log("✔︎ Firestore write succeeded");
})();
