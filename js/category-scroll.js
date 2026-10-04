/* ============================================================
   Shriman Collection — pinned horizontal "Shop by Category" scroll
   Vertical page scroll drives horizontal movement of .cat-track
   while .cat-scroll-sticky is pinned in the viewport.
   Disabled on small/touch screens in favor of native swipe
   (handled purely in CSS via the max-width:767px media query).
   ============================================================ */

(function () {
  var wrap, sticky, viewport, track, progressBar, progressCount, cards;
  var headerH = 0;
  var extraScroll = 0;
  var currentX = 0;
  var targetX = 0;
  var rafId = null;
  var isMobile = false;
  var initialized = false;
  var resizeTimer = null;

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function measure() {
    if (!wrap) return;
    isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile) {
      wrap.style.height = "";
      sticky.style.top = "";
      track.style.transform = "";
      for (var i = 0; i < cards.length; i++) cards[i].style.transform = "";
      extraScroll = 0;
      currentX = 0;
      targetX = 0;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      return;
    }

    var headerEl = document.querySelector(".header");
    headerH = headerEl ? headerEl.offsetHeight : 0;
    sticky.style.top = headerH + "px";

    var viewportW = viewport.clientWidth;
    var trackW = track.scrollWidth;
    extraScroll = Math.max(0, trackW - viewportW);

    wrap.style.height = extraScroll > 0
      ? "calc(100vh + " + extraScroll + "px)"
      : "";

    onScroll();
  }

  function updateProgressUI(progress) {
    if (progressBar) progressBar.style.width = (progress * 100) + "%";
    if (progressCount && cards.length) {
      var idx = clamp(Math.round(progress * (cards.length - 1)) + 1, 1, cards.length);
      progressCount.textContent = pad(idx) + " / " + pad(cards.length);
    }
  }

  function update3D() {
    var vr = viewport.getBoundingClientRect();
    var centerX = vr.left + vr.width / 2;
    var half = vr.width / 2 || 1;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      var cardCenter = r.left + r.width / 2;
      var t = clamp((cardCenter - centerX) / half, -1, 1);
      var scale = 1 - 0.09 * Math.abs(t);
      var rotateY = t * -8;
      var translateY = Math.abs(t) * 10;
      cards[i].style.transform =
        "translateY(" + translateY.toFixed(1) + "px) scale(" + scale.toFixed(3) + ") rotateY(" + rotateY.toFixed(2) + "deg)";
      cards[i].style.zIndex = Math.round((1 - Math.abs(t)) * 10);
    }
  }

  function loop() {
    currentX += (targetX - currentX) * 0.08;
    var diff = Math.abs(targetX - currentX);
    if (diff < 0.4) { currentX = targetX; rafId = null; }
    track.style.transform = "translate3d(" + currentX.toFixed(1) + "px,0,0)";
    update3D();
    if (rafId !== null) rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function onScroll() {
    if (isMobile || extraScroll <= 0 || !wrap) return;
    var rect = wrap.getBoundingClientRect();
    var progress = clamp((headerH - rect.top) / extraScroll, 0, 1);
    targetX = -progress * extraScroll;
    updateProgressUI(progress);
    startLoop();
  }

  var ticking = false;
  function onScrollThrottled() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  }

  function init() {
    wrap = document.getElementById("catScrollWrap");
    sticky = document.getElementById("catScrollSticky");
    viewport = document.getElementById("catScrollViewport");
    track = document.getElementById("catTrack");
    progressBar = document.getElementById("catProgressBar");
    progressCount = document.getElementById("catProgressCount");
    if (!wrap || !sticky || !viewport || !track) return;
    cards = track.querySelectorAll(".cat-card");

    measure();

    if (!initialized) {
      initialized = true;
      window.addEventListener("scroll", onScrollThrottled, { passive: true });
      window.addEventListener("resize", onResize);
      window.addEventListener("load", measure);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measure);
      }
    }
  }

  window.initCategoryScroll = init;
})();