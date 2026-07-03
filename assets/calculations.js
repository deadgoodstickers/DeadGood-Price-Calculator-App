import { QUANTITY_OPTIONS } from "./config.js?v=rc9";
import { formatDimensions, roundMoney, sanitiseNumber } from "./utils.js?v=rc9";

export function calculateGarmentBreakdown(costPrice, settings) {
  const baseCost = roundMoney(sanitiseNumber(costPrice, 0));
  const vatAmount = roundMoney((baseCost * sanitiseNumber(settings?.vatRate, 0)) / 100);
  const vatInclusiveCost = roundMoney(baseCost + vatAmount);
  const markupAmount = roundMoney(
    (vatInclusiveCost * sanitiseNumber(settings?.markupRate, 0)) / 100,
  );
  const sellPrice = roundMoney(vatInclusiveCost + markupAmount);

  return {
    baseCost,
    vatAmount,
    markupAmount,
    sellPrice,
  };
}

export function calculateGarmentSellPrice(costPrice, settings) {
  return calculateGarmentBreakdown(costPrice, settings).sellPrice;
}

export function resolveQuantityBracket(quantity) {
  const safeQuantity = Math.max(1, Math.floor(sanitiseNumber(quantity, QUANTITY_OPTIONS[0])));

  return QUANTITY_OPTIONS.reduce(
    (activeBracket, option) => (safeQuantity >= option ? option : activeBracket),
    QUANTITY_OPTIONS[0],
  );
}

export function lookupPrintPrice(pricing, positionId, sizeId, quantity) {
  const quantityBracket = resolveQuantityBracket(quantity);
  return roundMoney(pricing?.[positionId]?.[sizeId]?.[quantityBracket] ?? 0);
}

export function calculateQuoteQuantity(items) {
  return (items ?? []).reduce(
    (sum, item) => sum + Math.max(1, Math.floor(sanitiseNumber(item?.quantity, 0))),
    0,
  );
}

export function applyQuotePrintPricing(items, pricing) {
  const quoteQuantity = calculateQuoteQuantity(items);
  const quantityBracket = resolveQuantityBracket(quoteQuantity);

  return (items ?? []).map((item) => ({
    ...item,
    quantityBracket,
    prints: (item?.prints ?? []).map((printLine) => ({
      ...printLine,
      price: lookupPrintPrice(pricing, printLine.positionId, printLine.sizeId, quoteQuantity),
    })),
  }));
}

export function calculateQuoteItem(item) {
  const quantity = sanitiseNumber(item?.quantity, 0);
  const garmentUnitPrice = roundMoney(item?.garment?.sellPrice ?? 0);
  const printUnitPrice = roundMoney(
    (item?.prints ?? []).reduce((sum, printLine) => sum + sanitiseNumber(printLine.price, 0), 0),
  );
  const totalUnitPrice = roundMoney(garmentUnitPrice + printUnitPrice);
  const totalPrice = roundMoney(totalUnitPrice * quantity);

  return {
    quantity,
    garmentUnitPrice,
    printUnitPrice,
    totalUnitPrice,
    totalPrice,
  };
}

export function resolveDeliveryBoxes(delivery) {
  if (delivery?.boxMode === "custom") {
    const customBoxes = sanitiseNumber(delivery?.customBoxes, Number.NaN);
    if (Number.isFinite(customBoxes) && customBoxes >= 0) {
      return Math.max(0, Math.floor(customBoxes));
    }
  }

  return Math.max(0, Math.floor(sanitiseNumber(delivery?.boxes, 0)));
}

export function calculateDeliveryTotal(delivery) {
  const boxes = resolveDeliveryBoxes(delivery);
  const pricePerBox = roundMoney(sanitiseNumber(delivery?.pricePerBox, 0));
  const totalPrice = roundMoney(boxes * pricePerBox);

  return {
    serviceName: String(delivery?.serviceName || ""),
    boxes,
    pricePerBox,
    totalPrice,
  };
}

export function calculateQuoteTotals(items, delivery) {
  const quoteQuantity = calculateQuoteQuantity(items);
  const itemsSubtotal = (items ?? []).reduce((sum, item) => {
    const itemTotals = calculateQuoteItem(item);
    return roundMoney(sum + itemTotals.totalPrice);
  }, 0);
  const deliveryTotals = calculateDeliveryTotal(delivery);

  return {
    itemCount: (items ?? []).length,
    quoteQuantity,
    printQuantityBracket: resolveQuantityBracket(quoteQuantity),
    itemsSubtotal,
    deliveryBoxes: deliveryTotals.boxes,
    deliveryPricePerBox: deliveryTotals.pricePerBox,
    deliveryServiceName: deliveryTotals.serviceName,
    deliveryTotal: deliveryTotals.totalPrice,
    grandTotal: roundMoney(itemsSubtotal + deliveryTotals.totalPrice),
  };
}

export function createQuoteItemSnapshot(draft, references, settings) {
  const quantity = Math.max(1, Math.floor(sanitiseNumber(draft.quantity, 0)));
  const quantityBracket = resolveQuantityBracket(references?.quoteQuantity ?? quantity);
  const garment = {
    id: draft.garment.sourceId || "",
    categoryId: draft.garment.categoryId || "",
    name: draft.garment.name.trim(),
    brand: draft.garment.brand.trim(),
    code: draft.garment.code.trim(),
    notes: draft.garment.notes.trim(),
    costPrice: roundMoney(draft.garment.costPrice),
    sellPrice: calculateGarmentSellPrice(draft.garment.costPrice, settings),
  };

  const prints = draft.prints.map((printLine) => {
    const position = references.positions.find((item) => item.id === printLine.positionId);
    const size = references.sizes.find((item) => item.id === printLine.sizeId);

    return {
      id: printLine.id,
      positionId: printLine.positionId,
      sizeId: printLine.sizeId,
      positionLabel: position?.label ?? printLine.positionLabel ?? "Custom",
      sizeLabel: size?.label ?? printLine.sizeLabel ?? "Custom",
      sizeDimensions: size ? formatDimensions(size) : printLine.sizeDimensions ?? "",
      price: roundMoney(printLine.price),
    };
  });

  return {
    id: draft.id,
    quantityMode: draft.quantityMode === "custom" ? "custom" : "preset",
    quantity,
    customQuantity: String(draft.customQuantity ?? ""),
    quantityBracket,
    garment,
    prints,
    createdAt: draft.createdAt || new Date().toISOString(),
  };
}
