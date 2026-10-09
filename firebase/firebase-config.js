// Paste YOUR Firebase web app config here (Firebase Console > Project settings > Your apps).
// This config is public by design. Security comes from Authentication and Firestore rules.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// Set to false to let users in without verifying their email.
export const REQUIRE_EMAIL_VERIFICATION = true;
