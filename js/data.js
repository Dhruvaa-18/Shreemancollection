/* ============================================================
   Shriman Collection — product catalog seed
   Admin edits are layered on top of this in localStorage, so
   this file is only the starting data, never the live source.
   ============================================================ */

var CATEGORY_ICONS = {
  "Shirts": "👔",
  "T-Shirts": "👕",
  "Jeans": "👖",
  "Kurtas": "🥻",
  "Pants": "👖",
  "Jackets": "🧥",
  "Accessories": "⌚",
  "Tuxedos": "🤵"
};

var CATEGORY_TAGLINES = {
  "Shirts": "Classic & refined",
  "T-Shirts": "Relaxed essentials",
  "Jeans": "Everyday denim",
  "Kurtas": "Rooted in tradition",
  "Pants": "Tailored comfort",
  "Jackets": "Layer with intent",
  "Accessories": "The final detail",
  "Tuxedos": "Made to measure"
};

var DEFAULT_PRODUCTS = [
  { id: "p01", name: "Premium Cotton Shirt", category: "Shirts", price: 899, originalPrice: null, badge: "NEW", sizes: ["S","M","L","XL","XXL"], colors: ["White","Sky Blue","Black"], rating: 4.5, reviewCount: 24, stock: 18 },
  { id: "p02", name: "Linen Blend Shirt", category: "Shirts", price: 999, originalPrice: 1299, badge: "SALE", sizes: ["S","M","L","XL","XXL"], colors: ["Beige","Olive"], rating: 4.3, reviewCount: 31, stock: 12 },
  { id: "p03", name: "Printed Casual Shirt", category: "Shirts", price: 799, originalPrice: null, badge: "SALE", sizes: ["S","M","L","XL"], colors: ["Navy Print"], rating: 4.1, reviewCount: 15, stock: 9 },
  { id: "p04", name: "Slim Fit Formal Shirt", category: "Shirts", price: 949, originalPrice: null, badge: "NEW", sizes: ["S","M","L","XL"], colors: ["White","Light Grey"], rating: 4.6, reviewCount: 19, stock: 21 },
  { id: "p05", name: "Classic Polo T-Shirt", category: "T-Shirts", price: 649, originalPrice: 899, badge: "NEW", sizes: ["S","M","L","XL","XXL"], colors: ["Olive","Black","Maroon"], rating: 4.4, reviewCount: 27, stock: 30 },
  { id: "p06", name: "Oversized T-Shirt", category: "T-Shirts", price: 599, originalPrice: 799, badge: "SALE", sizes: ["M","L","XL"], colors: ["Black","White"], rating: 4.2, reviewCount: 22, stock: 4 },
  { id: "p07", name: "Graphic Print Tee", category: "T-Shirts", price: 549, originalPrice: null, badge: null, sizes: ["S","M","L","XL"], colors: ["White","Black"], rating: 4.0, reviewCount: 8, stock: 16 },
  { id: "p08", name: "Slim Fit Jeans", category: "Jeans", price: 1499, originalPrice: 1899, badge: null, sizes: ["30","32","34","36"], colors: ["Indigo","Black"], rating: 4.3, reviewCount: 40, stock: 0 },
  { id: "p09", name: "Straight Fit Kurta", category: "Kurtas", price: 1199, originalPrice: null, badge: "NEW", sizes: ["S","M","L","XL"], colors: ["Beige","Mustard"], rating: 4.5, reviewCount: 12, stock: 14 },
  { id: "p10", name: "Embroidered Kurta", category: "Kurtas", price: 1599, originalPrice: 1999, badge: "SALE", sizes: ["M","L","XL"], colors: ["White","Sea Green"], rating: 4.7, reviewCount: 9, stock: 6 },
  { id: "p11", name: "Classic Chinos", category: "Pants", price: 1099, originalPrice: 1399, badge: null, sizes: ["30","32","34","36"], colors: ["Khaki","Navy","Grey"], rating: 4.2, reviewCount: 17, stock: 20 },
  { id: "p12", name: "Formal Trousers", category: "Pants", price: 1299, originalPrice: null, badge: null, sizes: ["30","32","34","36"], colors: ["Black","Grey"], rating: 4.1, reviewCount: 11, stock: 3 },
  { id: "p13", name: "Quilted Bomber Jacket", category: "Jackets", price: 2499, originalPrice: null, badge: "NEW", sizes: ["M","L","XL"], colors: ["Olive","Black"], rating: 4.6, reviewCount: 13, stock: 8 },
  { id: "p14", name: "Denim Jacket", category: "Jackets", price: 2199, originalPrice: 2699, badge: "SALE", sizes: ["M","L","XL"], colors: ["Blue"], rating: 4.4, reviewCount: 10, stock: 5 },
  { id: "p15", name: "Leather Belt", category: "Accessories", price: 799, originalPrice: null, badge: null, sizes: ["Free Size"], colors: ["Brown","Black"], rating: 4.3, reviewCount: 21, stock: 25 },
  { id: "p16", name: "Chrono Watch", category: "Accessories", price: 3499, originalPrice: 3999, badge: null, sizes: ["Free Size"], colors: ["Brown Strap"], rating: 4.5, reviewCount: 14, stock: 7 },
  { id: "p17", name: "The Nocturne Tuxedo", category: "Tuxedos", price: null, originalPrice: null, badge: "MADE TO MEASURE", sizes: ["Book a Fitting"], colors: ["Black"], rating: 4.9, reviewCount: 6, stock: 99, external: "tuxedos/index.html" }
];

