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
} from "./config.js?v=rc14";
import { calculateGarmentSellPrice } from "./calculations.js?v=rc14";
import {
  deepClone,
  generateId,
  sanitiseNumber,
  slugify,
} from "./utils.js?v=rc14";

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

function createGarmentMatchKey(garment) {
  return [garment?.brand, garment?.code, garment?.name]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("::");
}

function createLibraryGarmentRecord(garment, categories, settings, existingId = garment?.id) {
  const costPrice = sanitiseNumber(garment?.costPrice, 0);

  return {
    id: existingId || generateId(),
    categoryId: resolveCategoryId(garment?.categoryId || garment?.category, categories),
    name: String(garment?.name || "").trim(),
    brand: String(garment?.brand || "").trim(),
    code: String(garment?.code || "").trim(),
    notes: String(garment?.notes || "").trim(),
    costPrice,
    sellPrice: calculateGarmentSellPrice(costPrice, settings),
    updatedAt: garment?.updatedAt || new Date().toISOString(),
  };
}

export function mergeQuoteGarmentsIntoLibrary(
  garments,
  storedQuotes,
  legacyQuoteItems,
  categories,
  settings,
) {
  const nextGarments = [...garments];
  const seenIds = new Set(nextGarments.map((garment) => garment.id));
  const seenKeys = new Set(
    nextGarments.map((garment) => createGarmentMatchKey(garment)).filter((key) => key !== "::"),
  );
  const quoteItems = [
    ...(Array.isArray(legacyQuoteItems) ? legacyQuoteItems : []),
    ...(Array.isArray(storedQuotes)
      ? storedQuotes.flatMap((quote) => (Array.isArray(quote?.quoteItems) ? quote.quoteItems : []))
      : []),
  ];

  quoteItems.forEach((item) => {
    if (!item?.garment || typeof item.garment !== "object") {
      return;
    }

    const matchKey = createGarmentMatchKey(item.garment);
    const requestedId = String(item.garment.id || "").trim();
    if ((matchKey && seenKeys.has(matchKey)) || (requestedId && seenIds.has(requestedId))) {
      return;
    }

    const nextGarment = createLibraryGarmentRecord(
      item.garment,
      categories,
      settings,
      requestedId || undefined,
    );
    if (!nextGarment.name) {
      return;
    }

    nextGarments.unshift(nextGarment);
    seenIds.add(nextGarment.id);
    seenKeys.add(createGarmentMatchKey(nextGarment));
  });

  return nextGarments;
}

function resolveStoredQuoteGarmentId(item, garments) {
  const requestedId = String(item?.garmentId || item?.garment?.id || "").trim();
  if (requestedId && garments.some((garment) => garment.id === requestedId)) {
    return requestedId;
  }

  const matchKey = createGarmentMatchKey(item?.garment);
  if (!matchKey) {
    return requestedId;
  }

  return garments.find((garment) => createGarmentMatchKey(garment) === matchKey)?.id || requestedId;
}

function resolveStoredPositionId(printLine, positions) {
  const requestedId = String(printLine?.positionId || "").trim();
  if (requestedId && positions.some((position) => position.id === requestedId)) {
    return requestedId;
  }

  const label = String(printLine?.positionLabel || "").trim().toLowerCase();
  return positions.find((position) => position.label.trim().toLowerCase() === label)?.id || "";
}

function resolveStoredSizeId(printLine, sizes) {
  const requestedId = String(printLine?.sizeId || "").trim();
  if (requestedId && sizes.some((size) => size.id === requestedId)) {
    return requestedId;
  }

  const label = String(printLine?.sizeLabel || "").trim().toLowerCase();
  const labelMatch = sizes.find((size) => size.label.trim().toLowerCase() === label)?.id;
  if (labelMatch) {
    return labelMatch;
  }

  const widthMm = sanitiseNumber(printLine?.widthMm, Number.NaN);
  const heightMm = sanitiseNumber(printLine?.heightMm, Number.NaN);
  if (Number.isFinite(widthMm) && Number.isFinite(heightMm)) {
    return (
      sizes.find((size) => size.widthMm === widthMm && size.heightMm === heightMm)?.id || ""
    );
  }

  return "";
}

