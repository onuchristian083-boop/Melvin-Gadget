    const welcomeScreen = document.querySelector("#welcome-screen");
    const pageTransitionElements = document.querySelectorAll(".site-header, main, .site-footer");
    const homePathPattern = /^\/?(?:index\.html)?$/i;
    const isHomePage = homePathPattern.test(window.location.pathname.replace(/\\/g, "/"));
    const navigationEntries = window.performance && window.performance.getEntriesByType
      ? window.performance.getEntriesByType("navigation")
      : [];
    const isHardRefresh = navigationEntries.length > 0 && navigationEntries[0].type === "reload";
    const hasSameOriginReferrer = Boolean(document.referrer) && document.referrer.startsWith(window.location.origin);
    const shouldShowWelcome = isHomePage && (isHardRefresh || !document.referrer || !hasSameOriginReferrer);

    const startPageTransition = () => {
      const body = document.body;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reducedMotion) {
        body.classList.remove("page-transition-pending");
        return;
      }

      pageTransitionElements.forEach((element) => element.setAttribute("inert", ""));
      window.setTimeout(() => body.classList.add("page-transition-leaving"), 750);
      window.setTimeout(() => {
        body.classList.remove("page-transition-pending", "page-transition-leaving");
        body.classList.add("page-content-revealed");
        window.setTimeout(() => {
          pageTransitionElements.forEach((element) => element.removeAttribute("inert"));
          body.classList.remove("page-content-revealed");
        }, 500);
      }, 1400);
    };

    if (welcomeScreen && shouldShowWelcome) {
      document.body.classList.remove("page-transition-pending");
      document.body.classList.add("welcome-loading");
    } else {
      if (welcomeScreen) {
        welcomeScreen.remove();
      }
      startPageTransition();
    }

    const loadingProgress = document.querySelector("#loading-progress");
    const loadingPercentage = document.querySelector("#loading-percentage");
    let welcomeLetterIndex = 0;

    document.querySelectorAll("[data-text-reveal]").forEach((textContainer) => {
      const characters = Array.from(textContainer.textContent, (character) => {
        if (/\s/.test(character)) return document.createTextNode(character);

        const letter = document.createElement("span");
        letter.className = "welcome-letter";
        letter.style.setProperty("--letter-index", String(welcomeLetterIndex++));
        letter.textContent = character;
        return letter;
      });

      textContainer.replaceChildren(...characters);
    });

    if (welcomeScreen && loadingProgress && loadingPercentage) {
      const progressFill = loadingProgress.querySelector(".welcome-progress-fill");
      const minimumLoadingTime = 2400;
      const startedAt = performance.now();
      let pageLoaded = document.readyState === "complete";
      let minimumTimePassed = false;
      let screenDismissed = false;

      pageTransitionElements.forEach((section) => section.setAttribute("inert", ""));

      const dismissWelcomeScreen = () => {
        if (!pageLoaded || !minimumTimePassed || screenDismissed) return;

        screenDismissed = true;
        loadingProgress.setAttribute("aria-valuenow", "100");
        loadingPercentage.textContent = "100%";
        progressFill.style.width = "100%";
        welcomeScreen.classList.add("is-finished");

        window.setTimeout(() => {
          welcomeScreen.remove();
          document.body.classList.remove("welcome-loading");
          pageTransitionElements.forEach((section) => section.removeAttribute("inert"));
        }, 700);
      };

      const updateLoadingProgress = (now) => {
        if (screenDismissed) return;

        const elapsed = now - startedAt;
        const percentage = Math.min(Math.floor((elapsed / minimumLoadingTime) * 94), 94);
        loadingProgress.setAttribute("aria-valuenow", String(percentage));
        loadingPercentage.textContent = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        window.requestAnimationFrame(updateLoadingProgress);
      };

      window.requestAnimationFrame(updateLoadingProgress);
      window.setTimeout(() => {
        minimumTimePassed = true;
        dismissWelcomeScreen();
      }, minimumLoadingTime);

      if (!pageLoaded) {
        window.addEventListener("load", () => {
          pageLoaded = true;
          dismissWelcomeScreen();
        }, { once: true });
      }
    }

    const phoneCatalog = {
      "phone-11": [
        ["iPhone 11", "₦220,000"], ["iPhone 11 Pro", "₦270,000"], ["iPhone 11 Pro Max", "₦320,000"]
      ],
      "phone-x": [
        ["iPhone XR", "₦160,000"], ["iPhone X", "₦180,000"], ["iPhone XS", "₦210,000"], ["iPhone XS Max", "₦250,000"]
      ],
      "phone-12": [
        ["iPhone 12 mini", "₦300,000"], ["iPhone 12", "₦340,000"], ["iPhone 12 Pro", "₦380,000"], ["iPhone 12 Pro Max", "₦420,000"]
      ],
      "phone-13": [
        ["iPhone 13 mini", "₦420,000"], ["iPhone 13", "₦460,000"], ["iPhone 13 Pro", "₦510,000"], ["iPhone 13 Pro Max", "₦560,000"]
      ],
      "phone-14": [
        ["iPhone 14", "₦550,000"], ["iPhone 14 Plus", "₦600,000"], ["iPhone 14 Pro", "₦660,000"], ["iPhone 14 Pro Max", "₦720,000"]
      ],
      "phone-15": [
        ["iPhone 15", "₦700,000"], ["iPhone 15 Plus", "₦760,000"], ["iPhone 15 Pro", "₦830,000"], ["iPhone 15 Pro Max", "₦900,000"]
      ],
      "phone-16": [
        ["iPhone 16e", "₦900,000"], ["iPhone 16", "₦980,000"], ["iPhone 16 Pro", "₦1,070,000"], ["iPhone 16 Pro Max", "₦1,150,000"]
      ],
      "phone-17": [
        ["iPhone 17", "₦1,150,000"], ["iPhone 17 Air", "₦1,250,000"], ["iPhone 17 Pro", "₦1,350,000"], ["iPhone 17 Pro Max", "₦1,450,000"]
      ],
      "phone-18": [
        ["iPhone 18", "₦1,400,000"], ["iPhone 18 Plus", "₦1,520,000"], ["iPhone 18 Pro", "₦1,650,000"], ["iPhone 18 Pro Max", "₦1,800,000"]
      ]
    };

    document.querySelectorAll(".product-card").forEach((card) => {
      const models = phoneCatalog[card.id];
      const priceOverlay = card.querySelector(".product-price-overlay");

      if (!models || !priceOverlay) return;

      const heading = card.querySelector(".product-info h3").textContent;
      const listId = `${card.id}-prices`;
      priceOverlay.innerHTML = `
        <button class="price-toggle" type="button" aria-expanded="false" aria-controls="${listId}">View models + prices</button>
        <div class="price-panel" id="${listId}" aria-label="${heading} mock prices">
          <p>Sample prices in NGN</p>
          <ul>${models.map(([name, price]) => `<li><span>${name}</span><strong>${price}</strong></li>`).join("")}</ul>
        </div>
      `;

      const toggle = priceOverlay.querySelector(".price-toggle");
      toggle.addEventListener("click", () => {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isExpanded));
        card.classList.toggle("prices-open", !isExpanded);
      });
    });

    const menuToggle = document.querySelector(".menu-toggle");
    const primaryNavigation = document.querySelector("#primary-navigation");

    if (menuToggle && primaryNavigation) {
      const closeMenu = () => {
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        primaryNavigation.classList.remove("is-open");
      };

      menuToggle.addEventListener("click", () => {
        const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
        menuToggle.setAttribute("aria-expanded", String(!isExpanded));
        menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation" : "Close navigation");
        primaryNavigation.classList.toggle("is-open", !isExpanded);
      });

      primaryNavigation.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
      });

      window.matchMedia("(min-width: 901px)").addEventListener("change", closeMenu);
    }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const productCards = document.querySelectorAll(".product-card");

      if (!reducedMotion && "IntersectionObserver" in window) {
        document.documentElement.classList.add("motion-ready");
        const hero = document.querySelector(".hero");
        if (hero) hero.classList.add("is-visible");

        const cardObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });

        productCards.forEach((card, index) => {
          card.style.setProperty("--card-index", String(index));
          cardObserver.observe(card);
        });
      }
    