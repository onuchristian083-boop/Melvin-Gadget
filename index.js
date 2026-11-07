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

    let phonePriceListPromise;
    window.phonePriceList = {
      load() {
        if (!phonePriceListPromise) {
          phonePriceListPromise = fetch("mock-database.json")
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Price list request failed with status ${response.status}`);
              }
              return response.json();
            })
            .then((priceList) => {
              if (!priceList || !Array.isArray(priceList.data)) {
                throw new Error("The mock phone database has an invalid format");
              }

              const conditionMultipliers = priceList.condition_multipliers;
              const requiredConditions = ["NAIJA_USED", "UK_USED", "CHANGED_BATTERY", "CHANGED_SCREEN"];
              const hasInvalidMultipliers = !conditionMultipliers ||
                requiredConditions.some((condition) =>
                  !Number.isFinite(conditionMultipliers[condition]) || conditionMultipliers[condition] <= 0
                ) || conditionMultipliers.NAIJA_USED !== 1;

              if (hasInvalidMultipliers) {
                throw new Error("The mock phone database has invalid condition price multipliers");
              }

              const products = priceList.data.filter((product) => product && product.category === "APPLE_PHONE");
              const hasInvalidProduct = products.some((product) =>
                typeof product.model !== "string" ||
                !Number.isFinite(product.lowest_price) ||
                product.lowest_price < 0 ||
                typeof product.condition !== "string" ||
                !product.attributes ||
                typeof product.attributes.storage !== "string"
              );

              if (hasInvalidProduct) {
                throw new Error("The mock phone database contains an invalid Apple phone record");
              }

              return products.flatMap((product) =>
                requiredConditions.map((condition) => ({
                  ...product,
                  condition,
                  lowest_price: Math.round(product.lowest_price * conditionMultipliers[condition])
                }))
              );
            });
        }

        return phonePriceListPromise;
      },
      seriesIdForModel(modelName) {
        const match = modelName.match(/^iPhone\s+(XR|XS|X|1[1-8]|[0-9])(?=\b|[a-z])/i);
        if (!match) return null;

        const modelPrefix = match[1].toLowerCase();
        return ["x", "xr", "xs"].includes(modelPrefix) ? "phone-x" : `phone-${modelPrefix}`;
      },
      formatPrice(price) {
        return `₦${price.toLocaleString("en-NG")}`;
      }
    };

    document.querySelectorAll(".product-card").forEach((card) => {
      if (document.body.dataset.pageTitle === "Phones") {
        card.addEventListener("click", (event) => {
          if (event.target.closest("a, button, .product-price-overlay")) return;
          window.location.href = `phone-series.html?series=${encodeURIComponent(card.id)}`;
        });
      }

      const priceOverlay = card.querySelector(".product-price-overlay");

      if (!priceOverlay) return;

      const heading = card.querySelector(".product-info h3").textContent.trim();
      const fullPriceListLink = document.createElement("a");
      fullPriceListLink.className = "price-toggle";
      fullPriceListLink.href = `phone-series.html?series=${encodeURIComponent(card.id)}`;
      fullPriceListLink.textContent = "Open full price list";
      fullPriceListLink.setAttribute("aria-label", `View all storage and condition prices for ${heading}`);
      priceOverlay.replaceChildren(fullPriceListLink);
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
    