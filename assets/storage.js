import {
  createDefaultQuoteDelivery,
  createEmptyQuoteDraft,
  DEFAULT_GARMENT_CATEGORIES,
  DEFAULT_GARMENTS,
  DEFAULT_PRINT_POSITIONS,
  DEFAULT_PRINT_SIZES,
  DEFAULT_POSITION_SIZE_BINDINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SIZE_PRICES,
  DEFAULT_UI_STATE,
  PAGES,
  QUANTITY_OPTIONS,
  STORAGE_KEYS,
} from "./config.js?v=rc7";
import {
  applyQuotePrintPricing,
  calculateGarmentSellPrice,
  resolveQuantityBracket,
} from "./calculations.js?v=rc7";
import { deepClone, formatDimensions, generateId, sanitiseNumber, slugify } from "./utils.js?v=rc7";

export function loadStored(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (value == null || value === "undefined") {
      return deepClone(fallback);
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn(`Unable to load ${key}`, error);
    return deepClone(fallback);
  }
}

export function persist(key, value) {
  const serialised = JSON.stringify(value);
  if (typeof serialised === "undefined") {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, serialised);
}

export function hydrateSettings(storedSettings) {
  return {
    vatRate: sanitiseNumber(storedSettings?.vatRate, DEFAULT_SETTINGS.vatRate),
    markupRate: sanitiseNumber(storedSettings?.markupRate, DEFAULT_SETTINGS.markupRate),
    deliveryServiceName: String(
      storedSettings?.deliveryServiceName || DEFAULT_SETTINGS.deliveryServiceName,
    ).trim(),
    deliveryPricePerBox: sanitiseNumber(
      storedSettings?.deliveryPricePerBox,
      DEFAULT_SETTINGS.deliveryPricePerBox,
    ),
    defaultDeliveryBoxes: Math.max(
      0,
      Math.floor(
        sanitiseNumber(storedSettings?.defaultDeliveryBoxes, DEFAULT_SETTINGS.defaultDeliveryBoxes),
      ),
    ),
  };
}

export function hydrateCategories(storedCategories) {
  if (!Array.isArray(storedCategories) || !storedCategories.length) {
    return deepClone(DEFAULT_GARMENT_CATEGORIES);
  }

  const seenIds = new Set();
  const categories = storedCategories
    .map((category, index) => {
      const label =
        typeof category === "string"
          ? category.trim()
          : String(category?.label || "").trim();
      const idBase =
        typeof category === "string"
          ? slugify(label)
          : String(category?.id || slugify(label)).trim();
      const id = idBase || `category-${index + 1}`;

      if (!label || seenIds.has(id)) {
        return null;
      }

      seenIds.add(id);
      return { id, label };
    })
    .filter(Boolean);

  return categories.length ? categories : deepClone(DEFAULT_GARMENT_CATEGORIES);
}

export function hydratePositions(storedPositions) {
  if (!Array.isArray(storedPositions) || !storedPositions.length) {
    return deepClone(DEFAULT_PRINT_POSITIONS);
  }

  return storedPositions
    .map((position) => ({
      id: String(position.id || "").trim(),
      label: String(position.label || "").trim(),
    }))
    .filter((position) => position.id && position.label);
}

export function hydrateSizes(storedSizes) {
  if (!Array.isArray(storedSizes) || !storedSizes.length) {
    return deepClone(DEFAULT_PRINT_SIZES);
  }

  return storedSizes
    .map((size) => ({
      id: String(size.id || "").trim(),
      label: String(size.label || "").trim(),
      widthMm: sanitiseNumber(size.widthMm, 0),
      heightMm: sanitiseNumber(size.heightMm, 0),
    }))
    .filter((size) => size.id && size.label);
}

export function hydratePricing(storedPricing, positions, sizes) {
  const pricing = {};

  positions.forEach((position) => {
    pricing[position.id] = {};

    sizes.forEach((size) => {
      pricing[position.id][size.id] = {};

      QUANTITY_OPTIONS.forEach((quantity) => {
        const defaultValue = DEFAULT_SIZE_PRICES?.[size.id]?.[quantity] ?? 0;
        pricing[position.id][size.id][quantity] = sanitiseNumber(
          storedPricing?.[position.id]?.[size.id]?.[quantity],
          defaultValue,
        );
      });
    });
  });

  return pricing;
}

