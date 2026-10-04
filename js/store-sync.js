/* ============================================================
   Shriman Collection — Firebase connection (loaded by store.js)
   1) Paste your Firebase config below (Firebase Console ->
      Project settings -> Your apps -> SDK setup and configuration).
   2) Nothing else needs changing in this file.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8jzZyPwIqZXBWRqAAdbQWtHDIJBbOwSk",
  authDomain: "shriman-collection.firebaseapp.com",
  projectId: "shriman-collection",
  storageBucket: "shriman-collection.firebasestorage.app",
  messagingSenderId: "555393217684",
  appId: "1:555393217684:web:b18b971720f11353cab081"
};

if (String(firebaseConfig.apiKey).indexOf("PASTE") === 0) {
  throw new Error("Firebase config is not filled in js/store-sync.js");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const S = window.Store._x;

const authReady = new Promise(function (resolve) {
  const stop = onAuthStateChanged(auth, function () { stop(); resolve(); });
});

const onAdminPage = /\/admin\//.test(location.pathname);

function friendlyError(e) {
  const code = (e && e.code) || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].indexOf(code) > -1) return "Invalid email or password.";
  if (code === "auth/email-already-in-use") return "An account with this email already exists.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "auth/network-request-failed") return "Network problem. Check your internet and try again.";
  return "Something went wrong. Please try again.";
}

async function makeSession(user, forceRefresh) {
  const tok = await user.getIdTokenResult(!!forceRefresh);
  return {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || (user.email || "Customer").split("@")[0],
    admin: !!tok.claims.admin
  };
}

/* ---------------- sending saved changes (outbox) to Firestore ---------------- */
let flushing = false;

function withTimeout(p, ms) {
  return new Promise(function (resolve, reject) {
    const t = setTimeout(function () { reject({ code: "sc/timeout" }); }, ms);
    p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}

async function applyOp(e) {
  const ref = doc(db, e.col, e.id);
  if (e.op === "set") await setDoc(ref, e.data);
  else if (e.op === "update") await updateDoc(ref, e.data);
  else if (e.op === "delete") await deleteDoc(ref);
}

function removeFromOutbox(qid) {
  S.writeOutbox(S.readOutbox().filter(function (x) { return x.qid !== qid; }));
}

let alerted = false;
function reportFailure(err, e) {
  console.error("[Store] could not save", e.col + "/" + e.id, err);
  if (onAdminPage && !alerted) {
    alerted = true;
    alert("Could not save a change to the server (" + ((err && err.code) || "error") + "). Please log in again as admin and retry.");
  }
}

export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    await authReady;
    const queue = S.readOutbox();
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i];
      const cur = auth.currentUser;
      const curUid = cur ? cur.uid : null;
      const sess = S.readSession();

      if (Date.now() - (e.ts || 0) > 7 * 24 * 3600 * 1000) { removeFromOutbox(e.qid); continue; }   // too old: forget it
      if (e.by && e.by !== curUid) continue;                  // belongs to someone who is not logged in right now: wait
      if (!e.by && sess && sess.admin) continue;              // visitor's change must never be sent with admin rights

      try {
        await withTimeout(applyOp(e), 15000);
        removeFromOutbox(e.qid);
      } catch (err) {
        const code = (err && err.code) || "";
        if (code === "sc/timeout" || code === "unavailable" || code === "deadline-exceeded") break; // network: try again later
        removeFromOutbox(e.qid);   // permanent problem: drop it so it can't block the queue
        reportFailure(err, e);
      }
    }
  } finally {
    flushing = false;
  }
}

/* ---------------- loading data from Firestore ---------------- */
async function seedIfNeeded() {
  if (typeof DEFAULT_PRODUCTS === "undefined") return;   // data.js not on this page
  const flag = await getDoc(doc(db, "settings", "seeded"));
  if (flag.exists()) return;
  const batch = writeBatch(db);
  DEFAULT_PRODUCTS.forEach(function (p) {
    batch.set(doc(db, "products", p.id), JSON.parse(JSON.stringify(p)));
  });
  if (typeof CATEGORY_LIST !== "undefined") batch.set(doc(db, "settings", "categories"), { list: CATEGORY_LIST.slice() });
  if (typeof DEFAULT_OFFERS !== "undefined") {
    DEFAULT_OFFERS.forEach(function (o) { batch.set(doc(db, "offers", o.id), JSON.parse(JSON.stringify(o))); });
  }
  batch.set(doc(db, "settings", "seeded"), { at: Date.now() });
  await batch.commit();
}

function byDateDesc(a, b) { return String(b.date || "").localeCompare(String(a.date || "")); }

