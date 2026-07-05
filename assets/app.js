import {
  applyQuotePrintPricing,
  calculateQuoteQuantity,
  calculateDeliveryTotal,
  calculateGarmentBreakdown,
  calculateGarmentSellPrice,
  calculateQuoteItem,
  calculateQuoteTotals,
  createQuoteItemRecord,
  createQuoteItemSnapshot,
  lookupPrintPrice,
  resolveDeliveryBoxes,
  resolveQuantityBracket,
} from "./calculations.js?v=rc15";
import {
  createDefaultQuoteDelivery,
  createEmptyQuoteDraft,
  DEFAULT_GARMENTS,
  PAGES,
  QUANTITY_OPTIONS,
  STORAGE_KEYS,
} from "./config.js?v=rc15";
import {
  hydrateGarments,
  hydratePricing,
  hydrateQuoteDelivery,
  hydrateQuoteDraft,
  hydrateQuoteItems,
  loadAppState,
  persist,
} from "./storage.js?v=rc15";
import {
  deepClone,
  escapeHtml,
  formatCurrency,
  formatDateTime,
  formatEditedDateTime,
  formatDimensions,
  generateId,
  sanitiseMarkupOverride,
  sanitiseNumber,
  slugify,
} from "./utils.js?v=rc15";

const loadedState = loadAppState();
const initialQuote = getStoredActiveQuote(loadedState.quotes, loadedState.uiState.activeQuoteId);
let pendingConfirmAction = null;
let markupCardEditing = false;
const DESKTOP_SIDEBAR_QUERY = "(min-width: 1024px)";
const drawerSwipe = {
  startX: 0,
  startY: 0,
  tracking: false,
};

const state = {
  settings: loadedState.settings,
  positions: loadedState.positions,
  sizes: loadedState.sizes,
  positionSizeBindings: loadedState.positionSizeBindings,
  garmentCategories: loadedState.garmentCategories,
  pricing: loadedState.pricing,
  garments: loadedState.garments,
  quotes: loadedState.quotes,
  activeQuoteId: initialQuote.id,
  quoteName: initialQuote.name,
  quoteNameDraft: initialQuote.name,
  quoteItems: deepClone(initialQuote.quoteItems),
  quoteDelivery: deepClone(initialQuote.delivery),
  quoteDraft: deepClone(initialQuote.quoteDraft),
  quoteCreatedAt: initialQuote.createdAt,
  quoteUpdatedAt: initialQuote.updatedAt,
  activePage: loadedState.uiState.activePage,
  pricingPositionId: loadedState.uiState.pricingPositionId,
  pricingSizeId: loadedState.uiState.pricingSizeId,
  pricingCardSizeId: loadedState.uiState.pricingCardSizeId,
  garmentPickerOpenCategories: buildCategoryOpenState(
    loadedState.garmentCategories,
    loadedState.uiState.garmentPickerOpenCategories,
  ),
  garmentLibraryOpenCategories: buildCategoryOpenState(
    loadedState.garmentCategories,
    loadedState.uiState.garmentLibraryOpenCategories,
  ),
  drawerOpen: false,
  confirmDialogOpen: false,
  confirmDialogTitle: "Delete item?",
  confirmDialogMessage: "This action cannot be undone.",
  garmentSheetOpen: false,
  printSheetOpen: false,
  quoteSheetOpen: false,
  positionSheetOpen: false,
  sizeSheetOpen: false,
  positionSizesSheetOpen: false,
  garmentCreatorOpen: false,
  quoteGarmentSearch: "",
  garmentLibrarySearch: "",
  garmentEditorId: "",
  garmentEditorOpen: false,
  positionEditorId: "",
  sizeEditorId: "",
  deferredPrompt: null,
  motion: {
    recentQuoteItemId: "",
    recentDraftPrintId: "",
    recentQuoteId: "",
  },
};