function hydrateQuoteItemPrints(storedPrints, positions, sizes) {
  if (!Array.isArray(storedPrints)) {
    return [];
  }

  return storedPrints
    .map((printLine) => {
      const positionId = resolveStoredPositionId(printLine, positions);
      const sizeId = resolveStoredSizeId(printLine, sizes);

      if (!positionId || !sizeId) {
        return null;
      }

      return {
        id: printLine.id || generateId(),
        positionId,
        sizeId,
      };
    })
    .filter(Boolean);
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

export function hydrateQuoteItems(storedQuoteItems, positions, sizes, garments) {
  if (!Array.isArray(storedQuoteItems)) {
    return [];
  }

  return storedQuoteItems.map((item) => {
    const quantity = Math.max(1, Math.floor(sanitiseNumber(item?.quantity, 1)));
    const quantityMode =
      item?.quantityMode === "custom" || !QUANTITY_OPTIONS.includes(quantity)
        ? "custom"
        : "preset";

    return {
      id: item?.id || generateId(),
      quantityMode,
      quantity,
      customQuantity:
        quantityMode === "custom" ? String(item?.customQuantity || quantity) : "",
      garmentId: resolveStoredQuoteGarmentId(item, garments),
      prints: hydrateQuoteItemPrints(item?.prints, positions, sizes),
      createdAt: item?.createdAt || new Date().toISOString(),
    };
  });
}

export function hydrateQuoteDraft(storedDraft, positions, sizes, categories, garments) {
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
  const linkedGarment = garments.find(
    (garment) => garment.id === String(storedDraft.garment?.sourceId || "").trim(),
  );
  const garmentSource = linkedGarment || storedDraft.garment || {};

  return {
    quantityMode,
    quantity,
    customQuantity:
      quantityMode === "custom" ? String(storedDraft.customQuantity || quantity) : "",
    editingItemId: String(storedDraft.editingItemId || ""),
    garment: {
      sourceId: linkedGarment ? linkedGarment.id : "",
      categoryId: resolveCategoryId(
        garmentSource.categoryId || garmentSource.category,
        categories,
      ),
      name: String(garmentSource.name || ""),
      brand: String(garmentSource.brand || ""),
      code: String(garmentSource.code || ""),
      costPrice: linkedGarment
        ? linkedGarment.costPrice.toFixed(2)
        : storedDraft.garment?.costPrice ?? "",
      notes: String(garmentSource.notes || ""),
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

function hydrateQuoteRecord(storedQuote, positions, sizes, categories, settings, garments) {
  return {
    id: storedQuote?.id || generateId(),
    name: String(storedQuote?.name || "").trim(),
    quoteItems: hydrateQuoteItems(storedQuote?.quoteItems, positions, sizes, garments),
    quoteDraft: hydrateQuoteDraft(
      storedQuote?.quoteDraft,
      positions,
      sizes,
      categories,
      garments,
    ),
    delivery: hydrateQuoteDelivery(storedQuote?.delivery, settings),
    createdAt: storedQuote?.createdAt || new Date().toISOString(),
    updatedAt: storedQuote?.updatedAt || new Date().toISOString(),
  };
}

function hydrateQuotes(storedQuotes, positions, sizes, categories, settings, garments) {
  if (!Array.isArray(storedQuotes)) {
    return [];
  }

  return storedQuotes
    .map((quote) => hydrateQuoteRecord(quote, positions, sizes, categories, settings, garments))
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
  const storedQuotes = loadStored(STORAGE_KEYS.quotes, []);
  const legacyQuoteItems = loadStored(STORAGE_KEYS.legacyQuoteItems, []);
  const garments = mergeQuoteGarmentsIntoLibrary(
    hydrateGarments(
      loadStored(STORAGE_KEYS.garments, []),
      settings,
      garmentCategories,
    ),
    storedQuotes,
    legacyQuoteItems,
    garmentCategories,
    settings,
  );

  let quotes = hydrateQuotes(
    storedQuotes,
    positions,
    sizes,
    garmentCategories,
    settings,
    garments,
  );

  if (!quotes.length) {
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
          garments,
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
        garments,
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