var CATEGORY_LIST = ["Shirts", "T-Shirts", "Jeans", "Kurtas", "Pants", "Jackets", "Accessories", "Tuxedos"];

var COUPONS = {
  "WELCOME10": 0.10
};

var DEFAULT_OFFERS = [
  { id: "o01", title: "Up to 50% Off", description: "On selected shirts and jackets across the store. Look for the SALE tag on the product card.", code: null, discount: null },
  { id: "o02", title: "Festive Bundle", description: "Buy 2 get 10% off, buy 3 get 20% off on kurtas and ethnic wear this season.", code: null, discount: null },
  { id: "o03", title: "Welcome Offer", description: "10% off your first order. Apply the code at checkout.", code: "WELCOME10", discount: 0.10 },
  { id: "o04", title: "Free Shipping", description: "Automatically applied on all prepaid orders above ₹999.", code: null, discount: null }
];

var FREE_SHIPPING_THRESHOLD = 999;

var DEFAULT_CATALOGUE_SLIDES = [
  {
    id: "slide-1",
    src: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80",
    title: "Bespoke Tuxedos & Suits",
    caption: "Bespoke Tuxedos & Suits",
    tag: "ATELIER BESPOKE",
    subtitle: "Crafted to perfection for timeless elegance",
    link: "tuxedos/index.html",
    order: 0
  },
  {
    id: "slide-2",
    src: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=80",
    title: "Signature Pure Linen Shirts",
    caption: "Signature Pure Linen Shirts",
    tag: "NEW ARRIVALS",
    subtitle: "Breathable comfort, impeccably tailored",
    link: "shop.html?category=Shirts",
    order: 1
  },
  {
    id: "slide-3",
    src: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=1200&q=80",
    title: "Heritage Festive Kurtas",
    caption: "Heritage Festive Kurtas",
    tag: "FESTIVE EDIT",
    subtitle: "Intricate weaves celebrating timeless tradition",
    link: "shop.html?category=Kurtas",
    order: 2
  },
  {
    id: "slide-4",
    src: "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=1200&q=80",
    title: "Tailored Outerwear & Jackets",
    caption: "Tailored Outerwear & Jackets",
    tag: "LIMITED RUN",
    subtitle: "Structural warmth and contemporary silhouettes",
    link: "shop.html?category=Jackets",
    order: 3
  }
];