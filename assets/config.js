export const STORAGE_KEYS = {
  garments: "deadgood-v2-garments",
  positions: "deadgood-v2-print-positions",
  sizes: "deadgood-v2-print-sizes",
  pricing: "deadgood-v2-print-pricing",
  positionSizeBindings: "deadgood-v4-position-size-bindings",
  settings: "deadgood-v2-settings",
  legacyQuoteItems: "deadgood-v2-quote-items",
  legacyQuoteDraft: "deadgood-v2-quote-draft",
  garmentCategories: "deadgood-v3-garment-categories",
  quotes: "deadgood-v3-saved-quotes",
  uiState: "deadgood-v3-ui-state",
};

export const PAGES = ["quote", "saved-quotes", "garments", "pricing", "settings"];

export const QUANTITY_OPTIONS = [10, 25, 50, 100, 250];

export const DEFAULT_SETTINGS = {
  vatRate: 20,
  markupRate: 25,
  deliveryServiceName: "DPD Next Day",
  deliveryPricePerBox: 10,
  defaultDeliveryBoxes: 1,
};

export const DEFAULT_PRINT_POSITIONS = [
  { id: "left-chest", label: "Left Chest" },
  { id: "centre-chest", label: "Centre Chest" },
  { id: "large-front", label: "Large Front" },
  { id: "back", label: "Back" },
  { id: "nape", label: "Nape" },
  { id: "left-sleeve", label: "Left Sleeve" },
  { id: "right-sleeve", label: "Right Sleeve" },
  { id: "leg", label: "Leg" },
  { id: "pocket", label: "Pocket" },
  { id: "custom-position", label: "Custom" },
];

