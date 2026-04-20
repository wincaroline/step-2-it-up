<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cd2deb43-875b-4e08-9064-f4626291dd45

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Admin Feedback Summary (Cloud Function)

This project includes an admin-only callable Cloud Function: `getFeedbackSummary`.

It reads `feedbackReports` from Firestore and returns:
- total reports
- totals by category (`bug`, `request`, `feedback`)
- unique user count
- top repeated keywords across descriptions
- recent report previews

### One-time setup

1. Install Functions deps:
   `npm run functions:install`
2. Deploy:
   `npm run deploy:functions`

### Admin access requirement

The caller must be signed in and have a Firebase Auth custom claim:
- `admin: true`

Example (run in a trusted environment with Firebase Admin SDK):
- `admin.auth().setCustomUserClaims(uid, { admin: true })`

### Calling from frontend code

Use Firebase Functions client SDK to call:
- `httpsCallable(functions, 'getFeedbackSummary')`

If the user is not an admin, the function returns `permission-denied`.