async function fetchAll(user, admin) {
  if (admin) await seedIfNeeded();

  const results = await Promise.all([
    getDocs(collection(db, "products")),
    getDoc(doc(db, "settings", "categories")),
    getDocs(collection(db, "offers")),
    getDocs(collection(db, "categoryImages")),
    admin
      ? getDocs(collection(db, "reviews"))
      : getDocs(query(collection(db, "reviews"), where("approved", "==", true), limit(60))),
    admin
      ? getDocs(collection(db, "orders"))
      : (user ? getDocs(query(collection(db, "orders"), where("uid", "==", user.uid))) : null),
    admin ? getDocs(collection(db, "enquiries")) : null
  ]);
  const pSnap = results[0], cSnap = results[1], oSnap = results[2], iSnap = results[3],
        rSnap = results[4], ordSnap = results[5], enqSnap = results[6];

  const d = {};
  d.products = pSnap.docs.map(function (x) { const v = x.data(); if (!v.id) v.id = x.id; return v; });
  d.categories = cSnap.exists() && Array.isArray(cSnap.data().list) ? cSnap.data().list : null;
  if (d.categories === null) delete d.categories;
  d.offers = oSnap.docs.map(function (x) { const v = x.data(); if (!v.id) v.id = x.id; return v; });

  d.categoryImages = {};
  iSnap.docs.forEach(function (x) { const v = x.data(); if (v.name) d.categoryImages[v.name] = v.src; });

  d.reviews = {};
  rSnap.docs.forEach(function (x) {
    const v = S.sanitize(x.data());
    v._id = x.id;
    if (!v.productId) return;
    (d.reviews[v.productId] = d.reviews[v.productId] || []).push(v);
  });
  Object.keys(d.reviews).forEach(function (pid) { d.reviews[pid].sort(byDateDesc); });

  d.orders = ordSnap ? ordSnap.docs.map(function (x) { return S.sanitize(x.data()); }).sort(byDateDesc) : [];
  d.enquiries = enqSnap ? enqSnap.docs.map(function (x) { return S.sanitize(x.data()); }).sort(byDateDesc) : [];
  return d;
}

/* Reads everything from Firebase and stores it in the local cache. */
export async function refreshAll() {
  await authReady;
  let user = auth.currentUser;
  let session = S.readSession();

  if (localStorage.getItem(S.K.signout) === "1") {
    if (user) await signOut(auth);
    localStorage.removeItem(S.K.signout);
    user = null; session = null; S.writeSession(null);
  }
  if (!user && session) { session = null; S.writeSession(null); }
  if (user && (!session || session.uid !== user.uid)) {
    session = await makeSession(user, true);
    S.writeSession(session);
  }

  await flush();
  const admin = !!(session && session.admin);
  const d = await fetchAll(user, admin);
  S.setCache({ t: Date.now(), uid: user ? user.uid : null, admin: admin, d: d });
}

/* ---------------- login / signup / logout ---------------- */
export async function signup(name, email, password) {
  try {
    localStorage.removeItem(S.K.signout);
    const cred = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
    const cleanName = String(name || "").trim();
    if (cleanName) await updateProfile(cred.user, { displayName: cleanName });
    S.writeSession(await makeSession(cred.user, true));
    await refreshAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function login(email, password) {
  try {
    localStorage.removeItem(S.K.signout);
    const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
    S.writeSession(await makeSession(cred.user, true));
    await refreshAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function adminLogin(email, password) {
  try {
    localStorage.removeItem(S.K.signout);
    const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
    const session = await makeSession(cred.user, true);
    if (!session.admin) {
      await signOut(auth);
      S.writeSession(null);
      return { ok: false, error: "This account does not have admin access." };
    }
    S.writeSession(session);
    await refreshAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, String(email).trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function signOutNow() {
  await authReady;
  try { flushing = false; await withTimeout(flush(), 5000); } catch (e) {}   // send pending changes first
  if (auth.currentUser) await signOut(auth);
  localStorage.removeItem(S.K.signout);
}

/* ---------------- runs quietly on every page ---------------- */
function reloadOnce() {
  const key = "sc_fb_recon";
  let last = 0;
  try { last = Number(sessionStorage.getItem(key) || 0); } catch (e) {}
  if (Date.now() - last < 15000) return;
  try { sessionStorage.setItem(key, String(Date.now())); } catch (e) {}
  location.reload();
}

export async function background() {
  await authReady;
  const user = auth.currentUser;
  const session = S.readSession();

  if (localStorage.getItem(S.K.signout) === "1") {
    if (user) await signOut(auth);
    localStorage.removeItem(S.K.signout);
    return;
  }
  if (!user && session) {            // login expired or signed out somewhere else
    S.writeSession(null);
    S.dropPersonal();
    if (onAdminPage) location.href = "login.html"; else reloadOnce();
    return;
  }
  if (user && (!session || session.uid !== user.uid)) {
    S.writeSession(await makeSession(user, true));
    reloadOnce();
    return;
  }
  if (user && session && session.admin) {   // admin rights removed? log out of admin view
    const tok = await user.getIdTokenResult();
    if (!tok.claims.admin) {
      S.writeSession(await makeSession(user, true));
      if (onAdminPage) location.href = "login.html";
      return;
    }
  }

  await flush();
  const c = S.getCache();
  if (!c || !c.t || Date.now() - c.t > S.PUBLIC_TTL) await refreshAll();
}