export function hydratePositionSizeBindings(storedBindings, positions, sizes) {
  const validSizeIds = new Set(sizes.map((size) => size.id));
  const defaultSizeIds = sizes.map((size) => size.id);
  const hasStoredBindings =
    storedBindings && typeof storedBindings === "object" && !Array.isArray(storedBindings);
  const bindings = {};

  positions.forEach((position) => {
    const storedSizeIds = Array.isArray(storedBindings?.[position.id])
      ? storedBindings[position.id]
      : null;
    const fallbackSizeIds = Array.isArray(DEFAULT_POSITION_SIZE_BINDINGS[position.id])
      ? DEFAULT_POSITION_SIZE_BINDINGS[position.id]
      : defaultSizeIds;
    const sourceSizeIds = storedSizeIds || (hasStoredBindings ? defaultSizeIds : fallbackSizeIds);
    const nextSizeIds = sourceSizeIds.filter(
      (sizeId, index) => validSizeIds.has(sizeId) && sourceSizeIds.indexOf(sizeId) === index,
    );

    bindings[position.id] = nextSizeIds;
  });

  const hasAnyAttachedSizes = Object.values(bindings).some(
    (attachedSizeIds) => Array.isArray(attachedSizeIds) && attachedSizeIds.length > 0,
  );
  if (!hasAnyAttachedSizes) {
    positions.forEach((position) => {
      const fallbackSizeIds = Array.isArray(DEFAULT_POSITION_SIZE_BINDINGS[position.id])
        ? DEFAULT_POSITION_SIZE_BINDINGS[position.id]
        : defaultSizeIds;

      bindings[position.id] = fallbackSizeIds.filter(
        (sizeId, index) => validSizeIds.has(sizeId) && fallbackSizeIds.indexOf(sizeId) === index,
      );
    });
  }

  return bindings;
}

function resolveCategoryId(categoryId, categories) {
  return (
    categories.find((category) => category.id === categoryId)?.id ||
    categories[0]?.id ||
    DEFAULT_GARMENT_CATEGORIES[0]?.id ||
    ""
  );
}

export function hydrateGarments(storedGarments, settings, categories) {
  const garmentsSource =
    Array.isArray(storedGarments) && storedGarments.length ? storedGarments : DEFAULT_GARMENTS;

  if (!Array.isArray(garmentsSource)) {
    return [];
  }

  return garmentsSource
    .map((garment) => {
      const costPrice = sanitiseNumber(garment.costPrice, 0);
      return {
        id: garment.id || generateId(),
        categoryId: resolveCategoryId(garment.categoryId || garment.category, categories),
        name: String(garment.name || "").trim(),
        brand: String(garment.brand || "").trim(),
        code: String(garment.code || "").trim(),
        notes: String(garment.notes || "").trim(),
        costPrice,
        sellPrice: calculateGarmentSellPrice(costPrice, settings),
        updatedAt: garment.updatedAt || new Date().toISOString(),
      };
    })
    .filter((garment) => garment.name);
}

function hydrateQuoteItemPrints(storedPrints, positions, sizes) {
  if (!Array.isArray(storedPrints)) {
    return [];
  }

  return storedPrints.map((printLine) => {
    const size = sizes.find((item) => item.id === printLine.sizeId);
    const position = positions.find((item) => item.id === printLine.positionId);

    return {
      id: printLine.id || generateId(),
      positionId: String(printLine.positionId || position?.id || ""),
      sizeId: String(printLine.sizeId || size?.id || ""),
      positionLabel: position?.label || String(printLine.positionLabel || "Custom"),
      sizeLabel: size?.label || String(printLine.sizeLabel || "Custom"),
      sizeDimensions: size ? formatDimensions(size) : String(printLine.sizeDimensions || ""),
      price: sanitiseNumber(printLine.price, 0),
    };
  });
}

function hydrateDraftPrints(storedPrints, positions, sizes) {
  if (!Array.isArray(storedPrints)) {
    return [];
  }

  return storedPrints
    .map((printLine) => {
      const size = sizes.find((item) => item.id === printLine.sizeId);
      const position = positions.find((item) => item.id === printLine.positionId);

      if (!size || !position) {
        return null;
      }

      return {
        id: printLine.id || generateId(),
        positionId: position.id,
        sizeId: size.id,
        price: sanitiseNumber(printLine.price, 0),
      };
    })
    .filter(Boolean);
}

