/* ============================================================
   Shriman Collection — Hero Catalogue Auto-Slideshow
   Displays dynamic catalogue slides with auto-rotation,
   smooth fade transitions, touch swipe support, and admin sync.
   ============================================================ */

(function () {
  function initCatalogueSlider() {
    var container = document.getElementById("heroCatalogue");
    var track = document.getElementById("catalogueTrack");
    var dotsContainer = document.getElementById("catalogueDots");
    var prevBtn = document.getElementById("cataloguePrev");
    var nextBtn = document.getElementById("catalogueNext");

    if (!container || !track) return;

    var slides = (typeof Store !== "undefined" && Store.getCatalogueSlides)
      ? Store.getCatalogueSlides()
      : (typeof DEFAULT_CATALOGUE_SLIDES !== "undefined" ? DEFAULT_CATALOGUE_SLIDES : []);

    var intervalSec = (typeof Store !== "undefined" && Store.getCatalogueInterval)
      ? Store.getCatalogueInterval()
      : 4;
    var intervalMs = Math.max(2, intervalSec) * 1000;

    var currentIndex = 0;
    var timer = null;
    var isHovered = false;

    // Handle empty state
    if (!slides || slides.length === 0) {
      track.innerHTML =
        '<div class="catalogue-empty" id="catalogueEmpty">' +
          '<span>🖼️</span>' +
          '<p>Catalogue coming soon</p>' +
          '<small>Admin can add slides from the dashboard</small>' +
        '</div>';
      if (dotsContainer) dotsContainer.innerHTML = "";
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
      return;
    }

    if (prevBtn) prevBtn.style.display = slides.length > 1 ? "flex" : "none";
    if (nextBtn) nextBtn.style.display = slides.length > 1 ? "flex" : "none";

    // Render slides
    track.innerHTML = slides.map(function (s, i) {
      var activeClass = i === 0 ? " active" : "";
      var linkUrl = s.link || "shop.html";
      var tagHtml = s.tag ? '<span class="catalogue-slide__tag">' + escapeHtml(s.tag) + '</span>' : '';
      var titleText = s.title || s.caption || "Exclusive Collection";
      var subHtml = s.subtitle ? '<p class="catalogue-slide__sub">' + escapeHtml(s.subtitle) + '</p>' : '';

      return (
        '<div class="catalogue-slide' + activeClass + '" data-slide-index="' + i + '">' +
          '<a href="' + linkUrl + '" class="catalogue-slide__link">' +
            '<img class="catalogue-slide__img" src="' + s.src + '" alt="' + escapeHtml(titleText) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '" onerror="this.src=\'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80\';">' +
            '<div class="catalogue-slide__overlay"></div>' +
            '<div class="catalogue-slide__content">' +
              tagHtml +
              '<h3 class="catalogue-slide__title">' + escapeHtml(titleText) + '</h3>' +
              subHtml +
              '<span class="catalogue-slide__cta">Explore Collection →</span>' +
            '</div>' +
          '</a>' +
        '</div>'
      );
    }).join("");

    // Render dots
    if (dotsContainer) {
      if (slides.length > 1) {
        dotsContainer.innerHTML = slides.map(function (_, i) {
          return '<button class="catalogue-dot' + (i === 0 ? ' active' : '') + '" data-goto="' + i + '" aria-label="Go to slide ' + (i + 1) + '"></button>';
        }).join("");
      } else {
        dotsContainer.innerHTML = "";
      }
    }

    var slideElements = track.querySelectorAll(".catalogue-slide");
    var dotElements = dotsContainer ? dotsContainer.querySelectorAll(".catalogue-dot") : [];

    function goToSlide(index) {
      if (!slideElements.length) return;
      var newIndex = (index + slideElements.length) % slideElements.length;
      if (newIndex === currentIndex && slideElements[currentIndex].classList.contains("active")) return;

      if (slideElements[currentIndex]) {
        slideElements[currentIndex].classList.remove("active");
      }
      if (dotElements[currentIndex]) {
        dotElements[currentIndex].classList.remove("active");
      }

      currentIndex = newIndex;

      if (slideElements[currentIndex]) {
        slideElements[currentIndex].classList.add("active");
      }
      if (dotElements[currentIndex]) {
        dotElements[currentIndex].classList.add("active");
      }
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function startAutoplay() {
      stopAutoplay();
      if (slides.length > 1 && !isHovered) {
        timer = setInterval(function () {
          nextSlide();
        }, intervalMs);
      }
    }

    function stopAutoplay() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function resetAutoplay() {
      stopAutoplay();
      startAutoplay();
    }

    // Attach Prev/Next events
    if (prevBtn) {
      prevBtn.onclick = function (e) {
        e.preventDefault();
        prevSlide();
        resetAutoplay();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = function (e) {
        e.preventDefault();
        nextSlide();
        resetAutoplay();
      };
    }

    // Dot click events
    if (dotsContainer) {
      dotsContainer.onclick = function (e) {
        var dot = e.target.closest(".catalogue-dot");
        if (dot && dot.hasAttribute("data-goto")) {
          var targetIndex = parseInt(dot.getAttribute("data-goto"), 10);
          goToSlide(targetIndex);
          resetAutoplay();
        }
      };
    }

    // Pause on hover
    container.addEventListener("mouseenter", function () {
      isHovered = true;
      stopAutoplay();
    });

    container.addEventListener("mouseleave", function () {
      isHovered = false;
      startAutoplay();
    });

    // Touch swipe support for mobile
    var touchStartX = 0;
    var touchEndX = 0;
    var touchStartY = 0;

    container.addEventListener("touchstart", function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      stopAutoplay();
    }, { passive: true });

    container.addEventListener("touchend", function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      touchEndX = e.changedTouches[0].screenX;
      var touchEndY = e.changedTouches[0].screenY;
      var diffX = touchStartX - touchEndX;
      var diffY = Math.abs(touchStartY - touchEndY);

      // Only swipe if horizontal move is significant and greater than vertical scroll
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > diffY) {
        if (diffX > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
      startAutoplay();
    }, { passive: true });

    // Start auto-play
    startAutoplay();

    // Listen for storage changes from admin panel
    window.addEventListener("storage", function (e) {
      if (e.key === "sc_catalogue_slides" || e.key === "sc_catalogue_interval") {
        initCatalogueSlider();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCatalogueSlider);
  } else {
    initCatalogueSlider();
  }

  window.initCatalogueSlider = initCatalogueSlider;
})();
