/* ============================================================
   Shriman Collection — data layer (Firebase + local cache)

   - Pages call the same synchronous Store.* functions as before.
   - Shared data (products, categories, offers, orders, enquiries,
     reviews) lives in Firebase Firestore. This file keeps a local
     copy (cache) so pages stay fast, and sends every change to
     Firebase in the background (js/store-sync.js does the talking).
   - Login uses Firebase Authentication. Admin = account that has
     the "admin" claim (set once with set-admin.js).
   - Cart and wishlist stay in this browser (localStorage).
   ============================================================ */

var Store = (function () {
  var SYNC_URL = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/store\.js(\?.*)?$/, "store-sync.js") : "js/store-sync.js";
  })();

  var PUBLIC_TTL = 5 * 60 * 1000;   // customers: refresh data in background every 5 min
  var ADMIN_TTL = 15 * 1000;        // admin: always fairly fresh

  var K = {
    cart: "sc_cart",
    wishlist: "sc_wishlist",
    session: "sc_fb_session",
    cache: "sc_fb_cache",
    outbox: "sc_fb_outbox",
    signout: "sc_fb_signout",
    boot: "sc_fb_boot"
  };

  var ORDER_STEPS = ["Placed", "Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"];

  /* ---------------- tiny helpers ---------------- */
  function log() { if (window.console) console.error.apply(console, arguments); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jget(k, fb) { try { var r = lsGet(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
  function jset(k, v) { return lsSet(k, JSON.stringify(v)); }
  function clean(o) { return JSON.parse(JSON.stringify(o)); }   // drops undefined, Infinity, etc.
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function newOrderId() {
    return "SC" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(2, 5);
  }
  function importSync() {
    if (!importSync.p) importSync.p = (window.SC_IMPORT || function (u) { return import(u); })(SYNC_URL);
    return importSync.p;
  }

  /* ---------------- safety: escape text that came from visitors ----------------
     Orders, enquiries and reviews can be written by anyone, so we turn
     < > & " ' into harmless text before any page shows them.           */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  var DATA_IMG = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  function sanitize(v) {
    if (typeof v === "string") return DATA_IMG.test(v) ? v : esc(v);
    if (Array.isArray(v)) return v.map(sanitize);
    if (v && typeof v === "object") {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = sanitize(v[k]); });
      return o;
    }
    return v;
  }

  /* ---------------- session (who is logged in) ---------------- */
  function readSession() { return jget(K.session, null); }
  function writeSession(s) { if (s) jset(K.session, s); else lsDel(K.session); }

  /* ---------------- local cache of Firebase data ---------------- */
  var MEM = null, memLoaded = false;

  function getCache() {
    if (!memLoaded) { MEM = jget(K.cache, null); memLoaded = true; }
    return MEM;
  }

  function stripped(c, level) {
    var x = clean(c);
    var d = x.d || {};
    if (d.reviews) Object.keys(d.reviews).forEach(function (pid) {
      d.reviews[pid].forEach(function (r) { r.photos = []; });
    });
    if (level > 1) d.categoryImages = {};
    return x;
  }

  function setCache(c) {
    MEM = c; memLoaded = true;
    if (jset(K.cache, c)) return;
    if (jset(K.cache, stripped(c, 1))) return;   // too big: drop review photos
    if (jset(K.cache, stripped(c, 2))) return;   // still too big: drop category photos too
    lsDel(K.cache);
  }

  function data() { var c = getCache(); return (c && c.d) || {}; }

  function mutate(fn) {
    var c = getCache();
    if (!c) {
      var s = readSession();
      c = { t: 0, uid: s ? s.uid : null, admin: !!(s && s.admin), d: {} };
    }
    if (!c.d) c.d = {};
    fn(c.d);
    setCache(c);
  }

  function dropPersonal() {
    var c = getCache();
    if (!c) return;
    c.uid = null; c.admin = false;
    c.d = c.d || {};
    c.d.orders = []; c.d.enquiries = [];
    if (c.d.reviews) Object.keys(c.d.reviews).forEach(function (pid) {
      c.d.reviews[pid] = c.d.reviews[pid].filter(function (r) { return r.approved; });
    });
    setCache(c);
  }

  /* ---------------- outbox: changes waiting to be sent to Firebase ---------------- */
  var qSeq = 0;
  function readOutbox() { return jget(K.outbox, []); }
  function writeOutbox(q) { jset(K.outbox, q); }

  function enqueue(ops) {
    if (!ops.length) return;
    var q = readOutbox();
    var who = readSession();
    ops.forEach(function (o) {
      o.qid = Date.now().toString(36) + "-" + (qSeq++) + "-" + Math.random().toString(36).slice(2, 6);
      o.by = who ? who.uid : null;     // who made this change (it is only sent while that same person is logged in)
      o.ts = Date.now();
      q.push(o);
    });
    writeOutbox(q);
    importSync().then(function (m) { return m.flush(); }).catch(function (e) { log("[Store] sync unavailable:", e); });
  }

  function diffOps(col, oldList, newList) {
    var ops = [], oldMap = {}, newIds = {};
    (oldList || []).forEach(function (x) { oldMap[x.id] = x; });
    newList.forEach(function (x) {
      newIds[x.id] = true;
      if (!oldMap[x.id] || JSON.stringify(oldMap[x.id]) !== JSON.stringify(x)) {
        ops.push({ op: "set", col: col, id: x.id, data: clean(x) });
      }
    });
    (oldList || []).forEach(function (x) {
      if (!newIds[x.id]) ops.push({ op: "delete", col: col, id: x.id });
    });
    return ops;
  }

  /* ---------------- Categories ---------------- */
  function getCategories() {
    var c = data().categories;
    if (Array.isArray(c)) return c.slice();
    return typeof CATEGORY_LIST !== "undefined" ? CATEGORY_LIST.slice() : [];
  }

  function saveCategories(list) {
    mutate(function (d) { d.categories = list.slice(); });
    enqueue([{ op: "set", col: "settings", id: "categories", data: { list: clean(list) } }]);
    return true;
  }

  function addCategory(name) {
    name = name.trim();
    if (!name) return { ok: false, error: "Category name can't be empty." };
    var list = getCategories();
    var exists = list.some(function (c) { return c.toLowerCase() === name.toLowerCase(); });
    if (exists) return { ok: false, error: "This category already exists." };
    list.push(name);
    saveCategories(list);
    return { ok: true };
  }

  function catKey(name) { return "c_" + encodeURIComponent(name).replace(/%/g, "_"); }
  function getCategoryImages() { return data().categoryImages || {}; }
  function getCategoryImage(name) { return getCategoryImages()[name] || null; }

  function setCategoryImage(name, src) {
    mutate(function (d) {
      d.categoryImages = d.categoryImages || {};
      if (src) d.categoryImages[name] = src; else delete d.categoryImages[name];
    });
    if (src) enqueue([{ op: "set", col: "categoryImages", id: catKey(name), data: { name: name, src: src } }]);
    else enqueue([{ op: "delete", col: "categoryImages", id: catKey(name) }]);
  }

  function deleteCategory(name) {
    var inUse = getProducts().some(function (p) { return p.category === name; });
    if (inUse) return { ok: false, error: "Can't delete — some products still use this category. Move or delete them first." };
    saveCategories(getCategories().filter(function (c) { return c !== name; }));
    setCategoryImage(name, "");
    return { ok: true };
  }

  /* ---------------- Offers ---------------- */
  function getOffers() {
    var o = data().offers;
    if (Array.isArray(o)) return o.slice();
    return typeof DEFAULT_OFFERS !== "undefined" ? DEFAULT_OFFERS.slice() : [];
  }

  function saveOffers(list) {
    var ops = diffOps("offers", getOffers(), list);
    mutate(function (d) { d.offers = clean(list); });
    enqueue(ops);
  }

  function addOffer(offer) {
    var list = getOffers();
    offer.id = "o" + Date.now();
    if (offer.code) offer.code = offer.code.trim().toUpperCase();
    list.push(offer);
    saveOffers(list);
    return list;
  }

  function deleteOffer(id) {
    var list = getOffers().filter(function (o) { return o.id !== id; });
    saveOffers(list);
    return list;
  }

  function getCouponDiscount(code) {
    if (!code) return null;
    code = code.trim().toUpperCase();
    if (typeof COUPONS !== "undefined" && COUPONS[code]) return COUPONS[code];
    var match = getOffers().find(function (o) { return o.code && o.code.toUpperCase() === code; });
    return match ? match.discount : null;
  }

  /* ---------------- Products ---------------- */
  function getProducts() {
    var p = data().products;
    if (Array.isArray(p)) return p.slice();
    return typeof DEFAULT_PRODUCTS !== "undefined" ? DEFAULT_PRODUCTS.slice() : [];
  }

  function saveProducts(list) {
    var ops = diffOps("products", getProducts(), list);
    mutate(function (d) { d.products = clean(list); });
    enqueue(ops);
  }

  function getProduct(id) {
    return getProducts().filter(function (p) { return p.id === id; })[0] || null;
  }

  function upsertProduct(product) {
    var item = clean(product);
    mutate(function (d) {
      var list = Array.isArray(d.products) ? d.products : getProducts();
      var idx = list.findIndex(function (p) { return p.id === item.id; });
      if (idx > -1) list[idx] = item; else list.push(item);
      d.products = list;
    });
    enqueue([{ op: "set", col: "products", id: item.id, data: item }]);
  }

  function deleteProduct(id) {
    mutate(function (d) {
      d.products = (Array.isArray(d.products) ? d.products : getProducts()).filter(function (p) { return p.id !== id; });
    });
    enqueue([{ op: "delete", col: "products", id: id }]);
  }

  /* ---------------- Cart (this browser only) ---------------- */
  function getCart() { return jget(K.cart, []); }
  function saveCart(items) { jset(K.cart, items); }

  function addToCart(productId, size, color, qty, addons) {
    addons = addons || [];
    var addonKey = addons.map(function (a) { return a.name; }).sort().join("|");
    var cart = getCart();
    var existing = cart.find(function (i) {
      return i.productId === productId && i.size === size && i.color === color &&
        (i.addons || []).map(function (a) { return a.name; }).sort().join("|") === addonKey;
    });
    var product = getProduct(productId);
    var currentQty = existing ? existing.qty : 0;
    var maxQty = (product && !product.external) ? product.stock : Infinity;
    var newQty = Math.min(currentQty + qty, maxQty);
    var capped = newQty < currentQty + qty;
    if (existing) {
      existing.qty = newQty;
    } else {
      cart.push({ productId: productId, size: size, color: color, qty: newQty, addons: addons });
    }
    saveCart(cart);
    return { qty: newQty, capped: capped, maxQty: maxQty };
  }

  function updateCartQty(index, qty) {
    var cart = getCart();
    if (!cart[index]) return { qty: 0, capped: false, maxQty: Infinity };
    var product = getProduct(cart[index].productId);
    var maxQty = (product && !product.external) ? product.stock : Infinity;
    var wanted = Math.max(1, qty);
    var finalQty = Math.min(wanted, maxQty);
    cart[index].qty = finalQty;
    saveCart(cart);
    return { qty: finalQty, capped: finalQty < wanted, maxQty: maxQty };
  }

  function removeFromCart(index) {
    var cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
  }

  function clearCart() { saveCart([]); }
  function cartCount() { return getCart().reduce(function (sum, i) { return sum + i.qty; }, 0); }

  /* ---------------- Wishlist (this browser only) ---------------- */
  function getWishlist() { return jget(K.wishlist, []); }
  function saveWishlist(list) { jset(K.wishlist, list); }

  function toggleWishlist(productId) {
    var list = getWishlist();
    var idx = list.indexOf(productId);
    if (idx > -1) { list.splice(idx, 1); } else { list.push(productId); }
    saveWishlist(list);
    return list.indexOf(productId) > -1;
  }

  function isWishlisted(productId) { return getWishlist().indexOf(productId) > -1; }
  function removeFromWishlist(productId) {
    saveWishlist(getWishlist().filter(function (id) { return id !== productId; }));
  }

  /* ---------------- Orders ---------------- */
  function getOrders() { return (data().orders || []).slice(); }

  function placeOrder(order) {
    var s = readSession();
    if (!s) throw new Error("LOGIN_REQUIRED");
    var raw = clean(order);
    raw.id = newOrderId();
    raw.status = "Placed";
    raw.date = new Date().toISOString();
    raw.uid = s.uid;
    raw.email = s.email;
    mutate(function (d) {
      d.orders = d.orders || [];
      d.orders.unshift(sanitize(raw));
    });
    enqueue([{ op: "set", col: "orders", id: raw.id, data: raw }]);
    return sanitize(raw);
  }

  function updateOrderStatus(orderId, status) {
    if (ORDER_STEPS.indexOf(status) === -1) return;
    mutate(function (d) {
      (d.orders || []).forEach(function (o) { if (o.id === orderId) o.status = status; });
    });
    enqueue([{ op: "update", col: "orders", id: orderId, data: { status: status } }]);
  }

  /* ---------------- Enquiries ---------------- */
  function getEnquiries() { return (data().enquiries || []).slice(); }

  function addEnquiry(enquiry) {
    var raw = clean(enquiry);
    raw.id = "EQ" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(2, 5);
    raw.status = "New";
    raw.date = new Date().toISOString();
    var s = readSession();
    if (s && s.admin) mutate(function (d) { d.enquiries = d.enquiries || []; d.enquiries.unshift(sanitize(raw)); });
    enqueue([{ op: "set", col: "enquiries", id: raw.id, data: raw }]);
  }

  function updateEnquiryStatus(id, status) {
    mutate(function (d) {
      (d.enquiries || []).forEach(function (e) { if (e.id === id) e.status = status; });
    });
    enqueue([{ op: "update", col: "enquiries", id: id, data: { status: status } }]);
  }

  /* ---------------- Reviews ---------------- */
  function getReviews(productId) { return ((data().reviews || {})[productId] || []).slice(); }
  function getAllReviews() { return data().reviews || {}; }

  function addReview(productId, review) {
    var id = newId("rv");
    var raw = clean({
      productId: productId,
      name: review.name,
      rating: review.rating,
      text: review.text,
      photos: review.photos || [],
      approved: false,
      date: new Date().toISOString()
    });
    mutate(function (d) {
      d.reviews = d.reviews || {};
      d.reviews[productId] = d.reviews[productId] || [];
      var item = sanitize(raw); item._id = id;
      d.reviews[productId].unshift(item);
    });
    enqueue([{ op: "set", col: "reviews", id: id, data: raw }]);
  }

  function setReviewApproval(productId, index, approved) {
    var r;
    mutate(function (d) {
      var list = (d.reviews || {})[productId];
      if (list && list[index]) { r = list[index]; r.approved = !!approved; }
    });
    if (r && r._id) enqueue([{ op: "update", col: "reviews", id: r._id, data: { approved: !!approved } }]);
  }

  function deleteReview(productId, index) {
    var r;
    mutate(function (d) {
      var list = (d.reviews || {})[productId];
      if (list && list[index]) { r = list.splice(index, 1)[0]; }
    });
    if (r && r._id) enqueue([{ op: "delete", col: "reviews", id: r._id }]);
  }

  /* ---------------- Customer accounts (Firebase Authentication) ----------------
     signupCustomer / loginCustomer return a Promise -> { ok, error }          */
  function signupCustomer(name, email, password) {
    return importSync().then(function (m) { return m.signup(name, email, password); })
      .catch(function (e) { log(e); return { ok: false, error: "Could not connect. Check your internet and try again." }; });
  }

  function loginCustomer(email, password) {
    return importSync().then(function (m) { return m.login(email, password); })
      .catch(function (e) { log(e); return { ok: false, error: "Could not connect. Check your internet and try again." }; });
  }

  function resetPassword(email) {
    return importSync().then(function (m) { return m.resetPassword(email); })
      .catch(function (e) { log(e); return { ok: false, error: "Could not connect. Check your internet and try again." }; });
  }

  function adminLogin(email, password) {
    return importSync().then(function (m) { return m.adminLogin(email, password); })
      .catch(function (e) { log(e); return { ok: false, error: "Could not connect. Check your internet and try again." }; });
  }

  function logoutCustomer() {
    lsSet(K.signout, "1");
    writeSession(null);
    dropPersonal();
    importSync().then(function (m) { return m.signOutNow(); }).catch(log);
  }

  function getCurrentCustomer() {
    var s = readSession();
    return s ? { name: s.name, email: s.email, uid: s.uid } : null;
  }
  function isCustomerLoggedIn() { return !!readSession(); }

  /* ---------------- Admin (account with the admin claim) ---------------- */
  function isAdminLoggedIn() { var s = readSession(); return !!(s && s.admin); }
  function setAdminLoggedIn(val) { if (!val) logoutCustomer(); }

  /* ---------------- start-up: decide if we must fetch data first ---------------- */
  function boot() {
    try { sessionStorage.setItem(K.boot, String(Date.now())); } catch (e) {}
    try { document.documentElement.style.visibility = "hidden"; } catch (e) {}
    try { window.stop(); } catch (e) {}
    importSync()
      .then(function (m) { return m.refreshAll(); })
      .then(function () { location.reload(); }, function (err) { log("[Store] first load failed:", err); location.reload(); });
  }

  function start() {
    lsDel("sc_customers");   // old demo accounts with plain-text passwords
    lsDel("sc_customer_session");
    try { sessionStorage.removeItem("sc_admin_session"); sessionStorage.removeItem("sc_customer_session"); } catch (e) {}

    var s = readSession(), c = getCache();
    var uid = s ? s.uid : null, admin = !!(s && s.admin);
    var age = (c && c.t) ? Date.now() - c.t : Infinity;
    var need = !window.SC_NO_BOOT && (!c || !c.t || (c.uid || null) !== uid || !!c.admin !== admin || (admin && age > ADMIN_TTL));
    var last = 0;
    try { last = Number(sessionStorage.getItem(K.boot) || 0); } catch (e) {}

    if (need && Date.now() - last > 10000) { boot(); return; }

    window.addEventListener("load", function () {
      setTimeout(function () {
        importSync().then(function (m) { return m.background(); }).catch(function (e) { log("[Store] background sync:", e); });
      }, 300);
    });
  }

  return {
    getProducts: getProducts, upsertProduct: upsertProduct, deleteProduct: deleteProduct, getProduct: getProduct,
    getCart: getCart, addToCart: addToCart, updateCartQty: updateCartQty, removeFromCart: removeFromCart, clearCart: clearCart, cartCount: cartCount,
    getWishlist: getWishlist, toggleWishlist: toggleWishlist, isWishlisted: isWishlisted, removeFromWishlist: removeFromWishlist,
    getOrders: getOrders, placeOrder: placeOrder, updateOrderStatus: updateOrderStatus, ORDER_STEPS: ORDER_STEPS,
    getEnquiries: getEnquiries, addEnquiry: addEnquiry, updateEnquiryStatus: updateEnquiryStatus,
    getReviews: getReviews, addReview: addReview, getAllReviews: getAllReviews, setReviewApproval: setReviewApproval, deleteReview: deleteReview,
    isAdminLoggedIn: isAdminLoggedIn, setAdminLoggedIn: setAdminLoggedIn, adminLogin: adminLogin,
    signupCustomer: signupCustomer, loginCustomer: loginCustomer, logoutCustomer: logoutCustomer, resetPassword: resetPassword,
    getCurrentCustomer: getCurrentCustomer, isCustomerLoggedIn: isCustomerLoggedIn,
    getCategories: getCategories, addCategory: addCategory, deleteCategory: deleteCategory,
    getCategoryImages: getCategoryImages, setCategoryImage: setCategoryImage, getCategoryImage: getCategoryImage,
    getOffers: getOffers, addOffer: addOffer, deleteOffer: deleteOffer, getCouponDiscount: getCouponDiscount,
    _start: start,
    _x: {
      K: K, PUBLIC_TTL: PUBLIC_TTL, readSession: readSession, writeSession: writeSession,
      getCache: getCache, setCache: setCache, dropPersonal: dropPersonal,
      readOutbox: readOutbox, writeOutbox: writeOutbox, sanitize: sanitize
    }
  };
})();

Store._start();
