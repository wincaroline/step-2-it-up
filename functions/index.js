const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FEEDBACK_COLLECTION = "feedbackReports";
const MAX_DOCS_TO_SCAN = 1000;
const RECENT_ITEMS_LIMIT = 12;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "with",
  "you",
  "your",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function safeDate(value) {
  try {
    if (value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
  } catch {
    // noop
  }
  return null;
}

exports.getFeedbackSummary = onCall(
  {
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    if (request.auth.token.admin !== true) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const querySnap = await db
      .collection(FEEDBACK_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(MAX_DOCS_TO_SCAN)
      .get();

    const totals = {
      all: 0,
      bug: 0,
      request: 0,
      feedback: 0,
      unknown: 0,
    };
    const tokenCounts = new Map();
    const recent = [];
    const uniqueUserIds = new Set();

    for (const doc of querySnap.docs) {
      const data = doc.data() || {};
      const category = typeof data.category === "string" ? data.category : "unknown";
      const description = typeof data.description === "string" ? data.description.trim() : "";
      const uid = typeof data.uid === "string" ? data.uid : "";

      totals.all += 1;
      if (category === "bug" || category === "request" || category === "feedback") {
        totals[category] += 1;
      } else {
        totals.unknown += 1;
      }
      if (uid) uniqueUserIds.add(uid);

      for (const token of tokenize(description)) {
        tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
      }

      if (recent.length < RECENT_ITEMS_LIMIT) {
        recent.push({
          id: doc.id,
          category,
          uid: uid || null,
          createdAt: safeDate(data.createdAt),
          descriptionPreview: description.slice(0, 220),
        });
      }
    }

    const topKeywords = [...tokenCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    logger.info("Feedback summary generated", {
      callerUid: request.auth.uid,
      totalScanned: querySnap.size,
    });

    return {
      scannedCount: querySnap.size,
      isTruncated: querySnap.size >= MAX_DOCS_TO_SCAN,
      uniqueUsers: uniqueUserIds.size,
      totals,
      topKeywords,
      recent,
    };
  }
);
