(() => {
  const storageKey = "melvin-gadgets-order";
  const orderNumber = "2349130141794";
  const loadCart = () => {
    try {
      const savedCart = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(savedCart)) return [];
      return savedCart.filter((item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.detail === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      );
    } catch {
      return [];
    }
  };

  let cart = loadCart();
  const status = document.createElement("p");
  status.className = "cart-announcement";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.append(status);

  const announce = (message) => {
    status.textContent = message;
    status.classList.add("is-visible");
    window.clearTimeout(announce.timeoutId);
    announce.timeoutId = window.setTimeout(() => status.classList.remove("is-visible"), 2600);
  };

  const saveCart = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
      return true;
    } catch {
      announce("Your browser could not save the order. Check its storage settings and try again.");
      return false;
    }
  };

  const itemCount = () => cart.reduce((total, item) => total + item.quantity, 0);

  const updateCartLinks = () => {
    document.querySelectorAll(".cart-nav-link").forEach((link) => {
      const count = link.querySelector(".cart-count");
      if (count) count.textContent = String(itemCount());
      link.setAttribute("aria-label", `Order request, ${itemCount()} ${itemCount() === 1 ? "item" : "items"}`);
    });
  };

  const addCartLink = () => {
    const header = document.querySelector(".headerwrapper");
    if (!header || header.querySelector(".cart-nav-link")) return;

    const link = document.createElement("a");
    link.className = "cart-nav-link";
    link.href = "cart.html";
    link.setAttribute("aria-label", "Order request, 0 items");
    const icon = document.createElement("img");
    icon.src = "cart.png";
    icon.alt = "";
    const label = document.createElement("span");
    label.append("Order ");
    const count = document.createElement("span");
    count.className = "cart-count";
    count.textContent = "0";
    label.append(count);
    link.append(icon, label);

    const menuToggle = header.querySelector(".menu-toggle");
    header.insertBefore(link, menuToggle || null);
  };

  const createButton = (label, action, itemId, className = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.dataset.cartAction = action;
    button.dataset.itemId = itemId;
    return button;
  };

  const renderCart = () => {
    const itemList = document.querySelector("#cart-items");
    const emptyState = document.querySelector("#cart-empty");
    const countLabel = document.querySelector("#cart-summary-count");
    const requestForm = document.querySelector("#order-request-form");
    const checkoutHint = document.querySelector("#cart-checkout-hint");
    if (!itemList) return;

    itemList.replaceChildren();
    if (countLabel) countLabel.textContent = `${itemCount()} ${itemCount() === 1 ? "item" : "items"}`;
    if (emptyState) emptyState.hidden = cart.length > 0;
    if (requestForm) requestForm.hidden = cart.length === 0;
    if (checkoutHint) checkoutHint.hidden = cart.length > 0;

    cart.forEach((item) => {
      const row = document.createElement("article");
      row.className = "cart-item";
      const description = document.createElement("div");
      description.className = "cart-item-description";
      const name = document.createElement("h2");
      name.textContent = item.name;
      const detail = document.createElement("p");
      detail.textContent = item.detail;
      description.append(name, detail);

      const controls = document.createElement("div");
      controls.className = "cart-item-controls";
      controls.setAttribute("aria-label", `Quantity for ${item.name}`);
      controls.append(
        createButton("−", "decrease", item.id, "quantity-button"),
        Object.assign(document.createElement("span"), { textContent: String(item.quantity), className: "cart-quantity" }),
        createButton("+", "increase", item.id, "quantity-button"),
        createButton("Remove", "remove", item.id, "cart-remove")
      );
      row.append(description, controls);
      itemList.append(row);
    });
  };

  const render = () => {
    updateCartLinks();
    renderCart();
  };

  addCartLink();
  render();

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-cart-item]");
    if (addButton) {
      const item = {
        id: addButton.dataset.itemId,
        name: addButton.dataset.itemName,
        detail: addButton.dataset.itemDetail || "",
        quantity: 1
      };
      if (!item.id || !item.name) return;

      const existing = cart.find((entry) => entry.id === item.id);
      if (existing) existing.quantity += 1;
      else cart.push(item);

      if (!saveCart()) return;
      render();
      announce(`${item.name} added to your order request.`);
      return;
    }

    const actionButton = event.target.closest("[data-cart-action]");
    if (!actionButton) return;
    const item = cart.find((entry) => entry.id === actionButton.dataset.itemId);
    if (!item) return;

    if (actionButton.dataset.cartAction === "increase") item.quantity += 1;
    if (actionButton.dataset.cartAction === "decrease") item.quantity = Math.max(1, item.quantity - 1);
    if (actionButton.dataset.cartAction === "remove") cart = cart.filter((entry) => entry.id !== item.id);

    if (saveCart()) render();
  });

  const orderForm = document.querySelector("#order-request-form");
  if (orderForm) {
    orderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (cart.length === 0 || !orderForm.reportValidity()) return;

      const customerName = orderForm.elements.customerName.value.trim();
      const customerPhone = orderForm.elements.customerPhone.value.trim();
      const note = orderForm.elements.orderNote.value.trim();
      const itemLines = cart.map((item) => `- ${item.quantity} x ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
      const message = [
        "Hello Melvin Gadgets, I would like to place an order request:",
        ...itemLines,
        "",
        `Name: ${customerName}`,
        `Phone: ${customerPhone}`,
        note ? `Note: ${note}` : "",
        "Please confirm availability, final prices, and delivery or pickup details."
      ].filter(Boolean).join("\n");
      const whatsappUrl = `https://wa.me/${orderNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    });
  }
})();
