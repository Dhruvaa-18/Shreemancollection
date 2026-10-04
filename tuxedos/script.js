(function () {
  "use strict";

  /* ----------------------------------------------------------
     Config
     ---------------------------------------------------------- */
  var FRAME_COUNT = 180;
  var FRAME_PATH = function (i) {
    return "frames/frame_" + String(i).padStart(4, "0") + ".jpg";
  };
  var BG_COLOR = "#FFB6A6"; // must match the frames exactly — no visible seam
  var EASE = 0.09; // higher = snappier, lower = silkier lag
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------
     Elements
     ---------------------------------------------------------- */
  var canvas = document.getElementById("tuxCanvas");
  var ctx = canvas.getContext("2d");
  var scene = document.getElementById("scene");
  var nav = document.getElementById("nav");
  var loader = document.getElementById("loader");
  var loaderBar = document.getElementById("loaderBar");
  var loaderPct = document.getElementById("loaderPct");
  var introOverlay = document.getElementById("introOverlay");
  var introText = document.getElementById("introText");
  var outroText = document.getElementById("outroText");
  var scrollCue = document.getElementById("scrollCue");

  document.body.classList.add("is-loading");

  /* ----------------------------------------------------------
     Preload frames
     ---------------------------------------------------------- */
  var images = new Array(FRAME_COUNT);
  var loadedCount = 0;
  var naturalW = 1280, naturalH = 720; // fallback, overwritten by frame 1

  function onOneLoaded() {
    loadedCount++;
    var pct = Math.round((loadedCount / FRAME_COUNT) * 100);
    loaderBar.style.width = pct + "%";
    loaderPct.textContent = pct + "%";
    if (loadedCount === FRAME_COUNT) {
      onAllLoaded();
    }
  }

  function preload() {
    for (var i = 1; i <= FRAME_COUNT; i++) {
      var img = new Image();
      img.onload = onOneLoaded;
      img.onerror = onOneLoaded; // don't let one bad frame block the sequence
      img.src = FRAME_PATH(i);
      images[i - 1] = img;
    }
  }

  function onAllLoaded() {
    if (images[0] && images[0].naturalWidth) {
      naturalW = images[0].naturalWidth;
      naturalH = images[0].naturalHeight;
    }
    document.body.classList.remove("is-loading");
    loader.classList.add("is-hidden");
    resizeCanvas();
    drawFrame(0);
    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------
     Canvas sizing (contain fit, background fills any letterbox
     with the same color as the page — the seam disappears)
     ---------------------------------------------------------- */
  var dpr = 1;
  var vw = 0, vh = 0;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(Math.round(currentFrame));
  }

  function drawFrame(index) {
    index = Math.max(0, Math.min(FRAME_COUNT - 1, index));
    var img = images[index];
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, vw, vh);
    if (!img || !img.naturalWidth) return;

    // Ensure the tuxedo collar is positioned with generous breathing space below the navbar
    var navH = nav ? (nav.offsetHeight || 84) : 84;
    var topPad = navH + 24; // Ensure collar is at least 24px below navbar
    var bottomPad = 50;     // Space for bottom scroll cue
    var availH = Math.max(300, vh - topPad - bottomPad);

    var scale = Math.min(vw / naturalW, availH / naturalH, 1.05);
    var dw = naturalW * scale;
    var dh = naturalH * scale;
    var dx = (vw - dw) / 2;
    // Collar in source frame starts at y = 52.
    // Position dy so the collar is guaranteed to start comfortably below the navbar:
    var dy = topPad - (52 * scale) + Math.max(0, (availH - dh) * 0.3);

    ctx.drawImage(img, dx, dy, dw, dh);

    // Safeguard: Cover bottom-right watermark area seamlessly with exact peach background
    var wmX = dx + dw * (1110 / naturalW);
    var wmY = dy + dh * (540 / naturalH);
    var wmW = dw * (170 / naturalW);
    var wmH = dh * (160 / naturalH);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(wmX, wmY, wmW, wmH);
  }

  /* ----------------------------------------------------------
     Scroll -> frame mapping, eased toward target every rAF
     ---------------------------------------------------------- */
  var currentFrame = 0;
  var lastDrawn = -1;

  function getProgress() {
    var sceneTop = scene.offsetTop;
    var sceneHeight = scene.offsetHeight;
    var travel = sceneHeight - window.innerHeight;
    if (travel <= 0) return 0;
    var p = (window.scrollY - sceneTop) / travel;
    return Math.max(0, Math.min(1, p));
  }

  function clamp01(n) { return Math.max(0, Math.min(1, n)); }

  function updateOverlays(progress) {
    if (introOverlay) {
      var introOpacity = 1 - clamp01(progress / 0.12);
      introOverlay.style.opacity = introOpacity;
      introOverlay.style.transform = "translateY(" + (introOpacity - 1) * -12 + "px)";
      introOverlay.style.pointerEvents = introOpacity < 0.1 ? "none" : "auto";
    }
    if (scrollCue) {
      var cueOpacity = 1 - clamp01(progress / 0.04);
      scrollCue.style.opacity = cueOpacity * 0.7;
    }
  }

  function updateNav() {
    if (window.scrollY > 10) {
      nav.classList.add("is-scrolled");
    } else {
      nav.classList.remove("is-scrolled");
    }
  }

  function tick() {
    var progress = getProgress();
    var targetFrame = progress * (FRAME_COUNT - 1);

    if (reduceMotion) {
      currentFrame = targetFrame;
    } else {
      currentFrame += (targetFrame - currentFrame) * EASE;
      if (Math.abs(targetFrame - currentFrame) < 0.02) currentFrame = targetFrame;
    }

    var rounded = Math.round(currentFrame);
    if (rounded !== lastDrawn) {
      drawFrame(rounded);
      lastDrawn = rounded;
    }

    updateOverlays(progress);
    updateNav();

    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  window.addEventListener("resize", resizeCanvas, { passive: true });
  preload();
})();
