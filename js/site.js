/* ============================================================
   Shriman Collection — shared site behaviour
   ============================================================ */

function fmtPrice(n) {
  if (n === null || n === undefined) return "Made to measure";
  return "₹" + n.toLocaleString("en-IN");
}

function stockLabel(stock) {
  if (stock <= 0) return { text: "Out of Stock", cls: "out" };
  if (stock <= 5) return { text: stock + " left", cls: "low" };
  return { text: "In Stock", cls: "in" };
}

function showToast(msg) {
  var toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { toast.classList.remove("show"); }, 2000);
}

function updateHeaderBadges() {
  var cartBadge = document.getElementById("cartBadge");
  var wishBadge = document.getElementById("wishBadge");
  if (cartBadge) cartBadge.textContent = Store.cartCount();
  if (wishBadge) wishBadge.textContent = Store.getWishlist().length;
}

function productCardHTML(p) {
  var icon = CATEGORY_ICONS[p.category] || "🛍️";
    var imgHTML = p.image
    ? '<img src="' + p.image + '" alt="' + String(p.name).replace(/"/g, "&quot;") + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;">'
    : icon;
  var badgeHTML = p.badge ? '<span class="product-card__badge' + (p.badge === "SALE" ? " sale" : "") + '">' + p.badge + '</span>' : "";
  var priceHTML = "";
  var discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
  if (p.price === null) {
    priceHTML = '<span>' + fmtPrice(null) + '</span>';
  } else {
    priceHTML = fmtPrice(p.price) + (p.originalPrice ? '<span class="original">' + fmtPrice(p.originalPrice) + '</span><span class="off">(' + discount + '% OFF)</span>' : "");
  }
  var stock = stockLabel(p.stock);
  var wished = Store.isWishlisted(p.id);
  var href = p.external ? p.external : "product.html?id=" + p.id;

  return (
    '<div class="product-card" data-id="' + p.id + '">' +
      '<a href="' + href + '" class="product-card__img" style="background:' + cardColor(p.category) + ';overflow:hidden;">' +
        badgeHTML + imgHTML +
      '</a>' +
      '<button class="product-card__wish' + (wished ? " active" : "") + '" data-wish="' + p.id + '" aria-label="Toggle wishlist">' + (wished ? "♥" : "♡") + '</button>' +
      '<div class="product-card__body">' +
        '<div class="product-card__cat">' + p.category + '</div>' +
        '<a href="' + href + '"><h3 class="product-card__name">' + p.name + '</h3></a>' +
        '<div class="product-card__rating">★ ' + p.rating.toFixed(1) + ' (' + p.reviewCount + ')</div>' +
        '<div class="product-card__price">' + priceHTML + '</div>' +
        '<div class="product-card__stock ' + stock.cls + '">' + stock.text + '</div>' +
        '<div class="product-card__actions">' +
          (p.external
            ? '<a href="' + href + '" class="btn btn--dark">View</a>'
            : '<button class="btn btn--dark" data-quickadd="' + p.id + '"' + (p.stock <= 0 ? " disabled" : "") + '>Add to Cart</button>')
        +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

var CARD_COLORS = {
  "Shirts": "#F1E9DD", "T-Shirts": "#EAE2F1", "Jeans": "#E2E9F1", "Kurtas": "#F1EBDD",
  "Pants": "#E7E2D8", "Jackets": "#DDE3E1", "Accessories": "#F1E4DD", "Tuxedos": "#20201F"
};
function cardColor(cat) { return CARD_COLORS[cat] || "#F1E9DD"; }

function wireProductGrid(root) {
  root.addEventListener("click", function (e) {
    var wishBtn = e.target.closest("[data-wish]");
    if (wishBtn) {
      e.preventDefault();
      var active = Store.toggleWishlist(wishBtn.dataset.wish);
      wishBtn.classList.toggle("active", active);
      wishBtn.textContent = active ? "♥" : "♡";
      updateHeaderBadges();
      showToast(active ? "Added to wishlist" : "Removed from wishlist");
      return;
    }
    var addBtn = e.target.closest("[data-quickadd]");
    if (addBtn) {
      e.preventDefault();
      var p = Store.getProduct(addBtn.dataset.quickadd);
      if (!p) return;
      Store.addToCart(p.id, p.sizes[0], p.colors[0], 1);
      updateHeaderBadges();
      showToast(p.name + " added to cart");
    }
  });
}

function updateAuthUI() {
  var link = document.getElementById("accountLink");
  if (!link) return;
  var customer = Store.getCurrentCustomer();
  link.textContent = customer ? ("👤 " + customer.name.split(" ")[0]) : "👤 Login";
}

function wireMobileNav() {
  var header = document.querySelector(".header");
  var nav = document.querySelector(".header__nav");
  var icons = document.querySelector(".header__icons");
  if (!header || !nav || !icons) return;

  var toggle = document.createElement("button");
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "Menu");
  toggle.textContent = "☰";
  icons.insertBefore(toggle, icons.firstChild);

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.textContent = open ? "✕" : "☰";
  });

  var dropdownLink = nav.querySelector(".has-dropdown > a");
  if (dropdownLink) {
    dropdownLink.addEventListener("click", function (e) {
      if (window.innerWidth > 860) return;
      e.preventDefault();
      dropdownLink.closest(".has-dropdown").classList.toggle("open");
    });
  }

  nav.querySelectorAll("a").forEach(function (a) {
    if (a === dropdownLink) return;
    a.addEventListener("click", function () {
      nav.classList.remove("open");
      toggle.textContent = "☰";
    });
  });
}

function wireStickyHeaderTheme() {
  var headerWrap = document.getElementById("siteHeaderWrap");
  var pantherSection = document.getElementById("pantherSection");
  if (!headerWrap || !pantherSection) return;

  function updateHeaderTheme() {
    var rect = pantherSection.getBoundingClientRect();
    // Switch to store mode when scrolled past pantherSection
    if (rect.bottom <= 80) {
      headerWrap.classList.remove("is-hero");
      headerWrap.classList.add("is-store");
    } else {
      headerWrap.classList.add("is-hero");
      headerWrap.classList.remove("is-store");
    }

    // Collapse topbar smoothly on scroll down
    if (window.scrollY > 40) {
      headerWrap.classList.add("has-scrolled");
    } else {
      headerWrap.classList.remove("has-scrolled");
    }
  }

  window.addEventListener("scroll", updateHeaderTheme, { passive: true });
  updateHeaderTheme();
}

document.addEventListener("DOMContentLoaded", function () {
  updateHeaderBadges();
  updateAuthUI();
  wireMobileNav();
  wireStickyHeaderTheme();
});


function compressImageFile(file, maxDim, callback) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}