import { auth, db, doc, getDoc, setDoc, serverTimestamp } from "./auth.js";
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword, updateProfile, deleteUser }
  from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function loadProfile(uid) { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : {}; }
export async function saveProfile(uid, data) {
  await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  if (data.name) await updateProfile(auth.currentUser, { displayName: data.name });
}
async function reauth(password) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
}
export async function changePassword(current, next) { await reauth(current); await updatePassword(auth.currentUser, next); }
export async function deleteAccount(password) {
  const u = auth.currentUser; await reauth(password);
  const snap = await getDocs(collection(db, "users", u.uid, "projects"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "users", u.uid));
  await deleteUser(u);
}
const pcol = (uid) => collection(db, "users", uid, "projects");
export async function listProjects(uid) {
  const s = await getDocs(query(pcol(uid), orderBy("updatedAt", "desc")));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const createProject = (uid, name, garmentType) =>
  addDoc(pcol(uid), { name, garmentType, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
export const renameProject = (uid, id, name) =>
  updateDoc(doc(db, "users", uid, "projects", id), { name, updatedAt: serverTimestamp() });
export const removeProject = (uid, id) => deleteDoc(doc(db, "users", uid, "projects", id));