export function hydrateQuoteItems(storedQuoteItems, positions, sizes, categories, settings) {
  if (!Array.isArray(storedQuoteItems)) {
    return [];
  }

  return storedQuoteItems.map((item) => {
    const quantity = Math.max(1, Math.floor(sanitiseNumber(item?.quantity, 1)));
    const quantityMode =
      item?.quantityMode === "custom" || !QUANTITY_OPTIONS.includes(quantity)
        ? "custom"
        : "preset";
    const costPrice = sanitiseNumber(item?.garment?.costPrice, 0);
    const sellPrice = sanitiseNumber(
      item?.garment?.sellPrice,
      calculateGarmentSellPrice(costPrice, settings),
    );

    return {
      id: item?.id || generateId(),
      quantityMode,
      quantity,
      customQuantity:
        quantityMode === "custom" ? String(item?.customQuantity || quantity) : "",
      quantityBracket: resolveQuantityBracket(quantity),
      garment: {
        id: String(item?.garment?.id || ""),
        categoryId: resolveCategoryId(
          item?.garment?.categoryId || item?.garment?.category,
          categories,
        ),
        name: String(item?.garment?.name || "").trim(),
        brand: String(item?.garment?.brand || "").trim(),
        code: String(item?.garment?.code || "").trim(),
        notes: String(item?.garment?.notes || "").trim(),
        costPrice,
        sellPrice,
      },
      prints: hydrateQuoteItemPrints(item?.prints, positions, sizes),
      createdAt: item?.createdAt || new Date().toISOString(),
    };
  });
}

export function hydrateQuoteDraft(storedDraft, positions, sizes, categories) {
  const fallbackDraft = createEmptyQuoteDraft(
    positions[0]?.id,
    sizes[0]?.id,
    categories[0]?.id,
  );

  if (!storedDraft || typeof storedDraft !== "object") {
    return fallbackDraft;
  }

  const quantity = Math.max(
    1,
    Math.floor(sanitiseNumber(storedDraft.quantity, fallbackDraft.quantity)),
  );
  const quantityMode =
    storedDraft.quantityMode === "custom" || !QUANTITY_OPTIONS.includes(quantity)
      ? "custom"
      : "preset";

  return {
    quantityMode,
    quantity,
    customQuantity:
      quantityMode === "custom" ? String(storedDraft.customQuantity || quantity) : "",
    editingItemId: String(storedDraft.editingItemId || ""),
    garment: {
      sourceId: String(storedDraft.garment?.sourceId || ""),
      categoryId: resolveCategoryId(
        storedDraft.garment?.categoryId || storedDraft.garment?.category,
        categories,
      ),
      name: String(storedDraft.garment?.name || ""),
      brand: String(storedDraft.garment?.brand || ""),
      code: String(storedDraft.garment?.code || ""),
      costPrice: storedDraft.garment?.costPrice ?? "",
      notes: String(storedDraft.garment?.notes || ""),
    },
    printDraft: {
      positionId:
        positions.find((position) => position.id === storedDraft.printDraft?.positionId)?.id ||
        fallbackDraft.printDraft.positionId,
      sizeId:
        sizes.find((size) => size.id === storedDraft.printDraft?.sizeId)?.id ||
        fallbackDraft.printDraft.sizeId,
      price: storedDraft.printDraft?.price ?? "",
    },
    prints: hydrateDraftPrints(storedDraft.prints, positions, sizes),
  };
}

export function hydrateQuoteDelivery(storedDelivery, settings) {
  const fallbackDelivery = createDefaultQuoteDelivery(settings);
  const boxes = Math.max(0, Math.floor(sanitiseNumber(storedDelivery?.boxes, fallbackDelivery.boxes)));
  const boxMode = "custom";

  return {
    serviceName: String(storedDelivery?.serviceName || fallbackDelivery.serviceName).trim(),
    pricePerBox: sanitiseNumber(storedDelivery?.pricePerBox, fallbackDelivery.pricePerBox),
    boxMode,
    boxes,
    customBoxes: boxMode === "custom" ? String(storedDelivery?.customBoxes || boxes) : "",
  };
}

function hydrateQuoteRecord(storedQuote, positions, sizes, categories, settings, pricing) {
  const quoteItems = applyQuotePrintPricing(
    hydrateQuoteItems(
      storedQuote?.quoteItems,
      positions,
      sizes,
      categories,
      settings,
    ),
    pricing,
  );

  return {
    id: storedQuote?.id || generateId(),
    name: String(storedQuote?.name || "").trim(),
    quoteItems,
    quoteDraft: hydrateQuoteDraft(storedQuote?.quoteDraft, positions, sizes, categories),
    delivery: hydrateQuoteDelivery(storedQuote?.delivery, settings),
    createdAt: storedQuote?.createdAt || new Date().toISOString(),
    updatedAt: storedQuote?.updatedAt || new Date().toISOString(),
  };
}

