import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, onAuthStateChanged,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig, REQUIRE_EMAIL_VERIFICATION } from "../firebase/firebase-config.js";

export const configured = !firebaseConfig.apiKey.startsWith("YOUR_");
let app, auth, db;
if (configured) { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); }
export { auth, db, REQUIRE_EMAIL_VERIFICATION, onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp };

const MSG = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
  "auth/weak-password": "Choose a stronger password.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network problem. Check your connection and try again.",
  "auth/requires-recent-login": "Log in again to continue."
};
export const friendly = (e) => MSG[e && e.code] || "Something went wrong. Please try again.";

export function passwordProblems(p) {
  const out = [];
  if (p.length < 8) out.push("at least 8 characters");
  if (!/[A-Z]/.test(p)) out.push("an uppercase letter");
  if (!/[a-z]/.test(p)) out.push("a lowercase letter");
  if (!/[0-9]/.test(p)) out.push("a number");
  if (!/[^A-Za-z0-9]/.test(p)) out.push("a special character");
  return out;
}

export async function signUp({ name, username, email, password, phone, country }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    name, username, email, phone: phone || "", country: country || "",
    role: "Student", createdAt: serverTimestamp()
  });
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function logIn(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}
export const logOut = () => signOut(auth);
export const resendVerification = () => sendEmailVerification(auth.currentUser);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

// Route guard. Real protection still comes from Firestore rules.
export function requireAuth(cb) {
  if (!configured) { location.replace("login.html"); return; }
  onAuthStateChanged(auth, (u) => {
    if (!u) return location.replace("login.html");
    if (REQUIRE_EMAIL_VERIFICATION && !u.emailVerified) return location.replace("verify-email.html");
    cb(u);
  });
}

export function setupBanner() {
  if (configured) return;
  const b = document.createElement("div");
  b.className = "banner";
  b.textContent = "Firebase isn't connected yet. Paste your config into firebase/firebase-config.js (see README).";
  document.body.prepend(b);
}
export function showMsg(el, text, kind = "error") { el.textContent = text; el.className = "msg " + kind; el.hidden = !text; }
export function busy(btn, on, label) { btn.disabled = on; btn.dataset.l = btn.dataset.l || btn.textContent; btn.textContent = on ? label : btn.dataset.l; }
export function wirePasswordToggles() {
  document.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const i = document.getElementById(b.dataset.toggle);
    i.type = i.type === "password" ? "text" : "password";
    b.textContent = i.type === "password" ? "Show" : "Hide";
  }));
}
