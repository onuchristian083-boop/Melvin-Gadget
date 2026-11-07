(() => {
  const seriesMetadata = {
    "phone-11": { title: "iPhone 11 Series", image: "11 series.jfif" },
    "phone-x": { title: "iPhone X Series", image: "x series.jfif" },
    "phone-12": { title: "iPhone 12 Series", image: "12 series.jfif" },
    "phone-13": { title: "iPhone 13 Series", image: "13 series.jfif" },
    "phone-14": { title: "iPhone 14 Series", image: "14 series.jfif" },
    "phone-15": { title: "iPhone 15 Series", image: "15 series.jfif" },
    "phone-16": { title: "iPhone 16 Series", image: "16 series.jfif" },
    "phone-17": { title: "iPhone 17 Series", image: "17 series.jfif" },
    "phone-18": { title: "iPhone 18 Series", image: "18 series.jfif" }
  };

  const requestedSeriesId = new URLSearchParams(window.location.search).get("series");
  const selectedSeriesId = seriesMetadata[requestedSeriesId] ? requestedSeriesId : "phone-x";
  const selectedSeries = seriesMetadata[selectedSeriesId];
  document.body.dataset.pageTitle = selectedSeries.title;
  const seriesImage = document.querySelector("#series-image");
  const seriesTitle = document.querySelector("#series-title");
  const seriesModels = document.querySelector("#series-models");

  document.title = `${selectedSeries.title} | Melvin Gadgets`;
  seriesImage.src = selectedSeries.image;
  seriesImage.alt = selectedSeries.title;
  seriesTitle.textContent = selectedSeries.title;
  seriesModels.textContent = "Loading sample prices...";

  const addCell = (row, value, isHeader = false) => {
    const cell = document.createElement(isHeader ? "th" : "td");
    if (isHeader) cell.scope = "col";
    cell.textContent = value;
    row.append(cell);
  };

  const formatCondition = (condition) => {
    const conditionLabels = {
      BRAND_NEW: "Brand new",
      UK_USED: "UK used",
      NAIJA_USED: "Naija used",
      CHANGED_BATTERY: "Changed battery",
      CHANGED_SCREEN: "Changed screen"
    };

    return conditionLabels[condition] || condition.toLowerCase().replace(/_/g, " ");
  };

  window.phonePriceList.load().then((products) => {
    const seriesProducts = products.filter(
      (product) => window.phonePriceList.seriesIdForModel(product.model) === selectedSeriesId
    );
    if (seriesProducts.length === 0) {
      seriesModels.textContent = "No sample prices for this series are in the mock database.";
      return;
    }

    const models = new Map();
    seriesProducts.forEach((product) => {
      if (!models.has(product.model)) models.set(product.model, []);
      models.get(product.model).push(product);
    });

    const sections = Array.from(models.entries())
      .sort(([firstModel], [secondModel]) => firstModel.localeCompare(secondModel, undefined, { numeric: true }))
      .map(([model, variants], modelIndex) => {
        const section = document.createElement("section");
        section.className = "storage-model";
        section.style.setProperty("--section-index", String(modelIndex));
        const heading = document.createElement("h2");
        heading.id = `model-${modelIndex}`;
        heading.textContent = model;
        section.setAttribute("aria-labelledby", heading.id);

        const table = document.createElement("table");
        const tableHead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Storage", "Condition", "Price", "Order"].forEach((label) => addCell(headerRow, label, true));
        tableHead.append(headerRow);

        const tableBody = document.createElement("tbody");
        variants.forEach((variant) => {
          const row = document.createElement("tr");
          addCell(row, variant.attributes.storage.toUpperCase());
          addCell(row, formatCondition(variant.condition));
          addCell(row, window.phonePriceList.formatPrice(variant.lowest_price));
          const orderCell = document.createElement("td");
          const orderButton = document.createElement("button");
          orderButton.className = "cart-add-button";
          orderButton.type = "button";
          orderButton.textContent = "Add";
          orderButton.dataset.cartItem = "true";
          orderButton.dataset.itemId = `${variant.model}|${variant.attributes.storage}|${variant.condition}`;
          orderButton.dataset.itemName = variant.model;
          orderButton.dataset.itemDetail = `${variant.attributes.storage.toUpperCase()} · ${formatCondition(variant.condition)}`;
          orderButton.setAttribute("aria-label", `Add ${variant.model} ${variant.attributes.storage} ${formatCondition(variant.condition)} to order request`);
          orderCell.append(orderButton);
          row.append(orderCell);
          tableBody.append(row);
        });

        table.append(tableHead, tableBody);
        section.append(heading, table);
        return section;
      });

    seriesModels.replaceChildren(...sections);
  }).catch((error) => {
    console.error("Could not load the mock phone database.", error);
    seriesModels.textContent = "Prices are unavailable right now. Please try again later.";
  });
})();
