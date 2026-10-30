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
        document.querySelector(".hero").classList.add("is-visible");

        const cardObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });

        productCards.forEach((card) => cardObserver.observe(card));
      }
    