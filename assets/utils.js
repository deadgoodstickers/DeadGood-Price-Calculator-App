export const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const shortDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const shortEditedDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value) {
  return currency.format(sanitiseNumber(value, 0));
}

export function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : shortDateTime.format(date);
}

export function formatEditedDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `Edited ${shortEditedDateTime.format(date)}`;
}

export function sanitiseNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function roundMoney(value) {
  return Math.round((sanitiseNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

export function sanitiseMarkupOverride(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = sanitiseNumber(trimmed, Number.NaN);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(100, Math.max(0, parsed));
}

export function sanitisePriceOverride(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = sanitiseNumber(trimmed, Number.NaN);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return roundMoney(parsed);
}

export function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `dg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function formatDimensions(size) {
  const width = sanitiseNumber(size?.widthMm, 0);
  const height = sanitiseNumber(size?.heightMm, 0);

  if (!width || !height) {
    return "Set custom dimensions";
  }

  return `${width} × ${height} mm`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