const elements = {
  root: document.documentElement,
  body: document.body,
  launchScreen: document.querySelector("#launchScreen"),
  drawerShell: document.querySelector("#drawerShell"),
  drawerPanel: document.querySelector("#drawerPanel"),
  drawerToggleButton: document.querySelector("#drawerToggleButton"),
  drawerRetoggleButton: document.querySelector("#drawerRetoggleButton"),
  drawerScrim: document.querySelector("#drawerScrim"),
  drawerNavButtons: [...document.querySelectorAll(".drawer-link")],
  installButton: document.querySelector("#installButton"),
  pages: [...document.querySelectorAll(".page")],
  quoteBar: document.querySelector("#quoteBar"),
  footerGrandTotal: document.querySelector("#footerGrandTotal"),
  openQuoteSheetButton: document.querySelector("#openQuoteSheetButton"),
  quoteSheetShell: document.querySelector("#quoteSheetShell"),
  quoteSheetScrim: document.querySelector("#quoteSheetScrim"),
  closeQuoteSheetButton: document.querySelector("#closeQuoteSheetButton"),
  confirmDialogShell: document.querySelector("#confirmDialogShell"),
  confirmDialogScrim: document.querySelector("#confirmDialogScrim"),
  confirmDialogTitle: document.querySelector("#confirmDialogTitle"),
  confirmDialogMessage: document.querySelector("#confirmDialogMessage"),
  cancelConfirmDialogButton: document.querySelector("#cancelConfirmDialogButton"),
  confirmDialogDeleteButton: document.querySelector("#confirmDialogDeleteButton"),
  quoteSheetName: document.querySelector("#quoteSheetName"),
  currentQuoteHeading: document.querySelector("#currentQuoteHeading"),
  quoteSheetEditedAt: document.querySelector("#quoteSheetEditedAt"),
  quoteSheetBracketMeta: document.querySelector("#quoteSheetBracketMeta"),
  quoteGarmentCount: document.querySelector("#quoteGarmentCount"),
  quoteProductTypeCount: document.querySelector("#quoteProductTypeCount"),
  quoteItemsSubtotalSummary: document.querySelector("#quoteItemsSubtotalSummary"),
  quoteDeliveryTotalSummary: document.querySelector("#quoteDeliveryTotalSummary"),
  quoteGrandTotal: document.querySelector("#quoteGrandTotal"),
  quoteItemsList: document.querySelector("#quoteItemsList"),
  quoteDeliveryCard: document.querySelector("#quoteDeliveryCard"),
  quoteDeliverySummaryService: document.querySelector("#quoteDeliverySummaryService"),
  quoteDeliverySummaryBoxes: document.querySelector("#quoteDeliverySummaryBoxes"),
  quoteItemsEmpty: document.querySelector("#quoteItemsEmpty"),
  quoteNameInput: document.querySelector("#quoteNameInput"),
  saveQuoteNameButton: document.querySelector("#saveQuoteNameButton"),
  activeQuoteMeta: document.querySelector("#activeQuoteMeta"),
  builderCard: document.querySelector(".builder-card"),
  itemBuilderShell: document.querySelector("#itemBuilderShell"),
  itemBuilderLockNote: document.querySelector("#itemBuilderLockNote"),
  newQuoteButton: document.querySelector("#newQuoteButton"),
  newQuotePageButton: document.querySelector("#newQuotePageButton"),
  openSavedQuotesButton: document.querySelector("#openSavedQuotesButton"),
  quoteDeliveryBoxesCount: document.querySelector("#quoteDeliveryBoxesCount"),
  decreaseDeliveryBoxesButton: document.querySelector("#decreaseDeliveryBoxesButton"),
  increaseDeliveryBoxesButton: document.querySelector("#increaseDeliveryBoxesButton"),
  currentGarmentCard: document.querySelector("#currentGarmentCard"),
  quantityStage: document.querySelector("#quantityStage"),
  quantityOptions: document.querySelector("#quantityOptions"),
  customQuantityPanel: document.querySelector("#customQuantityPanel"),
  customQuantityInput: document.querySelector("#customQuantityInput"),
  quantityBracketMeta: document.querySelector("#quantityBracketMeta"),
  printsStage: document.querySelector("#printsStage"),
  openPrintSheetButton: document.querySelector("#openPrintSheetButton"),
  draftPrintList: document.querySelector("#draftPrintList"),
  draftPrintsEmpty: document.querySelector("#draftPrintsEmpty"),
  totalsStage: document.querySelector("#totalsStage"),
  draftItemPreview: document.querySelector("#draftItemPreview"),
  addQuoteItemButton: document.querySelector("#addQuoteItemButton"),
  resetDraftButton: document.querySelector("#resetDraftButton"),
  garmentSheetShell: document.querySelector("#garmentSheetShell"),
  garmentSheetScrim: document.querySelector("#garmentSheetScrim"),
  closeGarmentSheetButton: document.querySelector("#closeGarmentSheetButton"),
  quoteGarmentSearch: document.querySelector("#quoteGarmentSearch"),
  quoteGarmentResults: document.querySelector("#quoteGarmentResults"),
  quoteGarmentResultsEmpty: document.querySelector("#quoteGarmentResultsEmpty"),
  toggleGarmentCreatorButton: document.querySelector("#toggleGarmentCreatorButton"),
  garmentCreatorPanel: document.querySelector("#garmentCreatorPanel"),
  quoteGarmentName: document.querySelector("#quoteGarmentName"),
  quoteGarmentCategory: document.querySelector("#quoteGarmentCategory"),
  quoteGarmentBrand: document.querySelector("#quoteGarmentBrand"),
  quoteGarmentCode: document.querySelector("#quoteGarmentCode"),
  quoteGarmentCost: document.querySelector("#quoteGarmentCost"),
  quoteGarmentNotes: document.querySelector("#quoteGarmentNotes"),
  quoteGarmentSellPrice: document.querySelector("#quoteGarmentSellPrice"),
  quoteGarmentBreakdown: document.querySelector("#quoteGarmentBreakdown"),
  useDraftGarmentButton: document.querySelector("#useDraftGarmentButton"),
  quoteSaveGarmentButton: document.querySelector("#quoteSaveGarmentButton"),
  printSheetShell: document.querySelector("#printSheetShell"),
  printSheetScrim: document.querySelector("#printSheetScrim"),
  closePrintSheetButton: document.querySelector("#closePrintSheetButton"),
  printPositionOptions: document.querySelector("#printPositionOptions"),
  printSizeOptions: document.querySelector("#printSizeOptions"),
  draftPrintComputedPrice: document.querySelector("#draftPrintComputedPrice"),
  draftPrintSizeMeta: document.querySelector("#draftPrintSizeMeta"),
  draftPrintBracketMeta: document.querySelector("#draftPrintBracketMeta"),
  draftPrintPrice: document.querySelector("#draftPrintPrice"),
  savePrintButton: document.querySelector("#savePrintButton"),
  positionSheetShell: document.querySelector("#positionSheetShell"),
  positionSheetScrim: document.querySelector("#positionSheetScrim"),
  closePositionSheetButton: document.querySelector("#closePositionSheetButton"),
  positionSheetTitle: document.querySelector("#positionSheetTitle"),
  positionEditorName: document.querySelector("#positionEditorName"),
  savePositionButton: document.querySelector("#savePositionButton"),
  deletePositionButton: document.querySelector("#deletePositionButton"),
  sizeSheetShell: document.querySelector("#sizeSheetShell"),
  sizeSheetScrim: document.querySelector("#sizeSheetScrim"),
  closeSizeSheetButton: document.querySelector("#closeSizeSheetButton"),
  sizeSheetTitle: document.querySelector("#sizeSheetTitle"),
  sizeEditorLabel: document.querySelector("#sizeEditorLabel"),
  sizeEditorWidth: document.querySelector("#sizeEditorWidth"),
  sizeEditorHeight: document.querySelector("#sizeEditorHeight"),
  saveSizeButton: document.querySelector("#saveSizeButton"),
  deleteSizeButton: document.querySelector("#deleteSizeButton"),
  positionSizesSheetShell: document.querySelector("#positionSizesSheetShell"),
  positionSizesSheetScrim: document.querySelector("#positionSizesSheetScrim"),
  closePositionSizesSheetButton: document.querySelector("#closePositionSizesSheetButton"),
  positionSizesSheetTitle: document.querySelector("#positionSizesSheetTitle"),
  positionSizesList: document.querySelector("#positionSizesList"),
  positionSizesEmpty: document.querySelector("#positionSizesEmpty"),
  savedQuotesList: document.querySelector("#savedQuotesList"),
  savedQuotesEmpty: document.querySelector("#savedQuotesEmpty"),
  garmentLibrarySearch: document.querySelector("#garmentLibrarySearch"),
  loadDemoGarmentsButton: document.querySelector("#loadDemoGarmentsButton"),
  garmentLibraryList: document.querySelector("#garmentLibraryList"),
  garmentLibraryEmpty: document.querySelector("#garmentLibraryEmpty"),
  toggleGarmentEditorButton: document.querySelector("#toggleGarmentEditorButton"),
  garmentEditorPanel: document.querySelector("#garmentEditorPanel"),
  garmentEditorTitle: document.querySelector("#garmentEditorTitle"),
  newGarmentCategory: document.querySelector("#newGarmentCategory"),
  addGarmentCategoryButton: document.querySelector("#addGarmentCategoryButton"),
  garmentCategoryList: document.querySelector("#garmentCategoryList"),
  garmentEditorName: document.querySelector("#garmentEditorName"),
  garmentEditorCategory: document.querySelector("#garmentEditorCategory"),
  garmentEditorBrand: document.querySelector("#garmentEditorBrand"),
  garmentEditorCode: document.querySelector("#garmentEditorCode"),
  garmentEditorCost: document.querySelector("#garmentEditorCost"),
  garmentEditorNotes: document.querySelector("#garmentEditorNotes"),
  garmentEditorSellPrice: document.querySelector("#garmentEditorSellPrice"),
  garmentEditorSaveButton: document.querySelector("#garmentEditorSaveButton"),
  garmentEditorDeleteButton: document.querySelector("#garmentEditorDeleteButton"),
  garmentEditorClearButton: document.querySelector("#garmentEditorClearButton"),
  openPositionCreateButton: document.querySelector("#openPositionCreateButton"),
  positionList: document.querySelector("#positionList"),
  openSizeCreateButton: document.querySelector("#openSizeCreateButton"),
  sizeList: document.querySelector("#sizeList"),
  pricingPositionSelect: document.querySelector("#pricingPositionSelect"),
  pricingSizeSelect: document.querySelector("#pricingSizeSelect"),
  openPositionSizesSheetButton: document.querySelector("#openPositionSizesSheetButton"),
  pricingAttachedSizes: document.querySelector("#pricingAttachedSizes"),
  pricingAttachedSizesEmpty: document.querySelector("#pricingAttachedSizesEmpty"),
  pricingComboTile: document.querySelector("#pricingComboTile"),
  pricingComboPositionLabel: document.querySelector("#pricingComboPositionLabel"),
  pricingComboSizeLabel: document.querySelector("#pricingComboSizeLabel"),
  pricingComboMeta: document.querySelector("#pricingComboMeta"),
  pricingCards: document.querySelector("#pricingCards"),
  pricingCardsEmpty: document.querySelector("#pricingCardsEmpty"),
  settingsVatRate: document.querySelector("#settingsVatRate"),
  settingsMarkupRate: document.querySelector("#settingsMarkupRate"),
  settingsDeliveryServiceName: document.querySelector("#settingsDeliveryServiceName"),
  settingsDeliveryPricePerBox: document.querySelector("#settingsDeliveryPricePerBox"),
  settingsDefaultDeliveryBoxes: document.querySelector("#settingsDefaultDeliveryBoxes"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
};

initialize();

function initialize() {
  syncActiveQuoteWithLibraries();
  renderCategoryOptions();
  syncQuoteMetaInputs();
  syncGarmentDraftInputs();
  syncGarmentEditor();
  syncSettingsForm();
  bindEvents();
  persist(STORAGE_KEYS.garmentCategories, state.garmentCategories);
  persistPositionSizeBindings();
  persist(STORAGE_KEYS.quotes, state.quotes);
  persistUiState();
  renderApp();
  registerServiceWorker();
  setupInstallPrompt();
  completeLaunchExperience();
}

function completeLaunchExperience() {
  const launchStartedAt = Number(globalThis.__deadgoodLaunchStarted || performance.now());
  const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const minimumDuration = reduceMotion ? 120 : 860;
  const elapsed = performance.now() - launchStartedAt;
  const remainingDelay = Math.max(0, minimumDuration - elapsed);

  window.setTimeout(() => {
    elements.root.classList.remove("app-launching");
    elements.root.classList.add("app-ready");

    if (!elements.launchScreen) {
      return;
    }

    const cleanup = () => {
      elements.launchScreen?.remove();
      elements.launchScreen = null;
    };

    elements.launchScreen.addEventListener("transitionend", cleanup, { once: true });
    window.setTimeout(cleanup, reduceMotion ? 180 : 420);
  }, remainingDelay);
}

function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function scrollSectionIntoViewIfNeeded(element) {
  if (!element) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const topMargin = (document.querySelector(".appbar")?.getBoundingClientRect().height || 0) + 16;
  const bottomMargin = (document.querySelector(".quote-bar")?.getBoundingClientRect().height || 0) + 16;

  const isComfortablyVisible = rect.top >= topMargin && rect.bottom <= viewportHeight - bottomMargin;
  if (isComfortablyVisible) {
    return;
  }

  const targetTop = Math.max(0, window.scrollY + rect.top - topMargin - 12);

  window.scrollTo({
    top: targetTop,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

function replayMotionClass(element, className, duration = 240) {
  if (!element || prefersReducedMotion()) {
    return;
  }

  if (element.__deadgoodMotionTimer) {
    window.clearTimeout(element.__deadgoodMotionTimer);
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.__deadgoodMotionTimer = window.setTimeout(() => {
    element.classList.remove(className);
  }, duration);
}

function setAnimatedText(element, nextValue) {
  if (!element) {
    return;
  }

  const value = String(nextValue);
  if (element.textContent !== value) {
    element.textContent = value;
    replayMotionClass(element, "motion-value-updating", 220);
    return;
  }

  element.textContent = value;
}

function refreshListMotion(element) {
  replayMotionClass(element, "motion-list-refreshing", 220);
}

function animateTrackedEntry(selector) {
  if (!selector) {
    return;
  }

  replayMotionClass(document.querySelector(selector), "motion-item-enter", 240);
}

function animateRemoval(selector, callback) {
  const element = document.querySelector(selector);
  if (!element || prefersReducedMotion()) {
    callback?.();
    return;
  }

  element.classList.add("motion-item-exit");
  window.setTimeout(() => {
    callback?.();
  }, 210);
}

function bindEvents() {
  elements.drawerToggleButton.addEventListener("click", toggleDrawer);
  elements.drawerRetoggleButton.addEventListener("click", toggleDrawer);
  elements.drawerScrim.addEventListener("click", closeDrawer);
  elements.drawerNavButtons.forEach((button) => {
    button.addEventListener("click", () => setActivePage(button.dataset.page));
  });
  bindDrawerSwipeGesture();
  bindViewportModeChange();

  elements.installButton.addEventListener("click", installApp);

  elements.newQuoteButton.addEventListener("click", createNewQuote);
  elements.newQuotePageButton.addEventListener("click", createNewQuote);
  elements.openSavedQuotesButton.addEventListener("click", () => setActivePage("saved-quotes"));
  elements.quoteNameInput.addEventListener("input", handleQuoteNameInput);
  elements.saveQuoteNameButton.addEventListener("click", saveQuoteName);
  elements.decreaseDeliveryBoxesButton.addEventListener("click", () => adjustDeliveryBoxes(-1));
  elements.increaseDeliveryBoxesButton.addEventListener("click", () => adjustDeliveryBoxes(1));

  elements.currentGarmentCard.addEventListener("click", handleCurrentGarmentCardClick);
  elements.currentGarmentCard.addEventListener("input", handleMarkupOverrideInput);
  elements.currentGarmentCard.addEventListener("keydown", handleMarkupOverrideKeydown);
  elements.currentGarmentCard.addEventListener("blur", handleMarkupOverrideBlur, true);
  elements.resetDraftButton.addEventListener("click", resetDraft);

  elements.quoteGarmentSearch.addEventListener("input", (event) => {
    state.quoteGarmentSearch = event.target.value;
    renderGarmentSearchResults();
  });

  elements.toggleGarmentCreatorButton.addEventListener("click", () => {
    state.garmentCreatorOpen = !state.garmentCreatorOpen;
    renderGarmentCreatorState();
  });

  elements.quoteGarmentName.addEventListener("input", handleQuoteGarmentInput);
  elements.quoteGarmentCategory.addEventListener("change", handleQuoteGarmentInput);
  elements.quoteGarmentBrand.addEventListener("input", handleQuoteGarmentInput);
  elements.quoteGarmentCode.addEventListener("input", handleQuoteGarmentInput);
  elements.quoteGarmentCost.addEventListener("input", handleQuoteGarmentInput);
  elements.quoteGarmentNotes.addEventListener("input", handleQuoteGarmentInput);
  elements.useDraftGarmentButton.addEventListener("click", useCurrentDraftGarment);
  elements.quoteSaveGarmentButton.addEventListener("click", saveQuoteGarmentToLibrary);
  elements.closeGarmentSheetButton.addEventListener("click", closeGarmentSheet);
  elements.garmentSheetScrim.addEventListener("click", closeGarmentSheet);
  elements.quoteGarmentResults.addEventListener("click", handleQuoteGarmentResultClick);

  elements.quantityOptions.addEventListener("click", handleQuantityClick);
  elements.customQuantityInput.addEventListener("input", handleCustomQuantityInput);
  elements.customQuantityInput.addEventListener("blur", handleCustomQuantityBlur);

  elements.openPrintSheetButton.addEventListener("click", openPrintSheet);
  elements.closePrintSheetButton.addEventListener("click", closePrintSheet);
  elements.printSheetScrim.addEventListener("click", closePrintSheet);
  elements.printPositionOptions.addEventListener("click", handlePrintPositionClick);
  elements.printSizeOptions.addEventListener("click", handlePrintSizeClick);
  elements.draftPrintPrice.addEventListener("input", (event) => {
    state.quoteDraft.printDraft.price = event.target.value;
    persistActiveQuote();
    renderPrintSheetMeta();
    renderQuoteMeta();
  });
  elements.savePrintButton.addEventListener("click", saveCurrentPrint);
  elements.draftPrintList.addEventListener("click", handleDraftPrintListClick);
  elements.closePositionSheetButton.addEventListener("click", closePositionSheet);
  elements.positionSheetScrim.addEventListener("click", closePositionSheet);
  elements.savePositionButton.addEventListener("click", savePositionFromSheet);
  elements.deletePositionButton.addEventListener("click", deletePositionFromSheet);
  elements.closeSizeSheetButton.addEventListener("click", closeSizeSheet);
  elements.sizeSheetScrim.addEventListener("click", closeSizeSheet);
  elements.saveSizeButton.addEventListener("click", saveSizeFromSheet);
  elements.deleteSizeButton.addEventListener("click", deleteSizeFromSheet);
  elements.closePositionSizesSheetButton.addEventListener("click", closePositionSizesSheet);
  elements.positionSizesSheetScrim.addEventListener("click", closePositionSizesSheet);

  elements.addQuoteItemButton.addEventListener("click", saveQuoteItemFromDraft);
  elements.openQuoteSheetButton.addEventListener("click", openQuoteSheet);
  elements.closeQuoteSheetButton.addEventListener("click", closeQuoteSheet);
  elements.quoteSheetScrim.addEventListener("click", closeQuoteSheet);
  elements.quoteItemsList.addEventListener("click", handleQuoteItemListClick);
  elements.savedQuotesList.addEventListener("click", handleSavedQuotesListClick);

  elements.garmentLibrarySearch.addEventListener("input", (event) => {
    state.garmentLibrarySearch = event.target.value;
    renderGarmentLibrary();
  });
  elements.loadDemoGarmentsButton.addEventListener("click", loadDemoGarments);
  elements.toggleGarmentEditorButton.addEventListener("click", toggleGarmentEditorPanel);
  elements.garmentLibraryList.addEventListener("click", handleGarmentLibraryClick);
  elements.garmentLibraryList.addEventListener("toggle", handleGarmentLibraryToggle, true);
  elements.addGarmentCategoryButton.addEventListener("click", addGarmentCategory);
  elements.garmentCategoryList.addEventListener("click", handleGarmentCategoryListClick);
  elements.garmentCategoryList.addEventListener("input", handleGarmentCategoryListInput);
  elements.garmentEditorName.addEventListener("input", handleGarmentEditorInput);
  elements.garmentEditorCategory.addEventListener("change", handleGarmentEditorInput);
  elements.garmentEditorBrand.addEventListener("input", handleGarmentEditorInput);
  elements.garmentEditorCode.addEventListener("input", handleGarmentEditorInput);
  elements.garmentEditorCost.addEventListener("input", handleGarmentEditorInput);
  elements.garmentEditorNotes.addEventListener("input", handleGarmentEditorInput);
  elements.garmentEditorSaveButton.addEventListener("click", saveGarmentFromEditor);
  elements.garmentEditorDeleteButton.addEventListener("click", requestDeleteGarmentFromEditor);
  elements.garmentEditorClearButton.addEventListener("click", clearGarmentEditor);

  elements.openPositionCreateButton.addEventListener("click", openPositionSheetForCreate);
  elements.positionList.addEventListener("click", handlePositionListClick);
  elements.openSizeCreateButton.addEventListener("click", openSizeSheetForCreate);
  elements.sizeList.addEventListener("click", handleSizeListClick);
  elements.pricingPositionSelect.addEventListener("change", handlePricingPositionChange);
  elements.pricingSizeSelect.addEventListener("change", handlePricingSizeChange);
  elements.openPositionSizesSheetButton.addEventListener("click", openPositionSizesSheet);
  elements.pricingCards.addEventListener("input", handlePricingInput);
  elements.positionSizesList.addEventListener("click", handlePositionSizesListClick);

  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.confirmDialogScrim.addEventListener("click", closeConfirmDialog);
  elements.cancelConfirmDialogButton.addEventListener("click", closeConfirmDialog);
  elements.confirmDialogDeleteButton.addEventListener("click", confirmDeleteAction);
  document.addEventListener("keydown", handleGlobalKeyDown);
  document.addEventListener("focusin", handleNumericInputFocus);
}

function handleNumericInputFocus(event) {
  if (event.target?.matches?.('input[type="number"]')) {
    event.target.select();
  }
}

function renderApp() {
  renderAppShell();
  renderConfirmDialog();
  renderQuoteMeta();
  renderQuoteComposer();
  renderQuoteSummary();
  renderSavedQuotes();
  renderGarmentCategoryManager();
  renderGarmentSearchResults();
  renderGarmentCreatorState();
  renderGarmentSheetMeta();
  renderPrintSheet();
  renderGarmentLibrary();
  renderGarmentEditorState();
  renderPositionManager();
  renderSizeManager();
  renderPricingManager();
  renderPositionSheetState();
  renderSizeSheetState();
  renderPositionSizesSheetState();
}

function renderAppShell() {
  const hasDesktopSidebar = isDesktopSidebarViewport();
  if (hasDesktopSidebar && state.drawerOpen) {
    state.drawerOpen = false;
  }

  elements.body.classList.toggle("has-desktop-sidebar", hasDesktopSidebar);
  elements.drawerToggleButton.setAttribute("aria-expanded", String(state.drawerOpen));
  elements.drawerToggleButton.setAttribute(
    "aria-label",
    state.drawerOpen ? "Close navigation" : "Open navigation",
  );
  elements.drawerNavButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === state.activePage);
  });

  elements.pages.forEach((pageSection) => {
    const isActive = pageSection.dataset.page === state.activePage;
    pageSection.hidden = !isActive;
    pageSection.classList.toggle("is-active", isActive);
  });

  elements.quoteBar.classList.toggle("is-visible", state.activePage === "quote");
  elements.drawerShell.classList.toggle("is-open", state.drawerOpen);
  elements.garmentSheetShell.classList.toggle("is-open", state.garmentSheetOpen);
  elements.printSheetShell.classList.toggle("is-open", state.printSheetOpen);
  elements.quoteSheetShell.classList.toggle("is-open", state.quoteSheetOpen);
  elements.positionSheetShell.classList.toggle("is-open", state.positionSheetOpen);
  elements.sizeSheetShell.classList.toggle("is-open", state.sizeSheetOpen);
  elements.positionSizesSheetShell.classList.toggle("is-open", state.positionSizesSheetOpen);
  elements.confirmDialogShell.classList.toggle("is-open", state.confirmDialogOpen);

  const uiLocked =
    (!hasDesktopSidebar && state.drawerOpen) ||
    state.confirmDialogOpen ||
    state.garmentSheetOpen ||
    state.printSheetOpen ||
    state.quoteSheetOpen ||
    state.positionSheetOpen ||
    state.sizeSheetOpen ||
    state.positionSizesSheetOpen;
  elements.body.classList.toggle("ui-locked", uiLocked);
}

function focusDrawerPrimaryControl() {
  const target = elements.drawerNavButtons[0] || null;
  if (!target) {
    return;
  }

  window.requestAnimationFrame(() => {
    target.focus();
  });
}

function restoreDrawerToggleFocus() {
  window.requestAnimationFrame(() => {
    elements.drawerToggleButton?.focus();
  });
}

function renderConfirmDialog() {
  elements.confirmDialogTitle.textContent = state.confirmDialogTitle;
  elements.confirmDialogMessage.textContent = state.confirmDialogMessage;
}

function renderQuoteMeta() {
  const totals = getCurrentQuoteTotals();
  const editedAt = state.quoteUpdatedAt ? formatDateTime(state.quoteUpdatedAt) : "";
  const savedName = state.quoteName.trim();
  const draftName = state.quoteNameDraft.trim();
  const hasSavedName = hasSavedQuoteName();
  const hasDirtyDraft = draftName !== savedName;

  if (document.activeElement !== elements.quoteNameInput) {
    elements.quoteNameInput.value = state.quoteNameDraft;
  }
  elements.currentQuoteHeading.textContent = hasSavedName ? savedName : "New quote";
  elements.activeQuoteMeta.textContent = !hasSavedName
    ? ""
    : hasDirtyDraft
      ? "Press Save to update the quote name."
      : editedAt
        ? `Auto-saved locally · ${editedAt}`
      : "Auto-saved locally";
  elements.saveQuoteNameButton.disabled = !draftName || !hasDirtyDraft;
  elements.quoteSheetName.textContent = getQuoteDisplayName(state.quoteName);
  elements.quoteSheetEditedAt.textContent = editedAt ? `Last edited ${editedAt}` : "";
  setAnimatedText(elements.footerGrandTotal, formatCurrency(totals.grandTotal));
  elements.builderCard?.classList.toggle("is-locked", !hasSavedName);
  elements.itemBuilderShell.classList.toggle("is-locked", !hasSavedName);
  elements.itemBuilderShell.setAttribute("aria-disabled", String(!hasSavedName));
  elements.itemBuilderLockNote?.setAttribute("hidden", "");
  if (elements.itemBuilderLockNote) {
    elements.itemBuilderLockNote.textContent = "";
  }
  elements.resetDraftButton.disabled = !hasSavedName;
  renderQuoteDeliveryCard(totals);
}

function renderQuoteDeliveryCard(totals = getCurrentQuoteTotals()) {
  const deliveryTotals = calculateDeliveryTotal(state.quoteDelivery);
  const deliveryBoxes = deliveryTotals.boxes;
  setAnimatedText(elements.quoteDeliveryBoxesCount, String(deliveryBoxes));
  elements.decreaseDeliveryBoxesButton.disabled = deliveryBoxes <= 0;
  setAnimatedText(elements.quoteDeliverySummaryService, `${
    deliveryTotals.serviceName || state.settings.deliveryServiceName
  } @ ${formatCurrency(deliveryTotals.pricePerBox)}`);
  setAnimatedText(elements.quoteDeliverySummaryBoxes, `Delivery total: ${formatCurrency(
    deliveryTotals.totalPrice,
  )}`);
}

function renderQuoteComposer() {
  renderCurrentGarmentCard();
  renderQuantityOptions();
  renderDraftPrints();
  renderDraftPreview();
}

function renderCurrentGarmentCard() {
  const builderReady = canBuildQuoteItems();
  const garmentReady = hasDraftGarment();
  const pricingReady = hasDraftGarmentPricing();
  const breakdownWasOpen = Boolean(elements.currentGarmentCard.querySelector(".breakdown")?.open);

  if (!builderReady) {
    elements.currentGarmentCard.innerHTML = `
      <article class="empty-launch-card locked-launch-card">
        Save quote name to choose a garment.
      </article>
    `;
    return;
  }

  if (!garmentReady) {
    elements.currentGarmentCard.innerHTML = `
      <button class="empty-launch-card launch-card-cta" data-action="open-garment-sheet" type="button">
        <span class="accent-icon" aria-hidden="true">+</span>
        Tap to choose or add a garment
      </button>
    `;
    return;
  }

  const title = getGarmentTitle(state.quoteDraft.garment);
  const subtitle = getGarmentSubtitle(state.quoteDraft.garment);
  const breakdown = calculateGarmentBreakdown(
    state.quoteDraft.garment.costPrice,
    state.settings,
    sanitiseMarkupOverride(state.quoteDraft.markupOverride),
  );
  const isSaved = Boolean(state.quoteDraft.garment.sourceId);
  const profitAmount = breakdown.markupAmount * getDraftQuantity();

  elements.currentGarmentCard.innerHTML = `
    <article class="summary-card garment-summary-card is-tappable" data-action="open-garment-sheet">
      <div class="summary-card-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(subtitle || "Current garment")}</span>
        </div>
        <div class="inline-actions card-action-row">
          ${
            !isSaved && pricingReady
              ? `
                <button
                  class="ghost-button compact-button"
                  data-action="save-current-garment"
                  type="button"
                >
                  Save
                </button>
              `
              : ""
          }
          <button
            class="icon-button subtle-icon-button card-close-button"
            data-action="clear-current-garment"
            type="button"
            aria-label="Clear garment"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="summary-list compact-summary">
        <div class="summary-line">
          <span>Blank cost</span>
          <strong>${formatCurrency(breakdown.baseCost)}</strong>
        </div>
        <div class="summary-line">
          <span>Sell price</span>
          <strong>${formatCurrency(breakdown.sellPrice)}</strong>
        </div>
      </div>

      <details class="breakdown" ${breakdownWasOpen ? "open" : ""}>
        <summary>Pricing breakdown</summary>
        <div class="breakdown-grid">
          <div class="breakdown-cell">
            <span>VAT</span>
            <strong id="breakdownVatAmount">${formatCurrency(breakdown.vatAmount)}</strong>
          </div>
          <div class="breakdown-cell breakdown-cell--markup${markupCardEditing ? " is-editing" : ""}" data-markup-cell>
            <span>Markup %</span>
            ${
              markupCardEditing
                ? `<input
                    id="markupOverrideInput"
                    data-markup-override-input
                    type="number"
                    inputmode="decimal"
                    min="0"
                    max="100"
                    step="1"
                    class="markup-cell-input"
                    value="${escapeHtml(String(breakdown.markupRate ?? ""))}"
                  />`
                : `<strong id="breakdownMarkupRateDisplay">${escapeHtml(String(breakdown.markupRate ?? ""))}</strong>`
            }
          </div>
          <div class="breakdown-cell">
            <span>Markup</span>
            <strong id="breakdownMarkupAmount">${formatCurrency(breakdown.markupAmount)}</strong>
          </div>
          <div class="breakdown-cell">
            <span>Profit</span>
            <strong id="breakdownProfitAmount">${formatCurrency(profitAmount)}</strong>
          </div>
        </div>
      </details>
    </article>
  `;
}

function handleMarkupOverrideInput(event) {
  const input = event.target.closest?.("[data-markup-override-input]");
  if (!input) {
    return;
  }

  state.quoteDraft.markupOverride = sanitiseMarkupOverride(input.value);

  const breakdown = calculateGarmentBreakdown(
    state.quoteDraft.garment.costPrice,
    state.settings,
    state.quoteDraft.markupOverride,
  );
  const profitAmount = breakdown.markupAmount * getDraftQuantity();

  const markupAmountEl = elements.currentGarmentCard.querySelector("#breakdownMarkupAmount");
  const profitAmountEl = elements.currentGarmentCard.querySelector("#breakdownProfitAmount");
  if (markupAmountEl) {
    markupAmountEl.textContent = formatCurrency(breakdown.markupAmount);
  }
  if (profitAmountEl) {
    profitAmountEl.textContent = formatCurrency(profitAmount);
  }

  renderDraftPreview();
  renderQuoteSummary();
  persistActiveQuote();
}

function handleMarkupOverrideBlur(event) {
  const input = event.target.closest?.("[data-markup-override-input]");
  if (!input) {
    return;
  }

  markupCardEditing = false;
  renderCurrentGarmentCard();
  renderQuoteMeta();
  renderSavedQuotes();
}

function handleMarkupOverrideKeydown(event) {
  const input = event.target.closest?.("[data-markup-override-input]");
  if (!input) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    input.blur();
  }
}

function renderQuantityOptions() {
  const garmentReady = canBuildQuoteItems() && hasDraftGarment();
  const isCustom = isCustomQuantityActive();
  const quantity = getDraftQuantity();
  const bracket = getActivePrintPricingBracket();

  elements.quantityStage.classList.toggle("is-locked", !garmentReady);
  elements.quantityOptions.innerHTML = [
    ...QUANTITY_OPTIONS.map((option) => {
      const isActive = !isCustom && option === quantity ? "is-active" : "";
      return `
        <button
          class="chip-button ${isActive}"
          data-quantity="${option}"
          type="button"
          ${garmentReady ? "" : "disabled"}
        >
          ${option}
        </button>
      `;
    }),
    `
      <button
        class="chip-button custom-chip ${isCustom ? "is-active" : ""}"
        data-quantity="custom"
        type="button"
        ${garmentReady ? "" : "disabled"}
      >
        Custom
      </button>
    `,
  ].join("");

  elements.customQuantityPanel.hidden = !isCustom;
  elements.customQuantityInput.value = isCustom ? state.quoteDraft.customQuantity : "";
  const bracketLabel = garmentReady
    ? formatPrintBracketLabel(bracket)
    : formatPrintBracketLabel(getCurrentQuoteTotals().printQuantityBracket);
  elements.quantityBracketMeta.innerHTML = `Print pricing bracket <strong>${escapeHtml(bracketLabel)}</strong>`;
}

function renderDraftPrints() {
  const garmentReady = canBuildQuoteItems() && hasDraftGarmentPricing();
  elements.printsStage.classList.toggle("is-locked", !garmentReady);
  elements.openPrintSheetButton.disabled = !garmentReady;

  refreshListMotion(elements.draftPrintList);
  elements.draftPrintList.innerHTML = state.quoteDraft.prints
    .map((printLine) => {
      const position = getPositionById(printLine.positionId);
      const size = getSizeById(printLine.sizeId);

      return `
        <article class="mini-print-card" data-draft-print-id="${printLine.id}">
          <div>
            <strong>${escapeHtml(position?.label || "Custom position")}</strong>
            <span>${escapeHtml(size?.label || "Custom size")} · ${escapeHtml(
        size ? formatDimensions(size) : "",
      )}</span>
          </div>
          <div class="mini-print-meta">
            <strong>${formatCurrency(printLine.price)} each</strong>
            <button
              class="icon-button subtle-icon-button"
              data-remove-print="${printLine.id}"
              type="button"
              aria-label="Remove print"
            >
              ✕
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.draftPrintsEmpty.hidden = state.quoteDraft.prints.length > 0;
  animateTrackedEntry(
    state.motion.recentDraftPrintId
      ? `[data-draft-print-id="${state.motion.recentDraftPrintId}"]`
      : "",
  );
  state.motion.recentDraftPrintId = "";
}

function renderDraftPreview() {
  const pricingReady = canBuildQuoteItems() && hasDraftGarmentPricing();
  const previewItem = createDraftPreviewItem();
  const itemTotals = calculateQuoteItem(previewItem);
  const isEditing = Boolean(state.quoteDraft.editingItemId);
  const title = pricingReady
    ? `${previewItem.quantity} × ${getGarmentTitle(state.quoteDraft.garment)}`
    : "Choose a garment to start pricing";

  elements.totalsStage.classList.toggle("is-locked", !pricingReady);
  elements.addQuoteItemButton.disabled = !pricingReady;
  elements.addQuoteItemButton.textContent = isEditing ? "Update item" : "Add item to quote";

  elements.draftItemPreview.innerHTML = `
    <article class="summary-card item-preview-card ${isEditing ? "is-editing" : ""}">
      <div class="summary-card-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(getGarmentSubtitle(state.quoteDraft.garment) || "Current item")}</span>
        </div>
        <div class="saved-quote-total">
          ${isEditing ? '<span class="status-pill">Editing</span>' : ""}
          <strong>${formatCurrency(itemTotals.totalPrice)}</strong>
        </div>
      </div>

      <div class="summary-list">
        ${(previewItem.prints || [])
          .map(
            (printLine) => `
              <div class="summary-line">
                <span>${escapeHtml(printLine.positionLabel)} ${escapeHtml(printLine.sizeLabel)}</span>
                <strong>${formatCurrency(printLine.price)}</strong>
              </div>
            `,
          )
          .join("")}
        <div class="summary-line">
          <span>Garment</span>
          <strong>${formatCurrency(itemTotals.garmentUnitPrice)}</strong>
        </div>
        <div class="summary-line">
          <span>Unit price</span>
          <strong>${formatCurrency(itemTotals.totalUnitPrice)}</strong>
        </div>
        <div class="summary-line total-line-emphasis">
          <span>Line total</span>
          <strong>${formatCurrency(itemTotals.totalPrice)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderQuoteSummary() {
  const quoteItems = getQuoteItemsForDisplay();
  const totals = getCurrentQuoteTotals();
  setAnimatedText(elements.quoteGarmentCount, formatGarmentCount(totals.quoteQuantity));
  setAnimatedText(elements.quoteProductTypeCount, formatProductTypeCount(totals.itemCount));
  setAnimatedText(elements.quoteItemsSubtotalSummary, formatCurrency(totals.itemsSubtotal));
  setAnimatedText(elements.quoteDeliveryTotalSummary, formatCurrency(totals.deliveryTotal));
  setAnimatedText(elements.quoteGrandTotal, formatCurrency(totals.grandTotal));
  setAnimatedText(elements.footerGrandTotal, formatCurrency(totals.grandTotal));
  setAnimatedText(
    elements.quoteSheetBracketMeta,
    `Print pricing bracket: ${formatPrintBracketLabel(totals.printQuantityBracket)}`,
  );
  elements.openQuoteSheetButton.disabled = totals.itemCount === 0;

  refreshListMotion(elements.quoteItemsList);
  elements.quoteItemsList.innerHTML = quoteItems.map((item) => renderQuoteItemCard(item)).join("");
  elements.quoteItemsEmpty.hidden = quoteItems.length > 0;
  animateTrackedEntry(
    state.motion.recentQuoteItemId ? `[data-quote-item-id="${state.motion.recentQuoteItemId}"]` : "",
  );
  state.motion.recentQuoteItemId = "";
}

function renderQuoteItemCard(item) {
  const itemTotals = calculateQuoteItem(item);
  const title = `${item.quantity} × ${getGarmentTitle(item.garment)}`;

  return `
    <article class="summary-card quote-item-card" data-quote-item-id="${item.id}">
      <div class="summary-card-head quote-item-card-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(getGarmentSubtitle(item.garment) || "Quote item")}</span>
        </div>
        <button
          class="icon-button subtle-icon-button card-close-button quote-item-remove-button"
          data-remove-quote-item="${item.id}"
          type="button"
          aria-label="Delete quote item"
        >
          ✕
        </button>
      </div>

      <div class="summary-list">
        ${item.prints
          .map(
            (printLine) => `
              <div class="summary-line quote-item-print-line">
                <span>${escapeHtml(printLine.positionLabel)} ${escapeHtml(printLine.sizeLabel)}</span>
                <strong>${formatCurrency(printLine.price)}</strong>
              </div>
            `,
          )
          .join("")}
        <div class="summary-line quote-item-metric">
          <span>Garment</span>
          <strong>${formatCurrency(itemTotals.garmentUnitPrice)}</strong>
        </div>
        <div class="summary-line quote-item-metric">
          <span>Unit price</span>
          <strong>${formatCurrency(itemTotals.totalUnitPrice)}</strong>
        </div>
        <div class="summary-line quote-item-metric total-line-emphasis">
          <span>Line total</span>
          <strong>${formatCurrency(itemTotals.totalPrice)}</strong>
        </div>
      </div>

      <div class="quote-item-edit-row">
        <button
          class="secondary-button compact-button quote-item-edit-button"
          data-edit-quote-item="${item.id}"
          type="button"
        >
          Edit
        </button>
      </div>
    </article>
  `;
}

function renderSavedQuotes() {
  refreshListMotion(elements.savedQuotesList);
  elements.savedQuotesList.innerHTML = state.quotes
    .map((quote) => {
      const totals = calculateQuoteTotals(
        applyQuotePrintPricing(quote.quoteItems.map((item) => resolveQuoteItemForDisplay(item)), state.pricing),
        quote.delivery,
      );
      const isActive = quote.id === state.activeQuoteId;

      return `
        <article
          class="summary-card saved-quote-card ${isActive ? "is-current" : ""}"
          data-saved-quote-id="${quote.id}"
        >
          <button class="saved-quote-card-main" data-open-quote="${quote.id}" type="button">
            <div class="saved-quote-head">
              <div class="saved-quote-title-block">
                <div class="saved-quote-title-row">
                  <strong>${escapeHtml(getQuoteDisplayName(quote.name))}</strong>
                </div>
                <span class="saved-quote-date">${escapeHtml(
                  formatEditedDateTime(quote.updatedAt) || "Edited now",
                )}</span>
              </div>
              <div class="saved-quote-total">
                <span>Total</span>
                <strong>${formatCurrency(totals.grandTotal)}</strong>
              </div>
            </div>
            <div class="saved-quote-stats">
              <div class="saved-quote-stat">
                <span>Garments</span>
                <strong>${formatGarmentCount(totals.quoteQuantity)}</strong>
              </div>
              <div class="saved-quote-stat">
                <span>Product types</span>
                <strong>${formatProductTypeCount(totals.itemCount)}</strong>
              </div>
            </div>
          </button>

          <div class="saved-quote-actions">
            <button
              class="primary-button compact-button saved-quote-open-button"
              data-open-quote="${quote.id}"
              type="button"
            >
              Open
            </button>
            <button
              class="ghost-button compact-button"
              data-delete-quote="${quote.id}"
              type="button"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.savedQuotesEmpty.hidden = state.quotes.length > 0;
  animateTrackedEntry(
    state.motion.recentQuoteId ? `[data-saved-quote-id="${state.motion.recentQuoteId}"]` : "",
  );
  state.motion.recentQuoteId = "";
}

function renderGarmentSearchResults() {
  const groups = getGroupedGarments(state.quoteGarmentSearch);

  refreshListMotion(elements.quoteGarmentResults);
  elements.quoteGarmentResults.innerHTML = groups
    .map(({ category, garments }) => {
      const shouldForceOpen = Boolean(state.quoteGarmentSearch.trim());
      const isOpen = shouldForceOpen || Boolean(state.garmentPickerOpenCategories[category.id]);

      return `
        <section class="picker-group">
          <button
            class="disclosure-toggle picker-category-row ${isOpen ? "is-open" : ""}"
            data-toggle-garment-category="${category.id}"
            type="button"
          >
            <strong>${escapeHtml(category.label)}</strong>
            <div class="disclosure-tail">
              <span class="disclosure-count">${garments.length}</span>
              <span class="caret">›</span>
            </div>
          </button>
          <div
            class="disclosure-body picker-garment-list"
            aria-hidden="${isOpen ? "false" : "true"}"
          >
            ${garments
              .map(
                (garment) => `
                  <button
                    class="quick-card picker-garment-row"
                    data-load-quote-garment="${garment.id}"
                    type="button"
                  >
                    <strong>${escapeHtml(getGarmentTitle(garment))}</strong>
                    <span>${escapeHtml(getGarmentSubtitle(garment) || category.label)}</span>
                    <em>${formatCurrency(garment.sellPrice)}</em>
                  </button>
                `,
              )
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");

  elements.quoteGarmentResultsEmpty.hidden = groups.length > 0;
}

function renderGarmentCreatorState() {
  elements.garmentCreatorPanel.hidden = !state.garmentCreatorOpen;
  elements.toggleGarmentCreatorButton.textContent = state.garmentCreatorOpen
    ? "Hide New Garment Form"
    : "Add New Garment";
}

function renderGarmentSheetMeta() {
  const breakdown = calculateGarmentBreakdown(state.quoteDraft.garment.costPrice, state.settings);
  setAnimatedText(elements.quoteGarmentSellPrice, formatCurrency(breakdown.sellPrice));
  elements.quoteGarmentBreakdown.innerHTML = `
    <p>Cost: <strong>${formatCurrency(breakdown.baseCost)}</strong></p>
    <div class="breakdown-inline">
      <p>VAT <strong>${formatCurrency(breakdown.vatAmount)}</strong></p>
      <p>Markup <strong>${formatCurrency(breakdown.markupAmount)}</strong></p>
    </div>
    <p>Sell: <strong>${formatCurrency(breakdown.sellPrice)}</strong></p>
  `;
}

function renderPrintSheet() {
  const selectedPositionId = state.quoteDraft.printDraft.positionId;
  const selectedSizeId = state.quoteDraft.printDraft.sizeId;
  const availableSizes = getPricingSizesForPosition(selectedPositionId);

  elements.printPositionOptions.innerHTML = state.positions
    .map(
      (position) => `
        <button
          class="chip-button ${position.id === selectedPositionId ? "is-active" : ""}"
          data-print-position="${position.id}"
          type="button"
        >
          ${escapeHtml(position.label)}
        </button>
      `,
    )
    .join("");

  elements.printSizeOptions.innerHTML = availableSizes
    .map(
      (size) => `
        <button
          class="size-chip ${size.id === selectedSizeId ? "is-active" : ""}"
          data-print-size="${size.id}"
          type="button"
        >
          <strong>${escapeHtml(size.label)}</strong>
          <span>${escapeHtml(formatDimensions(size))}</span>
        </button>
      `,
    )
    .join("");

  renderPrintSheetMeta();
}

function renderPrintSheetMeta() {
  const size = getSizeById(state.quoteDraft.printDraft.sizeId);
  const quoteQuantity = getDraftPricingQuoteQuantity();
  const bracket = resolveQuantityBracket(quoteQuantity);
  const computedPrice = getComputedPrintPrice(
    state.quoteDraft.printDraft.positionId,
    state.quoteDraft.printDraft.sizeId,
    quoteQuantity,
  );

  setAnimatedText(elements.draftPrintComputedPrice, formatCurrency(computedPrice));
  setAnimatedText(
    elements.draftPrintSizeMeta,
    size ? `${size.label} · ${formatDimensions(size)}` : "",
  );
  setAnimatedText(
    elements.draftPrintBracketMeta,
    `Using quote bracket ${formatPrintBracketLabel(bracket)} for ${formatGarmentCount(
      quoteQuantity || 0,
    )}.`,
  );
  elements.draftPrintPrice.value = state.quoteDraft.printDraft.price;
}

function renderGarmentLibrary() {
  const query = String(state.garmentLibrarySearch || "").trim();
  const garments = getFilteredGarments(state.garmentLibrarySearch);
  const groups = state.garmentCategories
    .map((category) => ({
      category,
      garments: garments.filter((garment) => garment.categoryId === category.id),
    }))
    .filter((group) => (query ? group.garments.length > 0 : true));

  refreshListMotion(elements.garmentLibraryList);
  elements.garmentLibraryList.innerHTML = groups
    .map(({ category, garments: categoryGarments }) => {
      const isOpen = query ? true : Boolean(state.garmentLibraryOpenCategories[category.id]);
      const garmentsMarkup = categoryGarments.length
        ? categoryGarments
            .map(
              (garment) => `
                <article class="library-row-shell">
                  <button class="library-row-button" data-edit-garment="${garment.id}" type="button">
                    <div class="library-row-copy">
                      <strong>${escapeHtml(garment.brand || "Unbranded")}</strong>
                      <span>${escapeHtml(garment.name || getGarmentTitle(garment))}</span>
                    </div>
                    <div class="library-row-side">
                      <em>${formatCurrency(garment.sellPrice)}</em>
                      <span class="caret" aria-hidden="true">›</span>
                    </div>
                  </button>
                  <button
                    class="secondary-button compact-button library-use-button"
                    data-use-garment="${garment.id}"
                    type="button"
                  >
                    Use in quote
                  </button>
                </article>
              `,
            )
            .join("")
        : '<p class="empty-copy compact-note">No garments in this category yet.</p>';

      return `
        <details class="manager-details library-group" data-library-category="${category.id}" ${isOpen ? "open" : ""}>
          <summary>
            <div class="pricing-card-summary library-group-summary">
              <strong>${escapeHtml(category.label)}</strong>
              <span>${categoryGarments.length}</span>
            </div>
          </summary>
          <div class="manager-detail-body">
            <div class="library-group-list">
              ${garmentsMarkup}
            </div>
          </div>
        </details>
      `;
    })
    .join("");

  elements.garmentLibraryEmpty.hidden = !query || groups.length > 0;
}

function renderGarmentCategoryManager() {
  elements.garmentCategoryList.innerHTML = state.garmentCategories
    .map(
      (category) => `
        <article class="manager-row category-manager-row">
          <input data-category-name="${category.id}" type="text" value="${escapeHtml(category.label)}" />
          <button
            class="ghost-button compact-button square-button"
            data-delete-category="${category.id}"
            type="button"
            aria-label="Delete ${escapeHtml(category.label)}"
            title="Delete ${escapeHtml(category.label)}"
          >
            ✕
          </button>
        </article>
      `,
    )
    .join("");
}

function renderGarmentEditorState() {
  const isEditing = Boolean(state.garmentEditorId);
  elements.garmentEditorPanel.hidden = !state.garmentEditorOpen;
  elements.garmentEditorPanel.classList.toggle("is-open", state.garmentEditorOpen);
  elements.toggleGarmentEditorButton.setAttribute(
    "aria-expanded",
    String(state.garmentEditorOpen),
  );
  elements.toggleGarmentEditorButton.textContent = state.garmentEditorOpen
    ? "Hide Garment Editor"
    : "Add New Garment";
  elements.garmentEditorTitle.textContent = isEditing ? "Edit Garment" : "New Garment";
  elements.garmentEditorDeleteButton.disabled = !state.garmentEditorId;
}

function renderPositionManager() {
  elements.positionList.innerHTML = state.positions
    .map(
      (position) => `
        <button
          class="manager-nav-row"
          data-open-position-editor="${position.id}"
          type="button"
        >
          <strong>${escapeHtml(position.label)}</strong>
          <span class="caret" aria-hidden="true">›</span>
        </button>
      `,
    )
    .join("");
}

function renderSizeManager() {
  elements.sizeList.innerHTML = state.sizes
    .map(
      (size) => `
        <button
          class="manager-nav-row manager-nav-row-detail"
          data-open-size-editor="${size.id}"
          type="button"
        >
          <div>
            <strong>${escapeHtml(size.label)}</strong>
            <span>${escapeHtml(formatDimensions(size))}</span>
          </div>
          <span class="caret" aria-hidden="true">›</span>
        </button>
      `,
    )
    .join("");
}

function renderPricingManager() {
  ensurePricingManagerSelection();

  elements.pricingPositionSelect.innerHTML = state.positions
    .map(
      (position) => `
        <option value="${escapeHtml(position.id)}">${escapeHtml(position.label)}</option>
      `,
    )
    .join("");
  elements.pricingPositionSelect.value = state.pricingPositionId;

  const availableSizes = getPricingSizesForPosition(state.pricingPositionId);
  elements.pricingSizeSelect.innerHTML = availableSizes.length
    ? availableSizes
        .map(
          (size) => `
            <option value="${escapeHtml(size.id)}">${escapeHtml(size.label)}</option>
          `,
        )
        .join("")
    : '<option value="">No sizes attached</option>';
  elements.pricingSizeSelect.disabled = !availableSizes.length;
  elements.pricingSizeSelect.value = availableSizes.length ? state.pricingSizeId : "";

  elements.pricingAttachedSizes.innerHTML = availableSizes
    .map(
      (size) => `
        <span class="attached-size-chip">${escapeHtml(size.label)}</span>
      `,
    )
    .join("");
  elements.pricingAttachedSizesEmpty.hidden = availableSizes.length > 0;

  const selectedPosition = getPositionById(state.pricingPositionId);
  const selectedSize = getSizeById(state.pricingSizeId);

  elements.pricingComboPositionLabel.textContent = selectedPosition?.label || "Position";
  elements.pricingComboSizeLabel.textContent = selectedSize?.label || "Choose a size";
  elements.pricingComboMeta.textContent = selectedSize
    ? `${formatDimensions(selectedSize)} · Editable placeholder pricing`
    : "Attach a size to this position to start editing prices.";

  if (!selectedPosition || !selectedSize) {
    elements.pricingCards.innerHTML = "";
    elements.pricingCardsEmpty.hidden = false;
    return;
  }

  elements.pricingCards.innerHTML = QUANTITY_OPTIONS.map((quantity) => {
    const value = state.pricing?.[selectedPosition.id]?.[selectedSize.id]?.[quantity] ?? 0;

    return `
      <label class="pricing-editor-row">
        <div class="pricing-editor-copy">
          <strong>${formatPrintBracketLabel(quantity)}</strong>
          <span>${escapeHtml(selectedPosition.label)} · ${escapeHtml(selectedSize.label)}</span>
        </div>
        <div class="mini-currency-input pricing-editor-input">
          <span>£</span>
          <input
            data-pricing-position="${escapeHtml(selectedPosition.id)}"
            data-pricing-size="${escapeHtml(selectedSize.id)}"
            data-pricing-quantity="${quantity}"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            value="${sanitiseNumber(value, 0).toFixed(2)}"
          />
        </div>
      </label>
    `;
  }).join("");
  elements.pricingCardsEmpty.hidden = true;
}

function renderPositionSheetState() {
  const activePosition = state.positions.find((position) => position.id === state.positionEditorId) || null;
  elements.positionSheetTitle.textContent = activePosition ? "Position details" : "Add position";
  elements.positionEditorName.value = activePosition?.label || "";
  elements.deletePositionButton.hidden = !activePosition;
}

function renderSizeSheetState() {
  const activeSize = state.sizes.find((size) => size.id === state.sizeEditorId) || null;
  elements.sizeSheetTitle.textContent = activeSize ? "Size details" : "Add size";
  elements.sizeEditorLabel.value = activeSize?.label || "";
  elements.sizeEditorWidth.value = activeSize?.widthMm ?? "";
  elements.sizeEditorHeight.value = activeSize?.heightMm ?? "";
  elements.deleteSizeButton.hidden = !activeSize;
}

function renderPositionSizesSheetState() {
  const selectedPosition = getPositionById(state.pricingPositionId);
  const attachedSizeIds = getPositionSizeIds(state.pricingPositionId);

  elements.positionSizesSheetTitle.textContent = selectedPosition
    ? `${selectedPosition.label} sizes`
    : "Position sizes";
  elements.positionSizesList.innerHTML = state.sizes
    .map((size) => {
      const isAttached = attachedSizeIds.includes(size.id);

      return `
        <button
          class="manager-nav-row manager-nav-row-detail selector-row ${isAttached ? "is-selected" : ""}"
          data-toggle-position-size="${size.id}"
          type="button"
        >
          <div>
            <strong>${escapeHtml(size.label)}</strong>
            <span>${escapeHtml(formatDimensions(size))}</span>
          </div>
          <span class="selector-row-state" aria-hidden="true">${isAttached ? "✓" : "+"}</span>
        </button>
      `;
    })
    .join("");
  elements.positionSizesEmpty.hidden = state.sizes.length > 0;
}

function renderCategoryOptions() {
  renderCategorySelect(elements.quoteGarmentCategory, state.quoteDraft.garment.categoryId);
  renderCategorySelect(elements.garmentEditorCategory, elements.garmentEditorCategory.value);
}

function renderCategorySelect(selectElement, selectedValue) {
  selectElement.innerHTML = state.garmentCategories
    .map(
      (category) => `
        <option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>
      `,
    )
    .join("");

  selectElement.value =
    state.garmentCategories.find((category) => category.id === selectedValue)?.id ||
    getDefaultCategoryId();
}

function syncQuoteMetaInputs() {
  elements.quoteNameInput.value = state.quoteNameDraft;
}

function syncGarmentDraftInputs() {
  renderCategoryOptions();
  elements.quoteGarmentName.value = state.quoteDraft.garment.name;
  elements.quoteGarmentCategory.value = resolveCategoryId(state.quoteDraft.garment.categoryId);
  elements.quoteGarmentBrand.value = state.quoteDraft.garment.brand;
  elements.quoteGarmentCode.value = state.quoteDraft.garment.code;
  elements.quoteGarmentCost.value = state.quoteDraft.garment.costPrice;
  elements.quoteGarmentNotes.value = state.quoteDraft.garment.notes;
}

function syncGarmentEditor(garment = null) {
  const activeGarment = garment || {
    categoryId: getDefaultCategoryId(),
    name: "",
    brand: "",
    code: "",
    costPrice: "",
    notes: "",
  };

  renderCategoryOptions();
  elements.garmentEditorName.value = activeGarment.name || "";
  elements.garmentEditorCategory.value = resolveCategoryId(activeGarment.categoryId);
  elements.garmentEditorBrand.value = activeGarment.brand || "";
  elements.garmentEditorCode.value = activeGarment.code || "";
  elements.garmentEditorCost.value = activeGarment.costPrice ?? "";
  elements.garmentEditorNotes.value = activeGarment.notes || "";
  setAnimatedText(
    elements.garmentEditorSellPrice,
    formatCurrency(
      calculateGarmentSellPrice(activeGarment.costPrice, state.settings),
    ),
  );
}

function syncSettingsForm() {
  elements.settingsVatRate.value = state.settings.vatRate;
  elements.settingsMarkupRate.value = state.settings.markupRate;
  elements.settingsDeliveryServiceName.value = state.settings.deliveryServiceName;
  elements.settingsDeliveryPricePerBox.value = state.settings.deliveryPricePerBox;
  elements.settingsDefaultDeliveryBoxes.value = state.settings.defaultDeliveryBoxes;
}

function setActivePage(page) {
  if (!PAGES.includes(page)) {
    return;
  }

  state.activePage = page;
  state.drawerOpen = false;

  if (page !== "quote") {
    state.garmentSheetOpen = false;
    state.printSheetOpen = false;
    state.quoteSheetOpen = false;
  }

  if (page !== "pricing") {
    state.positionSheetOpen = false;
    state.sizeSheetOpen = false;
    state.positionSizesSheetOpen = false;
  }

  persistUiState();
  renderAppShell();
}

function toggleDrawer() {
  if (isDesktopSidebarViewport()) {
    return;
  }

  if (state.drawerOpen) {
    closeDrawer({ restoreFocus: true });
    return;
  }

  openDrawer();
}

function openDrawer() {
  if (isDesktopSidebarViewport()) {
    return;
  }

  state.drawerOpen = true;
  renderAppShell();
  focusDrawerPrimaryControl();
}

function closeDrawer(options = {}) {
  const { restoreFocus = false } = options;
  const shouldRestoreFocus =
    restoreFocus || Boolean(document.activeElement && elements.drawerShell.contains(document.activeElement));

  state.drawerOpen = false;
  renderAppShell();

  if (shouldRestoreFocus) {
    restoreDrawerToggleFocus();
  }
}

function handleGlobalKeyDown(event) {
  if (event.key === "Escape" && state.confirmDialogOpen) {
    event.preventDefault();
    closeConfirmDialog();
    return;
  }

  if (event.key === "Escape" && state.drawerOpen) {
    event.preventDefault();
    closeDrawer({ restoreFocus: true });
  }
}

function isDesktopSidebarViewport() {
  return Boolean(globalThis.matchMedia?.(DESKTOP_SIDEBAR_QUERY)?.matches);
}

function bindViewportModeChange() {
  const mediaQuery = globalThis.matchMedia?.(DESKTOP_SIDEBAR_QUERY);
  if (!mediaQuery) {
    return;
  }

  const handleViewportModeChange = () => {
    if (mediaQuery.matches) {
      state.drawerOpen = false;
    }
    renderAppShell();
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleViewportModeChange);
    return;
  }

  mediaQuery.addListener(handleViewportModeChange);
}

function bindDrawerSwipeGesture() {
  if (!elements.drawerPanel) {
    return;
  }

  elements.drawerPanel.addEventListener("touchstart", handleDrawerTouchStart, { passive: true });
  elements.drawerPanel.addEventListener("touchend", handleDrawerTouchEnd, { passive: true });
  elements.drawerPanel.addEventListener("touchcancel", resetDrawerTouchTracking, { passive: true });
}

function handleDrawerTouchStart(event) {
  if (!state.drawerOpen) {
    return;
  }

  const touch = event.changedTouches?.[0];
  if (!touch) {
    return;
  }

  drawerSwipe.startX = touch.clientX;
  drawerSwipe.startY = touch.clientY;
  drawerSwipe.tracking = true;
}

function handleDrawerTouchEnd(event) {
  if (!state.drawerOpen || !drawerSwipe.tracking) {
    return;
  }

  const touch = event.changedTouches?.[0];
  if (!touch) {
    resetDrawerTouchTracking();
    return;
  }

  const deltaX = touch.clientX - drawerSwipe.startX;
  const deltaY = touch.clientY - drawerSwipe.startY;

  if (deltaX <= -60 && Math.abs(deltaY) <= 48) {
    closeDrawer();
  }

  resetDrawerTouchTracking();
}

function resetDrawerTouchTracking() {
  drawerSwipe.tracking = false;
  drawerSwipe.startX = 0;
  drawerSwipe.startY = 0;
}

function openDeleteDialog({ title, message = "This action cannot be undone.", onConfirm }) {
  if (typeof onConfirm !== "function") {
    return;
  }

  pendingConfirmAction = onConfirm;
  state.confirmDialogTitle = title;
  state.confirmDialogMessage = message;
  state.confirmDialogOpen = true;
  state.drawerOpen = false;
  renderConfirmDialog();
  renderAppShell();
}

function closeConfirmDialog() {
  state.confirmDialogOpen = false;
  state.confirmDialogTitle = "Delete item?";
  state.confirmDialogMessage = "This action cannot be undone.";
  pendingConfirmAction = null;
  renderConfirmDialog();
  renderAppShell();
}

function confirmDeleteAction() {
  const action = pendingConfirmAction;
  closeConfirmDialog();
  action?.();
}

function openQuoteDeleteDialog(quoteId) {
  const quote = state.quotes.find((item) => item.id === quoteId);
  if (!quote) {
    return;
  }

  openDeleteDialog({
    title: "Delete quote?",
    onConfirm: () => deleteQuote(quoteId),
  });
}

function openGarmentSheet() {
  if (!canBuildQuoteItems()) {
    return;
  }

  state.quoteGarmentSearch = "";
  state.garmentPickerOpenCategories = buildCategoryOpenState(
    state.garmentCategories,
    {},
  );
  elements.quoteGarmentSearch.value = "";
  state.drawerOpen = false;
  state.printSheetOpen = false;
  state.quoteSheetOpen = false;
  state.garmentSheetOpen = true;
  state.garmentCreatorOpen =
    !state.quoteDraft.garment.sourceId &&
    (hasDraftGarment() || state.garments.length === 0);

  syncGarmentDraftInputs();
  renderGarmentCreatorState();
  renderGarmentSearchResults();
  renderGarmentSheetMeta();
  renderAppShell();
}

function closeGarmentSheet() {
  state.garmentSheetOpen = false;
  renderAppShell();
}

function openPrintSheet() {
  if (!canBuildQuoteItems() || !hasDraftGarmentPricing()) {
    return;
  }

  state.drawerOpen = false;
  state.garmentSheetOpen = false;
  state.quoteSheetOpen = false;
  state.printSheetOpen = true;
  ensureDraftSelections();
  refreshDraftPriceFromPricing(true);
  renderPrintSheet();
  renderAppShell();
}

function closePrintSheet() {
  state.printSheetOpen = false;
  renderAppShell();
}

function openQuoteSheet() {
  if (!state.quoteItems.length) {
    return;
  }

  state.drawerOpen = false;
  state.garmentSheetOpen = false;
  state.printSheetOpen = false;
  state.quoteSheetOpen = true;
  renderAppShell();
}

function closeQuoteSheet() {
  state.quoteSheetOpen = false;
  renderAppShell();
}

function openPositionSheet(positionId = "") {
  state.positionEditorId = positionId;
  state.drawerOpen = false;
  state.sizeSheetOpen = false;
  state.positionSizesSheetOpen = false;
  state.positionSheetOpen = true;
  renderPositionSheetState();
  renderAppShell();
}

function openPositionSheetForCreate() {
  openPositionSheet("");
}

function closePositionSheet() {
  state.positionSheetOpen = false;
  renderAppShell();
}

function openSizeSheet(sizeId = "") {
  state.sizeEditorId = sizeId;
  state.drawerOpen = false;
  state.positionSheetOpen = false;
  state.positionSizesSheetOpen = false;
  state.sizeSheetOpen = true;
  renderSizeSheetState();
  renderAppShell();
}

function openSizeSheetForCreate() {
  openSizeSheet("");
}

function closeSizeSheet() {
  state.sizeSheetOpen = false;
  renderAppShell();
}

function openPositionSizesSheet() {
  state.drawerOpen = false;
  state.positionSheetOpen = false;
  state.sizeSheetOpen = false;
  state.positionSizesSheetOpen = true;
  renderPositionSizesSheetState();
  renderAppShell();
}

function closePositionSizesSheet() {
  state.positionSizesSheetOpen = false;
  renderAppShell();
}

function handleQuoteNameInput(event) {
  state.quoteNameDraft = event.target.value;
  renderQuoteMeta();
}

function saveQuoteName() {
  const nextName = state.quoteNameDraft.trim();
  if (!nextName) {
    window.alert("Enter a quote name before saving.");
    return;
  }

  state.quoteName = nextName;
  state.quoteNameDraft = nextName;
  persistActiveQuote();
  renderQuoteMeta();
  renderQuoteComposer();
  renderQuoteSummary();
  renderSavedQuotes();
}

function adjustDeliveryBoxes(delta) {
  const resolvedBoxes = Math.max(0, getQuoteDeliveryBoxes() + delta);
  state.quoteDelivery.boxMode = "custom";
  state.quoteDelivery.boxes = resolvedBoxes;
  state.quoteDelivery.customBoxes = String(resolvedBoxes);

  persistActiveQuote();
  renderQuoteMeta();
  renderQuoteSummary();
  renderSavedQuotes();
}

function handleCurrentGarmentCardClick(event) {
  if (!canBuildQuoteItems()) {
    return;
  }

  const markupCell = event.target.closest("[data-markup-cell]");
  if (markupCell && !markupCardEditing) {
    markupCardEditing = true;
    renderCurrentGarmentCard();
    elements.currentGarmentCard.querySelector("[data-markup-override-input]")?.focus();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) {
    return;
  }

  if (action === "open-garment-sheet" && event.target.closest(".breakdown")) {
    return;
  }

  if (action === "open-garment-sheet") {
    openGarmentSheet();
  }

  if (action === "save-current-garment") {
    saveQuoteGarmentToLibrary();
  }

  if (action === "clear-current-garment") {
    clearQuoteGarment();
  }
}

function handleQuoteGarmentInput(event) {
  state.quoteDraft.garment.sourceId = "";

  state.quoteDraft.garment.name = elements.quoteGarmentName.value;
  state.quoteDraft.garment.categoryId = resolveCategoryId(elements.quoteGarmentCategory.value);
  state.quoteDraft.garment.brand = elements.quoteGarmentBrand.value;
  state.quoteDraft.garment.code = elements.quoteGarmentCode.value;
  state.quoteDraft.garment.costPrice = elements.quoteGarmentCost.value;
  state.quoteDraft.garment.notes = elements.quoteGarmentNotes.value;

  renderCurrentGarmentCard();
  renderGarmentSheetMeta();
  renderDraftPreview();
  renderQuoteSummary();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function handleQuoteGarmentResultClick(event) {
  const toggleButton = event.target.closest("[data-toggle-garment-category]");
  if (toggleButton && !state.quoteGarmentSearch.trim()) {
    const categoryId = toggleButton.dataset.toggleGarmentCategory;
    state.garmentPickerOpenCategories[categoryId] = !state.garmentPickerOpenCategories[categoryId];
    persistUiState();
    renderGarmentSearchResults();
    return;
  }

  const garmentButton = event.target.closest("[data-load-quote-garment]");
  if (!garmentButton) {
    return;
  }

  const garment = state.garments.find((item) => item.id === garmentButton.dataset.loadQuoteGarment);
  if (!garment) {
    return;
  }

  loadGarmentIntoQuoteDraft(garment);
  closeGarmentSheet();
  scrollSectionIntoViewIfNeeded(elements.quantityStage);
}

function handleQuantityClick(event) {
  const button = event.target.closest("[data-quantity]");
  if (!button || !hasDraftGarment()) {
    return;
  }

  if (button.dataset.quantity === "custom") {
    state.quoteDraft.quantityMode = "custom";
    if (!String(state.quoteDraft.customQuantity || "").trim()) {
      state.quoteDraft.customQuantity = String(getDraftQuantity());
    }
  } else {
    state.quoteDraft.quantityMode = "preset";
    state.quoteDraft.quantity = sanitiseNumber(button.dataset.quantity, state.quoteDraft.quantity);
    state.quoteDraft.customQuantity = "";
  }

  repriceDraftPrintsForQuantity();
  refreshDraftPriceFromPricing(true);
  renderCurrentGarmentCard();
  renderQuantityOptions();
  renderDraftPrints();
  renderDraftPreview();
  renderPrintSheetMeta();
  renderQuoteSummary();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
  scrollSectionIntoViewIfNeeded(elements.printsStage);
}

function handleCustomQuantityInput(event) {
  const rawValue = event.target.value;
  state.quoteDraft.quantityMode = "custom";
  state.quoteDraft.customQuantity = rawValue;

  if (rawValue !== "") {
    state.quoteDraft.quantity = Math.max(1, Math.floor(sanitiseNumber(rawValue, getDraftQuantity())));
  }

  repriceDraftPrintsForQuantity();
  refreshDraftPriceFromPricing(true);
  renderCurrentGarmentCard();
  renderQuantityOptions();
  renderDraftPrints();
  renderDraftPreview();
  renderPrintSheetMeta();
  renderQuoteSummary();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function handleCustomQuantityBlur() {
  if (!isCustomQuantityActive()) {
    return;
  }

  if (!String(state.quoteDraft.customQuantity || "").trim()) {
    state.quoteDraft.customQuantity = String(getDraftQuantity());
    elements.customQuantityInput.value = state.quoteDraft.customQuantity;
    renderCurrentGarmentCard();
    persistActiveQuote();
    renderQuoteSummary();
    renderQuoteMeta();
    renderSavedQuotes();
  }
}

function handlePrintPositionClick(event) {
  const button = event.target.closest("[data-print-position]");
  if (!button) {
    return;
  }

  state.quoteDraft.printDraft.positionId = button.dataset.printPosition;
  if (!isValidPrintReference(
    state.quoteDraft.printDraft.positionId,
    state.quoteDraft.printDraft.sizeId,
  )) {
    state.quoteDraft.printDraft.sizeId =
      getPricingSizesForPosition(state.quoteDraft.printDraft.positionId)[0]?.id || "";
  }
  refreshDraftPriceFromPricing(true);
  renderPrintSheet();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function handlePrintSizeClick(event) {
  const button = event.target.closest("[data-print-size]");
  if (!button) {
    return;
  }

  state.quoteDraft.printDraft.sizeId = button.dataset.printSize;
  refreshDraftPriceFromPricing(true);
  renderPrintSheet();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function handleDraftPrintListClick(event) {
  const button = event.target.closest("[data-remove-print]");
  if (!button) {
    return;
  }

  requestDeleteDraftPrint(button.dataset.removePrint);
}

function handleQuoteItemListClick(event) {
  const editButton = event.target.closest("[data-edit-quote-item]");
  if (editButton) {
    editQuoteItem(editButton.dataset.editQuoteItem);
    return;
  }

  const duplicateButton = event.target.closest("[data-duplicate-quote-item]");
  if (duplicateButton) {
    duplicateQuoteItem(duplicateButton.dataset.duplicateQuoteItem);
    return;
  }

  const removeButton = event.target.closest("[data-remove-quote-item]");
  if (removeButton) {
    requestDeleteQuoteItem(removeButton.dataset.removeQuoteItem);
  }
}

function handleSavedQuotesListClick(event) {
  const openButton = event.target.closest("[data-open-quote]");
  if (openButton) {
    openSavedQuote(openButton.dataset.openQuote);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-quote]");
  if (deleteButton) {
    openQuoteDeleteDialog(deleteButton.dataset.deleteQuote);
  }
}

function handleGarmentLibraryClick(event) {
  const editButton = event.target.closest("[data-edit-garment]");
  if (editButton) {
    const garment = state.garments.find((item) => item.id === editButton.dataset.editGarment);
    if (!garment) {
      return;
    }

    state.garmentEditorId = garment.id;
    state.garmentEditorOpen = true;
    syncGarmentEditor(garment);
    renderGarmentEditorState();
    return;
  }

  const useButton = event.target.closest("[data-use-garment]");
  if (useButton) {
    const garment = state.garments.find((item) => item.id === useButton.dataset.useGarment);
    if (!garment) {
      return;
    }

    loadGarmentIntoQuoteDraft(garment);
    setActivePage("quote");
  }
}

function handleGarmentLibraryToggle(event) {
  const details = event.target.closest("[data-library-category]");
  if (!details || state.garmentLibrarySearch.trim()) {
    return;
  }

  state.garmentLibraryOpenCategories[details.dataset.libraryCategory] = details.open;
  persistUiState();
}

function handleGarmentCategoryListClick(event) {
  const button = event.target.closest("[data-delete-category]");
  if (!button || state.garmentCategories.length <= 1) {
    return;
  }

  const categoryId = button.dataset.deleteCategory;
  requestDeleteGarmentCategory(categoryId);
}

function handleGarmentCategoryListInput(event) {
  const input = event.target.closest("[data-category-name]");
  if (!input) {
    return;
  }

  const category = state.garmentCategories.find((item) => item.id === input.dataset.categoryName);
  if (!category) {
    return;
  }

  const nextLabel = input.value.trim();
  if (!nextLabel) {
    return;
  }

  category.label = nextLabel;
  persist(STORAGE_KEYS.garmentCategories, state.garmentCategories);
  renderCategoryOptions();
  syncGarmentDraftInputs();
  syncGarmentEditor(state.garments.find((garment) => garment.id === state.garmentEditorId) || null);
  renderCurrentGarmentCard();
  renderGarmentSearchResults();
  renderGarmentLibrary();
}

function handleGarmentEditorInput() {
  setAnimatedText(
    elements.garmentEditorSellPrice,
    formatCurrency(calculateGarmentSellPrice(elements.garmentEditorCost.value, state.settings)),
  );
}

function handlePositionListClick(event) {
  const row = event.target.closest("[data-open-position-editor]");
  if (!row) {
    return;
  }

  openPositionSheet(row.dataset.openPositionEditor);
}

function handleSizeListClick(event) {
  const row = event.target.closest("[data-open-size-editor]");
  if (!row) {
    return;
  }

  openSizeSheet(row.dataset.openSizeEditor);
}

function handlePricingPositionChange(event) {
  state.pricingPositionId = event.target.value;
  ensurePricingManagerSelection();
  persistUiState();
  renderPricingManager();
  renderPositionSizesSheetState();
}

function handlePricingSizeChange(event) {
  state.pricingSizeId = event.target.value;
  state.pricingCardSizeId = state.pricingSizeId;
  persistUiState();
  renderPricingManager();
}

function handlePositionSizesListClick(event) {
  const row = event.target.closest("[data-toggle-position-size]");
  if (!row || !state.pricingPositionId) {
    return;
  }

  togglePositionSizeBinding(state.pricingPositionId, row.dataset.togglePositionSize);
}

function handlePricingInput(event) {
  const input = event.target.closest("[data-pricing-position]");
  if (!input) {
    return;
  }

  const positionId = input.dataset.pricingPosition;
  const sizeId = input.dataset.pricingSize;
  const quantity = input.dataset.pricingQuantity;

  state.pricing[positionId][sizeId][quantity] = sanitiseNumber(input.value, 0);
  persist(STORAGE_KEYS.pricing, state.pricing);
  syncActiveQuoteWithLibraries();
  renderDraftPrints();
  renderDraftPreview();
  renderPrintSheetMeta();
  renderQuoteSummary();
  renderQuoteMeta();
  persistActiveQuote();
  renderSavedQuotes();
}

function useCurrentDraftGarment() {
  if (!validateDraftGarment()) {
    return;
  }

  renderCurrentGarmentCard();
  renderQuantityOptions();
  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  closeGarmentSheet();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
  scrollSectionIntoViewIfNeeded(elements.quantityStage);
}

function saveQuoteGarmentToLibrary() {
  if (!validateDraftGarment()) {
    return;
  }

  const garment = upsertGarment(buildGarmentPayloadFromQuote());
  state.quoteDraft.garment.sourceId = garment.id;
  state.quoteDraft.garment.costPrice = garment.costPrice.toFixed(2);
  syncGarmentDraftInputs();
  renderCurrentGarmentCard();
  renderGarmentSheetMeta();
  renderGarmentSearchResults();
  renderGarmentLibrary();
  renderDraftPreview();
  renderQuoteSummary();
  closeGarmentSheet();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
  scrollSectionIntoViewIfNeeded(elements.quantityStage);
}

function clearQuoteGarment() {
  state.quoteDraft.garment = {
    sourceId: "",
    categoryId: getDefaultCategoryId(),
    name: "",
    brand: "",
    code: "",
    costPrice: "",
    notes: "",
  };
  state.quoteDraft.prints = [];
  state.quoteDraft.printDraft.price = "";
  syncGarmentDraftInputs();
  refreshDraftPriceFromPricing(true);
  renderCurrentGarmentCard();
  renderQuantityOptions();
  renderDraftPrints();
  renderDraftPreview();
  renderGarmentSheetMeta();
  renderQuoteSummary();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function saveCurrentPrint() {
  if (!hasDraftGarmentPricing()) {
    return;
  }

  if (!state.quoteDraft.printDraft.positionId || !state.quoteDraft.printDraft.sizeId) {
    window.alert("Choose a print position and size first.");
    return;
  }

  const isFirstPrint = state.quoteDraft.prints.length === 0;
  const printId = generateId();
  state.quoteDraft.prints.push({
    id: printId,
    positionId: state.quoteDraft.printDraft.positionId,
    sizeId: state.quoteDraft.printDraft.sizeId,
    price: sanitiseNumber(state.quoteDraft.printDraft.price, 0),
  });
  state.motion.recentDraftPrintId = printId;

  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  closePrintSheet();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();

  if (isFirstPrint) {
    scrollSectionIntoViewIfNeeded(elements.totalsStage);
  }
}

function saveQuoteItemFromDraft() {
  if (!validateDraftGarment()) {
    return;
  }

  const garment = ensureDraftGarmentRecord();
  const editingId = state.quoteDraft.editingItemId;
  const existingItem = state.quoteItems.find((item) => item.id === editingId);
  const snapshot = createQuoteItemRecord(
    buildDraftSnapshotSource(editingId || generateId(), existingItem?.createdAt),
    garment.id,
  );

  let nextQuoteItems;
  if (editingId && existingItem) {
    nextQuoteItems = state.quoteItems.map((item) => (item.id === editingId ? snapshot : item));
  } else {
    nextQuoteItems = [...state.quoteItems, snapshot];
    state.motion.recentQuoteItemId = snapshot.id;
  }

  state.quoteItems = nextQuoteItems.map((item) => normaliseQuoteItemRecord(item));

  persistActiveQuote();
  renderQuoteSummary();
  renderQuoteMeta();
  renderSavedQuotes();
  resetDraft();
}

function resetDraft() {
  state.quoteDraft = createEmptyQuoteDraft(
    state.positions[0]?.id,
    state.sizes[0]?.id,
    getDefaultCategoryId(),
  );
  refreshDraftPriceFromPricing(true);
  syncGarmentDraftInputs();
  renderQuoteComposer();
  renderGarmentSheetMeta();
  renderGarmentCreatorState();
  renderQuoteSummary();
  closeGarmentSheet();
  closePrintSheet();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function editQuoteItem(itemId) {
  const item = state.quoteItems.find((quoteItem) => quoteItem.id === itemId);
  if (!item) {
    return;
  }
  const garment = getGarmentById(item.garmentId);

  state.quoteDraft = hydrateQuoteDraft(
    {
      quantityMode: item.quantityMode,
      quantity: item.quantity,
      customQuantity: item.customQuantity,
      editingItemId: item.id,
      markupOverride: item.markupOverride,
      garment: {
        sourceId: garment?.id || "",
        categoryId: garment?.categoryId || getDefaultCategoryId(),
        name: garment?.name || "",
        brand: garment?.brand || "",
        code: garment?.code || "",
        costPrice: garment ? garment.costPrice.toFixed(2) : "",
        notes: garment?.notes || "",
      },
      printDraft: {
        positionId: item.prints[0]?.positionId || state.positions[0]?.id || "",
        sizeId: item.prints[0]?.sizeId || state.sizes[0]?.id || "",
        price: item.prints[0]?.price?.toFixed?.(2) || "",
      },
      prints: item.prints.map((printLine) => ({
        id: generateId(),
        positionId: printLine.positionId,
        sizeId: printLine.sizeId,
        price: printLine.price,
      })),
    },
    state.positions,
    state.sizes,
    state.garmentCategories,
    state.garments,
  );

  syncGarmentDraftInputs();
  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  renderQuoteComposer();
  renderQuoteSummary();
  renderQuoteMeta();
  renderSavedQuotes();
  closeQuoteSheet();
  setActivePage("quote");
}

function duplicateQuoteItem(itemId) {
  const itemIndex = state.quoteItems.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) {
    return;
  }

  const duplicatedItem = {
    ...deepClone(state.quoteItems[itemIndex]),
    id: generateId(),
    createdAt: new Date().toISOString(),
  };

  state.quoteItems.splice(itemIndex + 1, 0, duplicatedItem);
  state.motion.recentQuoteItemId = duplicatedItem.id;
  repriceDraftPrintsForQuantity();
  refreshDraftPriceFromPricing(true);
  persistActiveQuote();
  renderQuoteComposer();
  renderQuoteSummary();
  renderQuoteMeta();
  renderSavedQuotes();
}

function requestDeleteDraftPrint(printId) {
  const printLine = state.quoteDraft.prints.find((item) => item.id === printId);
  if (!printLine) {
    return;
  }

  openDeleteDialog({
    title: "Delete print?",
    onConfirm: () => deleteDraftPrint(printId),
  });
}

function deleteDraftPrint(printId) {
  animateRemoval(`[data-draft-print-id="${printId}"]`, () => {
    state.quoteDraft.prints = state.quoteDraft.prints.filter((printLine) => printLine.id !== printId);
    renderDraftPrints();
    renderDraftPreview();
    renderQuoteSummary();
    persistActiveQuote();
    renderQuoteMeta();
    renderSavedQuotes();
  });
}

function requestDeleteQuoteItem(itemId) {
  const item = state.quoteItems.find((quoteItem) => quoteItem.id === itemId);
  if (!item) {
    return;
  }

  openDeleteDialog({
    title: "Delete item?",
    onConfirm: () => deleteQuoteItem(itemId),
  });
}

function deleteQuoteItem(itemId) {
  animateRemoval(`[data-quote-item-id="${itemId}"]`, () => {
    state.quoteItems = state.quoteItems.filter((item) => item.id !== itemId);

    if (state.quoteDraft.editingItemId === itemId) {
      state.quoteDraft.editingItemId = "";
    }

    repriceDraftPrintsForQuantity();
    refreshDraftPriceFromPricing(true);
    persistActiveQuote();
    renderQuoteComposer();
    renderQuoteSummary();
    renderDraftPreview();
    renderQuoteMeta();
    renderSavedQuotes();
  });
}

function createNewQuote() {
  if (isCurrentQuoteEmpty()) {
    resetCurrentQuote();
    setActivePage("quote");
    return;
  }

  const quote = createBlankQuoteRecord();
  state.quotes.unshift(quote);
  state.motion.recentQuoteId = quote.id;
  loadQuoteIntoState(quote);
  persistActiveQuote();
  renderApp();
  setActivePage("quote");
}

function openSavedQuote(quoteId) {
  const quote = state.quotes.find((item) => item.id === quoteId);
  if (!quote) {
    return;
  }

  loadQuoteIntoState(quote);
  persistUiState();
  renderApp();
  setActivePage("quote");
}

function duplicateQuote(quoteId) {
  const originalQuote = state.quotes.find((item) => item.id === quoteId);
  if (!originalQuote) {
    return;
  }

  const duplicate = {
    ...deepClone(originalQuote),
    id: generateId(),
    name: buildDuplicateQuoteName(originalQuote.name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.quotes.unshift(duplicate);
  state.motion.recentQuoteId = duplicate.id;
  loadQuoteIntoState(duplicate);
  persistActiveQuote();
  renderApp();
  setActivePage("quote");
}

function deleteQuote(quoteId) {
  const quote = state.quotes.find((item) => item.id === quoteId);
  if (!quote) {
    return;
  }

  animateRemoval(`[data-saved-quote-id="${quoteId}"]`, () => {
    state.quotes = state.quotes.filter((item) => item.id !== quoteId);

    if (!state.quotes.length) {
      const blankQuote = createBlankQuoteRecord();
      state.quotes = [blankQuote];
      state.motion.recentQuoteId = blankQuote.id;
      loadQuoteIntoState(blankQuote);
    } else if (quoteId === state.activeQuoteId) {
      loadQuoteIntoState(state.quotes[0]);
    }

    persist(STORAGE_KEYS.quotes, state.quotes);
    persistUiState();
    renderApp();
  });
}

function requestDeleteGarmentFromEditor() {
  if (!state.garmentEditorId) {
    return;
  }

  openDeleteDialog({
    title: "Delete garment?",
    onConfirm: () => deleteGarmentFromEditor(),
  });
}

function saveGarmentFromEditor() {
  const garment = createEditorGarmentSnapshot();
  if (!garment.name.trim() || sanitiseNumber(garment.costPrice, 0) <= 0) {
    window.alert("Add a garment name and cost before saving.");
    return;
  }

  upsertGarment(garment, state.garmentEditorId || undefined);
  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  clearGarmentEditor();
  renderCurrentGarmentCard();
  renderGarmentSheetMeta();
  renderDraftPreview();
  renderQuoteSummary();
  renderQuoteMeta();
  renderGarmentLibrary();
  renderGarmentSearchResults();
  renderSavedQuotes();
}

function deleteGarmentFromEditor() {
  if (!state.garmentEditorId) {
    return;
  }

  const deletedId = state.garmentEditorId;
  state.garments = state.garments.filter((garment) => garment.id !== deletedId);
  persist(STORAGE_KEYS.garments, state.garments);

  if (state.quoteDraft.garment.sourceId === deletedId) {
    state.quoteDraft.garment.sourceId = "";
  }

  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  clearGarmentEditor();
  renderCurrentGarmentCard();
  renderGarmentSheetMeta();
  renderDraftPreview();
  renderQuoteSummary();
  renderGarmentLibrary();
  renderGarmentSearchResults();
  renderQuoteMeta();
  renderSavedQuotes();
}

function clearGarmentEditor() {
  state.garmentEditorId = "";
  state.garmentEditorOpen = false;
  syncGarmentEditor();
  renderGarmentEditorState();
}

function toggleGarmentEditorPanel() {
  state.garmentEditorOpen = !state.garmentEditorOpen;

  if (!state.garmentEditorOpen) {
    state.garmentEditorId = "";
    syncGarmentEditor();
  }

  renderGarmentEditorState();
}

function addGarmentCategory() {
  const label = elements.newGarmentCategory.value.trim();
  if (!label) {
    return;
  }

  const idBase = slugify(label) || generateId();
  const id = state.garmentCategories.some((category) => category.id === idBase)
    ? `${idBase}-${state.garmentCategories.length + 1}`
    : idBase;

  state.garmentCategories.push({ id, label });
  state.garmentPickerOpenCategories[id] = false;
  state.garmentLibraryOpenCategories[id] = true;
  persist(STORAGE_KEYS.garmentCategories, state.garmentCategories);
  persistUiState();
  elements.newGarmentCategory.value = "";
  renderCategoryOptions();
  syncGarmentDraftInputs();
  syncGarmentEditor(state.garments.find((garment) => garment.id === state.garmentEditorId) || null);
  renderGarmentCategoryManager();
  renderGarmentSearchResults();
  renderGarmentLibrary();
}

function requestDeleteGarmentCategory(categoryId) {
  const category = getCategoryById(categoryId);
  if (!category || state.garmentCategories.length <= 1) {
    return;
  }

  const replacementCategoryId = state.garmentCategories.find((item) => item.id !== categoryId)?.id;
  if (!replacementCategoryId) {
    return;
  }

  openDeleteDialog({
    title: "Delete category?",
    message: `Garments in this category will move to ${getCategoryLabel(replacementCategoryId)}. This action cannot be undone.`,
    onConfirm: () => deleteGarmentCategory(categoryId),
  });
}

function deleteGarmentCategory(categoryId) {
  const category = getCategoryById(categoryId);
  if (!category || state.garmentCategories.length <= 1) {
    return;
  }

  const replacementCategoryId = state.garmentCategories.find((item) => item.id !== categoryId)?.id;
  if (!replacementCategoryId) {
    return;
  }

  state.garmentCategories = state.garmentCategories.filter((item) => item.id !== categoryId);
  delete state.garmentPickerOpenCategories[categoryId];
  delete state.garmentLibraryOpenCategories[categoryId];

  state.garments = state.garments.map((garment) =>
    garment.categoryId === categoryId ? { ...garment, categoryId: replacementCategoryId } : garment,
  );

  if (state.quoteDraft.garment.categoryId === categoryId) {
    state.quoteDraft.garment.categoryId = replacementCategoryId;
  }

  persist(STORAGE_KEYS.garmentCategories, state.garmentCategories);
  persist(STORAGE_KEYS.garments, state.garments);
  syncActiveQuoteWithLibraries();
  syncGarmentDraftInputs();
  syncGarmentEditor(state.garments.find((garment) => garment.id === state.garmentEditorId) || null);
  renderGarmentCategoryManager();
  renderCurrentGarmentCard();
  renderDraftPreview();
  renderGarmentSearchResults();
  renderGarmentLibrary();
  persistActiveQuote();
  renderQuoteSummary();
  renderQuoteMeta();
  renderSavedQuotes();
}

function savePositionFromSheet() {
  const label = elements.positionEditorName.value.trim();
  if (!label) {
    return;
  }

  if (state.positionEditorId) {
    const position = getPositionById(state.positionEditorId);
    if (!position) {
      return;
    }

    position.label = label;
  } else {
    const idBase = slugify(label) || generateId();
    const id = state.positions.some((position) => position.id === idBase)
      ? `${idBase}-${state.positions.length + 1}`
      : idBase;

    state.positions.push({ id, label });
    state.positionSizeBindings[id] = [];
    state.pricingPositionId = id;
    state.positionEditorId = id;
  }

  state.pricing = hydratePricing(state.pricing, state.positions, state.sizes);
  persist(STORAGE_KEYS.positions, state.positions);
  persist(STORAGE_KEYS.pricing, state.pricing);
  persistPositionSizeBindings();
  ensurePricingManagerSelection();
  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  renderPositionManager();
  renderPrintSheet();
  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  renderPricingManager();
  renderPositionSheetState();
  renderPositionSizesSheetState();
  renderQuoteMeta();
  renderSavedQuotes();
  closePositionSheet();
}

function deletePositionFromSheet() {
  if (!state.positionEditorId || state.positions.length <= 1) {
    return;
  }

  requestDeletePosition(state.positionEditorId);
}

function saveSizeFromSheet() {
  const label = elements.sizeEditorLabel.value.trim();
  if (!label) {
    return;
  }

  if (state.sizeEditorId) {
    const size = getSizeById(state.sizeEditorId);
    if (!size) {
      return;
    }

    size.label = label;
    size.widthMm = sanitiseNumber(elements.sizeEditorWidth.value, 0);
    size.heightMm = sanitiseNumber(elements.sizeEditorHeight.value, 0);
  } else {
    const idBase = slugify(label) || generateId();
    const id = state.sizes.some((size) => size.id === idBase)
      ? `${idBase}-${state.sizes.length + 1}`
      : idBase;

    state.sizes.push({
      id,
      label,
      widthMm: sanitiseNumber(elements.sizeEditorWidth.value, 0),
      heightMm: sanitiseNumber(elements.sizeEditorHeight.value, 0),
    });
    state.sizeEditorId = id;
    state.pricingSizeId = id;
    state.pricingCardSizeId = id;
  }

  state.pricing = hydratePricing(state.pricing, state.positions, state.sizes);
  state.positionSizeBindings = rehydratePositionSizeBindings(state.positionSizeBindings);
  persist(STORAGE_KEYS.sizes, state.sizes);
  persist(STORAGE_KEYS.pricing, state.pricing);
  persistPositionSizeBindings();
  ensurePricingManagerSelection();
  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  renderSizeManager();
  renderPrintSheet();
  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  renderPricingManager();
  renderSizeSheetState();
  renderPositionSizesSheetState();
  renderQuoteMeta();
  renderSavedQuotes();
  closeSizeSheet();
}

function deleteSizeFromSheet() {
  if (!state.sizeEditorId || state.sizes.length <= 1) {
    return;
  }

  requestDeleteSize(state.sizeEditorId);
}

function requestDeletePosition(positionId) {
  const position = getPositionById(positionId);
  if (!position || state.positions.length <= 1) {
    return;
  }

  openDeleteDialog({
    title: "Delete position?",
    onConfirm: () => {
      removePositionById(positionId);
      closePositionSheet();
    },
  });
}

function removePositionById(positionId) {
  const position = getPositionById(positionId);
  if (!position) {
    return;
  }

  state.positions = state.positions.filter((item) => item.id !== positionId);
  delete state.positionSizeBindings[positionId];
  state.quoteDraft.prints = state.quoteDraft.prints.filter(
    (printLine) => printLine.positionId !== positionId,
  );
  state.quoteDraft.printDraft.positionId =
    state.quoteDraft.printDraft.positionId === positionId
      ? state.positions[0]?.id || ""
      : state.quoteDraft.printDraft.positionId;
  state.pricing = hydratePricing(state.pricing, state.positions, state.sizes);
  state.pricingPositionId =
    state.pricingPositionId === positionId ? state.positions[0]?.id || "" : state.pricingPositionId;
  state.positionEditorId = "";
  ensurePricingManagerSelection();
  syncActiveQuoteWithLibraries();
  persist(STORAGE_KEYS.positions, state.positions);
  persist(STORAGE_KEYS.pricing, state.pricing);
  persistPositionSizeBindings();
  persistActiveQuote();
  renderPositionManager();
  renderPrintSheet();
  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  renderPricingManager();
  renderPositionSheetState();
  renderPositionSizesSheetState();
  renderQuoteMeta();
  renderSavedQuotes();
}

function requestDeleteSize(sizeId) {
  const size = getSizeById(sizeId);
  if (!size || state.sizes.length <= 1) {
    return;
  }

  openDeleteDialog({
    title: "Delete size?",
    onConfirm: () => {
      removeSizeById(sizeId);
      closeSizeSheet();
    },
  });
}

function removeSizeById(sizeId) {
  const size = getSizeById(sizeId);
  if (!size) {
    return;
  }

  state.sizes = state.sizes.filter((item) => item.id !== sizeId);
  state.positionSizeBindings = rehydratePositionSizeBindings(state.positionSizeBindings);
  state.quoteDraft.prints = state.quoteDraft.prints.filter((printLine) => printLine.sizeId !== sizeId);
  state.quoteDraft.printDraft.sizeId =
    state.quoteDraft.printDraft.sizeId === sizeId
      ? state.sizes[0]?.id || ""
      : state.quoteDraft.printDraft.sizeId;
  state.pricing = hydratePricing(state.pricing, state.positions, state.sizes);
  state.pricingSizeId = state.pricingSizeId === sizeId ? "" : state.pricingSizeId;
  state.pricingCardSizeId =
    state.pricingCardSizeId === sizeId ? state.sizes[0]?.id || "" : state.pricingCardSizeId;
  state.sizeEditorId = "";
  ensurePricingManagerSelection();
  syncActiveQuoteWithLibraries();
  persist(STORAGE_KEYS.sizes, state.sizes);
  persist(STORAGE_KEYS.pricing, state.pricing);
  persistPositionSizeBindings();
  persistActiveQuote();
  renderSizeManager();
  renderPrintSheet();
  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  renderPricingManager();
  renderSizeSheetState();
  renderPositionSizesSheetState();
  renderQuoteMeta();
  renderSavedQuotes();
}

function saveSettings() {
  const previousSettings = state.settings;
  state.settings = {
    vatRate: sanitiseNumber(elements.settingsVatRate.value, previousSettings.vatRate),
    markupRate: sanitiseNumber(elements.settingsMarkupRate.value, previousSettings.markupRate),
    deliveryServiceName:
      elements.settingsDeliveryServiceName.value.trim() || previousSettings.deliveryServiceName,
    deliveryPricePerBox: sanitiseNumber(
      elements.settingsDeliveryPricePerBox.value,
      previousSettings.deliveryPricePerBox,
    ),
    defaultDeliveryBoxes: Math.max(
      0,
      Math.floor(
        sanitiseNumber(
          elements.settingsDefaultDeliveryBoxes.value,
          previousSettings.defaultDeliveryBoxes,
        ),
      ),
    ),
  };

  state.garments = hydrateGarments(state.garments, state.settings, state.garmentCategories);
  persist(STORAGE_KEYS.settings, state.settings);
  persist(STORAGE_KEYS.garments, state.garments);
  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  syncSettingsForm();
  renderCurrentGarmentCard();
  renderGarmentSheetMeta();
  renderDraftPreview();
  renderGarmentLibrary();
  syncGarmentEditor(createEditorGarmentSnapshot());
  renderQuoteMeta();
  renderQuoteSummary();
  renderSavedQuotes();
}

function loadDemoGarments() {
  const existingKeys = new Set(state.garments.map(createGarmentMatchKey));
  const nextGarments = [...state.garments];
  let addedCount = 0;

  DEFAULT_GARMENTS.forEach((garment) => {
    const matchKey = createGarmentMatchKey(garment);
    if (!matchKey || existingKeys.has(matchKey)) {
      return;
    }

    nextGarments.unshift(createStoredGarmentRecord(garment, garment.id));
    existingKeys.add(matchKey);
    addedCount += 1;
  });

  if (!addedCount) {
    window.alert("All demo garments are already loaded.");
    return;
  }

  state.garments = nextGarments;
  persist(STORAGE_KEYS.garments, state.garments);
  syncActiveQuoteWithLibraries();
  persistActiveQuote();
  state.garmentEditorOpen = false;
  syncGarmentEditor(state.garments.find((garment) => garment.id === state.garmentEditorId) || null);
  renderGarmentEditorState();
  renderGarmentLibrary();
  renderGarmentSearchResults();
  renderCurrentGarmentCard();
  renderGarmentSheetMeta();
  renderDraftPreview();
  renderQuoteSummary();
  renderQuoteMeta();
  renderSavedQuotes();
  window.alert(`Loaded ${addedCount} demo garment${addedCount === 1 ? "" : "s"}.`);
}

function resetCurrentQuote() {
  state.quoteItems = [];
  state.quoteDelivery = createDefaultQuoteDelivery(state.settings);
  state.quoteDraft = createEmptyQuoteDraft(
    state.positions[0]?.id,
    state.sizes[0]?.id,
    getDefaultCategoryId(),
  );
  refreshDraftPriceFromPricing(true);
  syncGarmentDraftInputs();
  persistActiveQuote();
  renderQuoteComposer();
  renderQuoteSummary();
  renderGarmentSheetMeta();
  renderQuoteMeta();
  renderSavedQuotes();
  closeQuoteSheet();
}

function upsertGarment(garment, existingId = garment.id) {
  const nextGarment = createStoredGarmentRecord(garment, existingId);

  const existingIndex = state.garments.findIndex((item) => item.id === nextGarment.id);

  if (existingIndex >= 0) {
    state.garments[existingIndex] = nextGarment;
  } else {
    state.garments.unshift(nextGarment);
  }

  persist(STORAGE_KEYS.garments, state.garments);
  return nextGarment;
}

function createStoredGarmentRecord(garment, existingId = garment.id) {
  return {
    id: existingId || generateId(),
    categoryId: resolveCategoryId(garment.categoryId),
    name: String(garment.name || "").trim(),
    brand: String(garment.brand || "").trim(),
    code: String(garment.code || "").trim(),
    notes: String(garment.notes || "").trim(),
    costPrice: sanitiseNumber(garment.costPrice, 0),
    sellPrice: calculateGarmentSellPrice(garment.costPrice, state.settings),
    updatedAt: new Date().toISOString(),
  };
}

function createGarmentMatchKey(garment) {
  return [garment?.brand, garment?.code, garment?.name]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("::");
}

function buildGarmentPayloadFromQuote() {
  return {
    id: state.quoteDraft.garment.sourceId || "",
    categoryId: state.quoteDraft.garment.categoryId,
    name: state.quoteDraft.garment.name,
    brand: state.quoteDraft.garment.brand,
    code: state.quoteDraft.garment.code,
    notes: state.quoteDraft.garment.notes,
    costPrice: sanitiseNumber(state.quoteDraft.garment.costPrice, 0),
  };
}

function ensureDraftGarmentRecord() {
  const linkedGarment = getGarmentById(state.quoteDraft.garment.sourceId);
  if (linkedGarment) {
    return linkedGarment;
  }

  const garmentPayload = buildGarmentPayloadFromQuote();
  const existingGarment = state.garments.find(
    (garment) => createGarmentMatchKey(garment) === createGarmentMatchKey(garmentPayload),
  );
  const savedGarment = upsertGarment(garmentPayload, existingGarment?.id || undefined);

  state.quoteDraft.garment = {
    sourceId: savedGarment.id,
    categoryId: resolveCategoryId(savedGarment.categoryId),
    name: savedGarment.name,
    brand: savedGarment.brand,
    code: savedGarment.code,
    costPrice: savedGarment.costPrice.toFixed(2),
    notes: savedGarment.notes,
  };

  syncGarmentDraftInputs();
  renderGarmentSearchResults();
  renderGarmentLibrary();

  return savedGarment;
}

function createEditorGarmentSnapshot() {
  return {
    id: state.garmentEditorId || "",
    categoryId: resolveCategoryId(elements.garmentEditorCategory.value),
    name: elements.garmentEditorName.value,
    brand: elements.garmentEditorBrand.value,
    code: elements.garmentEditorCode.value,
    costPrice: elements.garmentEditorCost.value,
    notes: elements.garmentEditorNotes.value,
  };
}

function createDraftPreviewItem() {
  return createQuoteItemSnapshot(
    buildDraftSnapshotSource("preview"),
    {
      positions: state.positions,
      sizes: state.sizes,
      quoteQuantity: getDraftPricingQuoteQuantity(),
    },
    state.settings,
  );
}

function buildDraftSnapshotSource(id, createdAt = null) {
  return {
    ...deepClone(state.quoteDraft),
    id,
    createdAt,
    quantity: getDraftQuantity(),
    customQuantity: isCustomQuantityActive()
      ? String(state.quoteDraft.customQuantity || getDraftQuantity())
      : "",
  };
}

function loadGarmentIntoQuoteDraft(garment) {
  const garmentChanged =
    state.quoteDraft.garment.sourceId !== garment.id ||
    state.quoteDraft.garment.name !== garment.name ||
    state.quoteDraft.garment.code !== garment.code;

  state.quoteDraft.garment = {
    sourceId: garment.id,
    categoryId: resolveCategoryId(garment.categoryId),
    name: garment.name,
    brand: garment.brand,
    code: garment.code,
    costPrice: garment.costPrice.toFixed(2),
    notes: garment.notes,
  };

  if (garmentChanged) {
    state.quoteDraft.prints = [];
  }

  syncGarmentDraftInputs();
  refreshDraftPriceFromPricing(true);
  renderQuoteComposer();
  renderGarmentSheetMeta();
  renderQuoteSummary();
  persistActiveQuote();
  renderQuoteMeta();
  renderSavedQuotes();
}

function validateDraftGarment() {
  if (!state.quoteDraft.garment.name.trim()) {
    window.alert("Choose or enter a garment name first.");
    return false;
  }

  if (sanitiseNumber(state.quoteDraft.garment.costPrice, 0) <= 0) {
    window.alert("Add a garment cost before continuing.");
    return false;
  }

  return true;
}

function hasDraftGarment() {
  return Boolean(state.quoteDraft.garment.name.trim());
}

function hasDraftGarmentPricing() {
  return hasDraftGarment() && sanitiseNumber(state.quoteDraft.garment.costPrice, 0) > 0;
}

function getComputedPrintPrice(positionId, sizeId, quantity) {
  if (!isValidPrintReference(positionId, sizeId)) {
    return 0;
  }

  return lookupPrintPrice(state.pricing, positionId, sizeId, quantity);
}

function refreshDraftPriceFromPricing(force = false) {
  const computedPrice = getComputedPrintPrice(
    state.quoteDraft.printDraft.positionId,
    state.quoteDraft.printDraft.sizeId,
    getDraftPricingQuoteQuantity(),
  );

  if (force || state.quoteDraft.printDraft.price === "") {
    state.quoteDraft.printDraft.price = computedPrice.toFixed(2);
  }
}

function repriceDraftPrintsForQuantity() {
  const quantity = getDraftPricingQuoteQuantity();
  state.quoteDraft.prints = state.quoteDraft.prints.map((printLine) => ({
    ...printLine,
    price: getComputedPrintPrice(printLine.positionId, printLine.sizeId, quantity),
  }));
}

function getFilteredGarments(searchTerm) {
  const query = String(searchTerm || "").trim().toLowerCase();
  const garments = [...state.garments].sort(compareGarments);

  if (!query) {
    return garments;
  }

  return garments.filter((garment) =>
    [
      garment.name,
      garment.brand,
      garment.code,
      garment.notes,
      getCategoryLabel(garment.categoryId),
    ].some((value) => String(value || "").toLowerCase().includes(query)),
  );
}

function getGroupedGarments(searchTerm) {
  const garments = getFilteredGarments(searchTerm);

  return state.garmentCategories
    .map((category) => ({
      category,
      garments: garments.filter((garment) => garment.categoryId === category.id),
    }))
    .filter((group) => group.garments.length > 0);
}

function getGarmentTitle(garment) {
  const title = [garment.brand, garment.code].filter(Boolean).join(" ").trim();
  return title || garment.name || "Garment";
}

function getGarmentSubtitle(garment) {
  if (!garment) {
    return "";
  }

  if (garment.name && garment.name !== getGarmentTitle(garment)) {
    return garment.name;
  }

  return garment.notes || "";
}

function getGarmentById(garmentId) {
  return state.garments.find((garment) => garment.id === garmentId);
}

function getPositionById(positionId) {
  return state.positions.find((position) => position.id === positionId);
}

function getSizeById(sizeId) {
  return state.sizes.find((size) => size.id === sizeId);
}

function getPositionSizeIds(positionId) {
  return Array.isArray(state.positionSizeBindings?.[positionId])
    ? state.positionSizeBindings[positionId]
    : [];
}

function getPricingSizesForPosition(positionId) {
  const attachedSizeIds = getPositionSizeIds(positionId);
  return state.sizes.filter((size) => attachedSizeIds.includes(size.id));
}

function isValidPrintReference(positionId, sizeId) {
  return Boolean(
    getPositionById(positionId) &&
      getSizeById(sizeId) &&
      getPositionSizeIds(positionId).includes(sizeId),
  );
}

function normaliseQuoteItemRecord(item) {
  const quantity = Math.max(1, Math.floor(sanitiseNumber(item?.quantity, 1)));
  const quantityMode =
    item?.quantityMode === "custom" || !QUANTITY_OPTIONS.includes(quantity)
      ? "custom"
      : "preset";

  return {
    id: item?.id || generateId(),
    quantityMode,
    quantity,
    customQuantity: quantityMode === "custom" ? String(item?.customQuantity || quantity) : "",
    garmentId: String(item?.garmentId || "").trim(),
    markupOverride: sanitiseMarkupOverride(item?.markupOverride),
    prints: (item?.prints ?? [])
      .map((printLine) => ({
        id: printLine.id || generateId(),
        positionId: String(printLine.positionId || "").trim(),
        sizeId: String(printLine.sizeId || "").trim(),
      }))
      .filter((printLine) => isValidPrintReference(printLine.positionId, printLine.sizeId)),
    createdAt: item?.createdAt || new Date().toISOString(),
  };
}

function resolveQuoteItemGarment(item) {
  const garment =
    getGarmentById(item?.garmentId) || {
      id: String(item?.garmentId || "").trim(),
      categoryId: getDefaultCategoryId(),
      name: "Missing garment",
      brand: "",
      code: "",
      notes: "Garment removed from library",
      costPrice: 0,
      sellPrice: 0,
    };

  const markupOverride = sanitiseMarkupOverride(item?.markupOverride);
  if (markupOverride === null) {
    return garment;
  }

  return {
    ...garment,
    sellPrice: calculateGarmentSellPrice(garment.costPrice, state.settings, markupOverride),
  };
}

function resolveQuoteItemForDisplay(item) {
  const normalisedItem = normaliseQuoteItemRecord(item);

  return {
    ...normalisedItem,
    garment: resolveQuoteItemGarment(normalisedItem),
    prints: normalisedItem.prints.map((printLine) => {
      const position = getPositionById(printLine.positionId);
      const size = getSizeById(printLine.sizeId);

      return {
        ...printLine,
        positionLabel: position?.label || "Custom position",
        sizeLabel: size?.label || "Custom size",
        sizeDimensions: size ? formatDimensions(size) : "",
      };
    }),
  };
}

function syncQuoteDraftGarmentFromLibrary() {
  const sourceId = String(state.quoteDraft?.garment?.sourceId || "").trim();
  if (!sourceId) {
    state.quoteDraft.garment.categoryId = resolveCategoryId(state.quoteDraft.garment.categoryId);
    return;
  }

  const garment = getGarmentById(sourceId);
  if (!garment) {
    state.quoteDraft.garment.sourceId = "";
    state.quoteDraft.garment.categoryId = resolveCategoryId(state.quoteDraft.garment.categoryId);
    return;
  }

  state.quoteDraft.garment = {
    sourceId: garment.id,
    categoryId: resolveCategoryId(garment.categoryId),
    name: garment.name,
    brand: garment.brand,
    code: garment.code,
    costPrice: garment.costPrice.toFixed(2),
    notes: garment.notes,
  };
}

function ensurePricingManagerSelection() {
  state.pricingPositionId =
    getPositionById(state.pricingPositionId)?.id || state.positions[0]?.id || "";

  const attachedSizeIds = getPositionSizeIds(state.pricingPositionId);
  if (!attachedSizeIds.length) {
    state.pricingSizeId = "";
    state.pricingCardSizeId = "";
    return;
  }

  if (!attachedSizeIds.includes(state.pricingSizeId)) {
    state.pricingSizeId = attachedSizeIds[0];
  }

  state.pricingCardSizeId = state.pricingSizeId;
}

function rehydratePositionSizeBindings(bindings) {
  return state.positions.reduce((result, position) => {
    result[position.id] = getPositionSizeIdsFromSource(bindings?.[position.id], state.sizes);
    return result;
  }, {});
}

function getPositionSizeIdsFromSource(sourceSizeIds, sizes) {
  const validSizeIds = new Set(sizes.map((size) => size.id));
  const nextSizeIds = Array.isArray(sourceSizeIds) ? sourceSizeIds : [];
  return nextSizeIds.filter(
    (sizeId, index) => validSizeIds.has(sizeId) && nextSizeIds.indexOf(sizeId) === index,
  );
}

function persistPositionSizeBindings() {
  persist(STORAGE_KEYS.positionSizeBindings, state.positionSizeBindings);
}

function togglePositionSizeBinding(positionId, sizeId) {
  const currentSizeIds = getPositionSizeIds(positionId);
  const nextSizeIds = currentSizeIds.includes(sizeId)
    ? currentSizeIds.filter((id) => id !== sizeId)
    : [...currentSizeIds, sizeId];

  state.positionSizeBindings[positionId] = nextSizeIds;
  ensurePricingManagerSelection();
  syncActiveQuoteWithLibraries();
  persistPositionSizeBindings();
  persistUiState();
  renderPricingManager();
  renderPositionSizesSheetState();
  renderPrintSheet();
  renderDraftPrints();
  renderDraftPreview();
  renderQuoteSummary();
  renderQuoteMeta();
  persistActiveQuote();
  renderSavedQuotes();
}

function getCategoryById(categoryId) {
  return state.garmentCategories.find((category) => category.id === categoryId);
}

function getCategoryLabel(categoryId) {
  return getCategoryById(categoryId)?.label || "";
}

function getDefaultCategoryId() {
  return state.garmentCategories[0]?.id || "";
}

function resolveCategoryId(categoryId) {
  return getCategoryById(categoryId)?.id || getDefaultCategoryId();
}

function getDraftQuantity() {
  if (isCustomQuantityActive()) {
    const customQuantity = sanitiseNumber(state.quoteDraft.customQuantity, Number.NaN);
    if (Number.isFinite(customQuantity) && customQuantity > 0) {
      return Math.max(1, Math.floor(customQuantity));
    }
  }

  return Math.max(1, Math.floor(sanitiseNumber(state.quoteDraft.quantity, QUANTITY_OPTIONS[1])));
}

function isCustomQuantityActive() {
  return (
    state.quoteDraft.quantityMode === "custom" ||
    !QUANTITY_OPTIONS.includes(sanitiseNumber(state.quoteDraft.quantity, 0))
  );
}

function syncActiveQuoteWithLibraries() {
  if (!state.quoteDraft?.printDraft) {
    state.quoteDraft = createEmptyQuoteDraft(
      state.positions[0]?.id,
      state.sizes[0]?.id,
      getDefaultCategoryId(),
    );
  }

  syncQuoteDraftGarmentFromLibrary();
  state.quoteItems = state.quoteItems.map((item) => normaliseQuoteItemRecord(item));
  state.quoteDraft.prints = (state.quoteDraft.prints ?? [])
    .map((printLine) => ({
      id: printLine.id || generateId(),
      positionId: String(printLine.positionId || "").trim(),
      sizeId: String(printLine.sizeId || "").trim(),
      price: sanitiseNumber(printLine.price, 0),
    }))
    .filter((printLine) => isValidPrintReference(printLine.positionId, printLine.sizeId));
  ensureDraftSelections();
  repriceDraftPrintsForQuantity();
  refreshDraftPriceFromPricing(true);
}

function ensureDraftSelections() {
  if (!state.quoteDraft?.printDraft) {
    state.quoteDraft = createEmptyQuoteDraft(
      state.positions[0]?.id,
      state.sizes[0]?.id,
      getDefaultCategoryId(),
    );
  }

  state.quoteDraft.garment.categoryId = resolveCategoryId(state.quoteDraft.garment.categoryId);

  if (!state.positions.some((position) => position.id === state.quoteDraft.printDraft.positionId)) {
    state.quoteDraft.printDraft.positionId = state.positions[0]?.id || "";
  }

  const availableSizeIds = getPositionSizeIds(state.quoteDraft.printDraft.positionId);
  if (!availableSizeIds.includes(state.quoteDraft.printDraft.sizeId)) {
    state.quoteDraft.printDraft.sizeId = availableSizeIds[0] || "";
  }

  const computedPrice = getComputedPrintPrice(
    state.quoteDraft.printDraft.positionId,
    state.quoteDraft.printDraft.sizeId,
    getDraftPricingQuoteQuantity(),
  );
  if (state.quoteDraft.printDraft.price === "" || !state.quoteDraft.printDraft.sizeId) {
    state.quoteDraft.printDraft.price = computedPrice.toFixed(2);
  }
}

function createBlankQuoteRecord() {
  const timestamp = new Date().toISOString();

  return {
    id: generateId(),
    name: "",
    quoteItems: [],
    delivery: createDefaultQuoteDelivery(state.settings),
    quoteDraft: createEmptyQuoteDraft(
      state.positions[0]?.id,
      state.sizes[0]?.id,
      getDefaultCategoryId(),
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function loadQuoteIntoState(quote) {
  state.activeQuoteId = quote.id;
  state.quoteName = quote.name || "";
  state.quoteNameDraft = state.quoteName;
  state.quoteItems = hydrateQuoteItems(
    deepClone(quote.quoteItems),
    state.positions,
    state.sizes,
    state.garments,
  );
  state.quoteDelivery = hydrateQuoteDelivery(deepClone(quote.delivery), state.settings);
  state.quoteDraft = hydrateQuoteDraft(
    deepClone(quote.quoteDraft),
    state.positions,
    state.sizes,
    state.garmentCategories,
    state.garments,
  );
  state.quoteCreatedAt = quote.createdAt || new Date().toISOString();
  state.quoteUpdatedAt = quote.updatedAt || state.quoteCreatedAt;
  syncActiveQuoteWithLibraries();
  syncQuoteMetaInputs();
  syncGarmentDraftInputs();
}

function createPersistedQuoteDraft() {
  const linkedGarment = getGarmentById(state.quoteDraft.garment.sourceId);

  return {
    ...deepClone(state.quoteDraft),
    garment: linkedGarment
      ? { sourceId: linkedGarment.id }
      : {
          sourceId: "",
          categoryId: resolveCategoryId(state.quoteDraft.garment.categoryId),
          name: state.quoteDraft.garment.name,
          brand: state.quoteDraft.garment.brand,
          code: state.quoteDraft.garment.code,
          costPrice: state.quoteDraft.garment.costPrice,
          notes: state.quoteDraft.garment.notes,
        },
    prints: (state.quoteDraft.prints ?? []).map((printLine) => ({
      id: printLine.id,
      positionId: printLine.positionId,
      sizeId: printLine.sizeId,
      price: sanitiseNumber(printLine.price, 0),
    })),
  };
}

function persistUiState() {
  persist(STORAGE_KEYS.uiState, {
    activePage: state.activePage,
    activeQuoteId: state.activeQuoteId,
    pricingPositionId: state.pricingPositionId,
    pricingSizeId: state.pricingSizeId,
    pricingCardSizeId: state.pricingCardSizeId,
    garmentPickerOpenCategories: state.garmentPickerOpenCategories,
    garmentLibraryOpenCategories: state.garmentLibraryOpenCategories,
  });
}

function persistActiveQuote() {
  syncActiveQuoteWithLibraries();
  const now = new Date().toISOString();
  const record = {
    id: state.activeQuoteId || generateId(),
    name: state.quoteName.trim(),
    quoteItems: deepClone(state.quoteItems),
    delivery: deepClone(state.quoteDelivery),
    quoteDraft: createPersistedQuoteDraft(),
    createdAt: state.quoteCreatedAt || now,
    updatedAt: now,
  };

  state.activeQuoteId = record.id;
  state.quoteCreatedAt = record.createdAt;
  state.quoteUpdatedAt = record.updatedAt;

  state.quotes = [record, ...state.quotes.filter((quote) => quote.id !== record.id)].sort(
    (left, right) => new Date(right.updatedAt) - new Date(left.updatedAt),
  );

  persist(STORAGE_KEYS.quotes, state.quotes);
  persistUiState();
}

function compareGarments(left, right) {
  const leftCategoryIndex = state.garmentCategories.findIndex(
    (category) => category.id === left.categoryId,
  );
  const rightCategoryIndex = state.garmentCategories.findIndex(
    (category) => category.id === right.categoryId,
  );
  const categoryDifference = leftCategoryIndex - rightCategoryIndex;

  if (categoryDifference !== 0) {
    return categoryDifference;
  }

  return getGarmentTitle(left).localeCompare(getGarmentTitle(right), "en-GB");
}

function isCurrentQuoteEmpty() {
  return (
    !state.quoteName.trim() &&
    !state.quoteNameDraft.trim() &&
    state.quoteItems.length === 0 &&
    !hasDraftGarment() &&
    state.quoteDraft.prints.length === 0
  );
}

function getCurrentQuoteTotals() {
  return calculateQuoteTotals(getQuoteItemsForDisplay(), state.quoteDelivery);
}

function getQuoteItemsForDisplay() {
  if (!state.quoteDraft.editingItemId || !hasDraftGarmentPricing()) {
    return applyQuotePrintPricing(
      state.quoteItems.map((item) => resolveQuoteItemForDisplay(item)),
      state.pricing,
    );
  }

  const editingItem = state.quoteItems.find((item) => item.id === state.quoteDraft.editingItemId);
  if (!editingItem) {
    return applyQuotePrintPricing(
      state.quoteItems.map((item) => resolveQuoteItemForDisplay(item)),
      state.pricing,
    );
  }

  const draftSnapshot = createQuoteItemSnapshot(
    buildDraftSnapshotSource(editingItem.id, editingItem.createdAt),
    {
      positions: state.positions,
      sizes: state.sizes,
      quoteQuantity: getProjectedQuoteQuantityForPersist(),
    },
    state.settings,
  );

  return applyQuotePrintPricing(
    state.quoteItems.map((item) =>
      item.id === editingItem.id ? draftSnapshot : resolveQuoteItemForDisplay(item),
    ),
    state.pricing,
  );
}

function getDraftPricingQuoteQuantity() {
  const savedQuoteQuantity = calculateQuoteQuantity(state.quoteItems);

  if (!hasDraftGarmentPricing()) {
    return savedQuoteQuantity;
  }

  const draftQuantity = getDraftQuantity();

  if (state.quoteDraft.editingItemId) {
    return calculateQuoteQuantity(
      state.quoteItems.map((item) =>
        item.id === state.quoteDraft.editingItemId ? { ...item, quantity: draftQuantity } : item,
      ),
    );
  }

  return savedQuoteQuantity + draftQuantity;
}

function getProjectedQuoteQuantityForPersist() {
  const draftQuantity = getDraftQuantity();

  if (state.quoteDraft.editingItemId) {
    return calculateQuoteQuantity(
      state.quoteItems.map((item) =>
        item.id === state.quoteDraft.editingItemId ? { ...item, quantity: draftQuantity } : item,
      ),
    );
  }

  return calculateQuoteQuantity([...state.quoteItems, { quantity: draftQuantity }]);
}

function getActivePrintPricingBracket() {
  const quantity = hasDraftGarmentPricing()
    ? getDraftPricingQuoteQuantity()
    : getCurrentQuoteTotals().quoteQuantity;
  return resolveQuantityBracket(quantity);
}

function getQuoteDeliveryBoxes() {
  return resolveDeliveryBoxes(state.quoteDelivery);
}

function formatBoxCount(boxes) {
  return `${boxes} ${boxes === 1 ? "box" : "boxes"}`;
}

function formatGarmentCount(count) {
  return `${count} garment${count === 1 ? "" : "s"}`;
}

function formatProductTypeCount(count) {
  return `${count} product type${count === 1 ? "" : "s"}`;
}

function formatPrintBracketLabel(bracket) {
  return `${bracket}+`;
}

function getQuoteDisplayName(name) {
  return String(name || "").trim() || "Untitled quote";
}

function hasSavedQuoteName() {
  return Boolean(String(state.quoteName || "").trim());
}

function canBuildQuoteItems() {
  return hasSavedQuoteName();
}

function buildDuplicateQuoteName(name) {
  const baseName = String(name || "").trim();
  return baseName ? `${baseName} copy` : "Quote copy";
}

function getStoredActiveQuote(quotes, activeQuoteId) {
  return quotes.find((quote) => quote.id === activeQuoteId) || quotes[0];
}

function buildCategoryOpenState(categories, storedState) {
  return categories.reduce((result, category) => {
    result[category.id] =
      typeof storedState?.[category.id] === "boolean" ? storedState[category.id] : false;
    return result;
  }, {});
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    elements.installButton.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    elements.installButton.hidden = true;
  });
}

async function installApp() {
  if (!state.deferredPrompt) {
    return;
  }

  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  elements.installButton.hidden = true;
}