function hydrateQuotes(storedQuotes, positions, sizes, categories, settings, pricing) {
  if (!Array.isArray(storedQuotes)) {
    return [];
  }

  return storedQuotes
    .map((quote) => hydrateQuoteRecord(quote, positions, sizes, categories, settings, pricing))
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}

function hydrateUiState(storedUiState, quotes, positions, sizes) {
  return {
    activePage: PAGES.includes(storedUiState?.activePage) ? storedUiState.activePage : "quote",
    activeQuoteId:
      quotes.find((quote) => quote.id === storedUiState?.activeQuoteId)?.id || quotes[0]?.id || "",
    pricingPositionId:
      positions.find((position) => position.id === storedUiState?.pricingPositionId)?.id ||
      positions[0]?.id ||
      "",
    pricingSizeId:
      sizes.find((size) => size.id === storedUiState?.pricingSizeId)?.id || "",
    pricingCardSizeId:
      sizes.find((size) => size.id === storedUiState?.pricingCardSizeId)?.id || "",
    garmentPickerOpenCategories:
      storedUiState?.garmentPickerOpenCategories &&
      typeof storedUiState.garmentPickerOpenCategories === "object"
        ? storedUiState.garmentPickerOpenCategories
        : deepClone(DEFAULT_UI_STATE.garmentPickerOpenCategories),
    garmentLibraryOpenCategories:
      storedUiState?.garmentLibraryOpenCategories &&
      typeof storedUiState.garmentLibraryOpenCategories === "object"
        ? storedUiState.garmentLibraryOpenCategories
        : deepClone(DEFAULT_UI_STATE.garmentLibraryOpenCategories),
  };
}

export function loadAppState() {
  const settings = hydrateSettings(loadStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
  const positions = hydratePositions(loadStored(STORAGE_KEYS.positions, DEFAULT_PRINT_POSITIONS));
  const sizes = hydrateSizes(loadStored(STORAGE_KEYS.sizes, DEFAULT_PRINT_SIZES));
  const positionSizeBindings = hydratePositionSizeBindings(
    loadStored(STORAGE_KEYS.positionSizeBindings, {}),
    positions,
    sizes,
  );
  const garmentCategories = hydrateCategories(
    loadStored(STORAGE_KEYS.garmentCategories, DEFAULT_GARMENT_CATEGORIES),
  );
  const pricing = hydratePricing(loadStored(STORAGE_KEYS.pricing, {}), positions, sizes);
  const garments = hydrateGarments(
    loadStored(STORAGE_KEYS.garments, []),
    settings,
    garmentCategories,
  );

  let quotes = hydrateQuotes(
    loadStored(STORAGE_KEYS.quotes, []),
    positions,
    sizes,
    garmentCategories,
    settings,
    pricing,
  );

  if (!quotes.length) {
    const legacyQuoteItems = loadStored(STORAGE_KEYS.legacyQuoteItems, []);
    const legacyQuoteDraft = loadStored(STORAGE_KEYS.legacyQuoteDraft, null);
    const hasLegacyQuote =
      (Array.isArray(legacyQuoteItems) && legacyQuoteItems.length > 0) ||
      Boolean(legacyQuoteDraft);

    if (hasLegacyQuote) {
      quotes = [
        hydrateQuoteRecord(
          {
            name: "",
            quoteItems: legacyQuoteItems,
            quoteDraft: legacyQuoteDraft,
          },
          positions,
          sizes,
          garmentCategories,
          settings,
          pricing,
        ),
      ];
    }
  }

  if (!quotes.length) {
    quotes = [
        hydrateQuoteRecord(
          {
            name: "",
            quoteItems: [],
          quoteDraft: createEmptyQuoteDraft(
            positions[0]?.id,
            sizes[0]?.id,
            garmentCategories[0]?.id,
          ),
        },
        positions,
          sizes,
          garmentCategories,
          settings,
          pricing,
        ),
      ];
  }

  const uiState = hydrateUiState(
    loadStored(STORAGE_KEYS.uiState, DEFAULT_UI_STATE),
    quotes,
    positions,
    sizes,
  );

  return {
    settings,
    positions,
    sizes,
    positionSizeBindings,
    garmentCategories,
    pricing,
    garments,
    quotes,
    uiState,
  };
}
