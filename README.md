# Shriman Collection

E-commerce website for menswear, with a scroll-driven landing animation, customer accounts, admin panel and Cash on Delivery orders.

**Live:** https://shriman-collection.web.app

## Tech stack
HTML5, CSS3, JavaScript (ES6), Canvas API, Web Workers,
Firebase (Authentication, Firestore, Hosting), Cloudinary

## Features
- Product catalogue with filters, cart, wishlist and checkout (COD)
- Customer login and order history
- Admin panel: products, categories, offers, orders, enquiries (protected with Firebase custom claims)
- Firestore security rules so customers see only their own orders
- WhatsApp order confirmation link

## Note
The animation frames (`panther-hero/` and `tuxedos/frames/`) are not included in this repository because of their size.
Add your own Firebase config in `js/store-sync.js` to run it.