export const DEFAULT_PRINT_SIZES = [
  { id: "a6", label: "A6", widthMm: 105, heightMm: 148 },
  { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a3", label: "A3", widthMm: 297, heightMm: 420 },
  { id: "custom-size", label: "Custom", widthMm: 0, heightMm: 0 },
];

export const DEFAULT_GARMENT_CATEGORIES = [
  { id: "t-shirts", label: "T-Shirts" },
  { id: "hoodies", label: "Hoodies" },
  { id: "sweatshirts", label: "Sweatshirts" },
  { id: "polos", label: "Polos" },
  { id: "jackets", label: "Jackets" },
  { id: "hi-vis", label: "Hi Vis" },
  { id: "tote-bags", label: "Tote Bags" },
  { id: "aprons", label: "Aprons" },
  { id: "hats", label: "Hats" },
  { id: "accessories", label: "Accessories" },
];

export const DEFAULT_GARMENTS = [
  {
    id: "awdis-jh001-standard-hoodie",
    categoryId: "hoodies",
    name: "Standard Hoodie",
    brand: "AWDis",
    code: "JH001",
    costPrice: 8.99,
    notes: "",
  },
  {
    id: "awdis-jh020-street-hoodie",
    categoryId: "hoodies",
    name: "Street Hoodie",
    brand: "AWDis",
    code: "JH020",
    costPrice: 14.25,
    notes: "",
  },
  {
    id: "gildan-heavy-blend-hoodie",
    categoryId: "hoodies",
    name: "Heavy Blend Hoodie",
    brand: "Gildan",
    code: "",
    costPrice: 9.37,
    notes: "",
  },
  {
    id: "fruit-of-the-loom-classic-hoodie",
    categoryId: "hoodies",
    name: "Classic Hoodie",
    brand: "Fruit of the Loom",
    code: "",
    costPrice: 8.75,
    notes: "",
  },
  {
    id: "stanley-stella-cruiser-hoodie",
    categoryId: "hoodies",
    name: "Cruiser Hoodie",
    brand: "Stanley/Stella",
    code: "",
    costPrice: 18.95,
    notes: "",
  },
  {
    id: "awdis-at003-heavy-tee",
    categoryId: "t-shirts",
    name: "Heavy Tee",
    brand: "AWDis",
    code: "AT003",
    costPrice: 4.25,
    notes: "",
  },
  {
    id: "gildan-softstyle-tee",
    categoryId: "t-shirts",
    name: "Softstyle Tee",
    brand: "Gildan",
    code: "",
    costPrice: 3.1,
    notes: "",
  },
  {
    id: "gildan-heavy-cotton-tee",
    categoryId: "t-shirts",
    name: "Heavy Cotton Tee",
    brand: "Gildan",
    code: "",
    costPrice: 2.95,
    notes: "",
  },
  {
    id: "as-colour-staple-tee",
    categoryId: "t-shirts",
    name: "Staple Tee",
    brand: "AS Colour",
    code: "",
    costPrice: 6.45,
    notes: "",
  },
  {
    id: "fruit-of-the-loom-original-tee",
    categoryId: "t-shirts",
    name: "Original Tee",
    brand: "Fruit of the Loom",
    code: "",
    costPrice: 2.6,
    notes: "",
  },
  {
    id: "awdis-jh030-sweatshirt",
    categoryId: "sweatshirts",
    name: "Sweatshirt",
    brand: "AWDis",
    code: "JH030",
    costPrice: 7.85,
    notes: "",
  },
  {
    id: "gildan-heavy-blend-sweatshirt",
    categoryId: "sweatshirts",
    name: "Heavy Blend Sweatshirt",
    brand: "Gildan",
    code: "",
    costPrice: 6.95,
    notes: "",
  },
  {
    id: "stanley-stella-matcher-sweatshirt",
    categoryId: "sweatshirts",
    name: "Matcher Sweatshirt",
    brand: "Stanley/Stella",
    code: "",
    costPrice: 14.5,
    notes: "",
  },
  {
    id: "rx101-pro-polo",
    categoryId: "polos",
    name: "Pro Polo",
    brand: "RX101",
    code: "",
    costPrice: 5.95,
    notes: "",
  },
  {
    id: "gildan-dryblend-polo",
    categoryId: "polos",
    name: "DryBlend Polo",
    brand: "Gildan",
    code: "",
    costPrice: 5.75,
    notes: "",
  },
  {
    id: "westford-mill-w101-tote-bag",
    categoryId: "tote-bags",
    name: "Tote Bag",
    brand: "Westford Mill",
    code: "W101",
    costPrice: 1.65,
    notes: "",
  },
  {
    id: "westford-mill-w110-cotton-shopper",
    categoryId: "tote-bags",
    name: "Cotton Shopper",
    brand: "Westford Mill",
    code: "W110",
    costPrice: 2.1,
    notes: "",
  },
  {
    id: "premier-pr181-apron",
    categoryId: "aprons",
    name: "Apron",
    brand: "Premier",
    code: "PR181",
    costPrice: 9.75,
    notes: "",
  },
  {
    id: "premier-pr154-colours-bib-apron",
    categoryId: "aprons",
    name: "Colours Bib Apron",
    brand: "Premier",
    code: "PR154",
    costPrice: 7.95,
    notes: "",
  },
  {
    id: "regatta-tra642-softshell-jacket",
    categoryId: "jackets",
    name: "Softshell Jacket",
    brand: "Regatta",
    code: "TRA642",
    costPrice: 18.95,
    notes: "",
  },
  {
    id: "result-r121a-classic-softshell",
    categoryId: "jackets",
    name: "Classic Softshell",
    brand: "Result",
    code: "R121A",
    costPrice: 16.5,
    notes: "",
  },
];

export const DEFAULT_SIZE_PRICES = {
  a6: { 10: 2.5, 25: 2.25, 50: 2, 100: 1.75, 250: 1.55 },
  a5: { 10: 2.95, 25: 2.7, 50: 2.4, 100: 2.1, 250: 1.85 },
  a4: { 10: 4.25, 25: 3.85, 50: 3.45, 100: 3.1, 250: 2.75 },
  a3: { 10: 5.25, 25: 4.75, 50: 4.3, 100: 3.9, 250: 3.55 },
  "custom-size": { 10: 0, 25: 0, 50: 0, 100: 0, 250: 0 },
};

export const DEFAULT_POSITION_SIZE_BINDINGS = {
  "left-chest": ["a6", "a5"],
  "centre-chest": ["a5", "a4"],
  "large-front": ["a4", "a3"],
  back: ["a4", "a3"],
  nape: ["a6"],
  "left-sleeve": ["a6"],
  "right-sleeve": ["a6"],
  leg: ["a5", "a4"],
  pocket: ["a6"],
  "custom-position": ["custom-size"],
};

export const DEFAULT_UI_STATE = {
  activePage: "quote",
  activeQuoteId: "",
  pricingPositionId: "",
  pricingSizeId: "",
  pricingCardSizeId: "",
  garmentPickerOpenCategories: {},
  garmentLibraryOpenCategories: {},
};

export function createDefaultQuoteDelivery(settings = DEFAULT_SETTINGS) {
  const defaultBoxes = Math.max(1, Math.floor(Number(settings?.defaultDeliveryBoxes) || 0));

  return {
    serviceName: String(settings?.deliveryServiceName || DEFAULT_SETTINGS.deliveryServiceName),
    pricePerBox: Number(settings?.deliveryPricePerBox) || DEFAULT_SETTINGS.deliveryPricePerBox,
    boxMode: "custom",
    boxes: defaultBoxes,
    customBoxes: String(defaultBoxes),
  };
}

export function createEmptyQuoteDraft(
  positionId,
  sizeId,
  defaultCategoryId = DEFAULT_GARMENT_CATEGORIES[0]?.id || "",
) {
  return {
    quantityMode: "preset",
    quantity: 25,
    customQuantity: "",
    editingItemId: "",
    markupOverride: null,
    garment: {
      sourceId: "",
      categoryId: defaultCategoryId,
      name: "",
      brand: "",
      code: "",
      costPrice: "",
      notes: "",
    },
    printDraft: {
      positionId: positionId ?? "",
      sizeId: sizeId ?? "",
      price: "",
      priceOverride: "",
    },
    prints: [],
  };
}
