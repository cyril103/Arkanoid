import { ENEMY_LIBRARY, GAME_CONFIG } from "./config.js";
import {
  COMMON_BRICK_TOKENS,
  DEFAULT_LEVEL_ENEMY_TYPE,
  LEVEL_CELL_LIBRARY,
  buildBrickPlacements,
  clearLevelOverrides,
  createEmptyLayout,
  getLevelColumns,
  getLevelOverrides,
  loadLevels,
  normalizeEnemyType,
  normalizeLevelCollection,
  resizeLayout,
  serializeLevels,
  setLevelOverrides
} from "./levels.js";
import { loadSprites } from "./sprites.js";
import { getResolvedSpriteManifest } from "./spriteHooks.js";

const PALETTE_ORDER = Object.freeze(["empty", ...COMMON_BRICK_TOKENS, "silver", "gold"]);
const PREVIEW_SPRITE_KEYS = Object.freeze([
  "frameTop",
  "frameLeft",
  "frameRight",
  ...PALETTE_ORDER
    .map((key) => LEVEL_CELL_LIBRARY[key]?.spriteKey)
    .filter(Boolean)
]);

const CELL_COLORS = Object.freeze({
  empty: "rgba(255, 255, 255, 0.04)",
  blue: "#2e8bff",
  orange: "#ff9640",
  green: "#45d483",
  red: "#f85c60",
  white: "#d7deef",
  yellow: "#ffd84f",
  pink: "#ff7eb3",
  cyan: "#43d9ff",
  silver: "#a4b4cb",
  gold: "#e9b83f"
});

const state = {
  levels: [],
  selectedLevelIndex: 0,
  selectedCellType: "blue",
  isPainting: false,
  previewSprites: null,
  sourceLabel: "Chargement…"
};

const elements = {
  levelSelect: document.getElementById("level-select"),
  levelIdInput: document.getElementById("level-id-input"),
  levelNameInput: document.getElementById("level-name-input"),
  levelEnemySelect: document.getElementById("level-enemy-select"),
  rowsInput: document.getElementById("rows-input"),
  columnsInput: document.getElementById("columns-input"),
  gridSizeLabel: document.getElementById("grid-size-label"),
  selectionLabel: document.getElementById("selection-label"),
  sourceBadge: document.getElementById("editor-source-badge"),
  status: document.getElementById("editor-status"),
  summary: document.getElementById("level-summary"),
  grid: document.getElementById("editor-grid"),
  palette: document.getElementById("palette-grid"),
  previewCanvas: document.getElementById("preview-canvas"),
  jsonOutput: document.getElementById("json-output"),
  newLevelButton: document.getElementById("new-level-button"),
  duplicateLevelButton: document.getElementById("duplicate-level-button"),
  deleteLevelButton: document.getElementById("delete-level-button"),
  resizeGridButton: document.getElementById("resize-grid-button"),
  clearGridButton: document.getElementById("clear-grid-button"),
  applyOverridesButton: document.getElementById("apply-overrides-button"),
  resetOverridesButton: document.getElementById("reset-overrides-button"),
  copyJsonButton: document.getElementById("copy-json-button"),
  downloadJsonButton: document.getElementById("download-json-button"),
  importJsonButton: document.getElementById("import-json-button")
};

bootstrap().catch((error) => {
  console.error("Initialisation de l'éditeur impossible", error);
  setStatus("Erreur d'initialisation", true);
});

async function bootstrap() {
  bindEvents();

  const overrides = getLevelOverrides();
  state.levels = await loadLevels();
  state.sourceLabel = overrides ? "Override local actif" : "Fichier source";
  syncSelectionFromUrl();
  state.previewSprites = await loadPreviewSprites();

  renderAll();
  setStatus("Éditeur prêt");
}

function bindEvents() {
  elements.levelSelect.addEventListener("change", () => {
    state.selectedLevelIndex = Number.parseInt(elements.levelSelect.value, 10) || 0;
    renderAll();
  });

  elements.levelIdInput.addEventListener("input", () => {
    getCurrentLevel().id = slugify(elements.levelIdInput.value, state.selectedLevelIndex);
    syncDerivedState();
    elements.levelIdInput.value = getCurrentLevel().id;
    renderLevelOptions();
    renderJson();
  });

  elements.levelNameInput.addEventListener("input", () => {
    getCurrentLevel().name = elements.levelNameInput.value.trim() || `Niveau ${state.selectedLevelIndex + 1}`;
    syncDerivedState();
    renderLevelOptions();
    renderJson();
  });

  elements.levelEnemySelect.addEventListener("change", () => {
    getCurrentLevel().enemyType = normalizeEnemyType(elements.levelEnemySelect.value);
    renderJson();
    setStatus("Type d'ennemi du niveau mis à jour");
  });

  elements.newLevelButton.addEventListener("click", () => {
    const currentLevel = getCurrentLevel();
    const rows = currentLevel?.layout.length ?? 5;
    const columns = getLevelColumns(currentLevel?.layout ?? []) || 12;
    const nextIndex = state.selectedLevelIndex + 1;
    const level = {
      id: createUniqueId("new-level"),
      name: `Nouveau niveau ${state.levels.length + 1}`,
      enemyType: currentLevel?.enemyType ?? DEFAULT_LEVEL_ENEMY_TYPE,
      layout: createEmptyLayout(rows, columns)
    };

    state.levels.splice(nextIndex, 0, level);
    state.selectedLevelIndex = nextIndex;
    renderAll();
    setStatus("Nouveau niveau créé");
  });

  elements.duplicateLevelButton.addEventListener("click", () => {
    const currentLevel = getCurrentLevel();
    const copy = {
      id: createUniqueId(`${currentLevel.id}-copy`),
      name: `${currentLevel.name} copie`,
      enemyType: currentLevel.enemyType,
      layout: currentLevel.layout.map((row) => [...row])
    };

    state.levels.splice(state.selectedLevelIndex + 1, 0, copy);
    state.selectedLevelIndex += 1;
    renderAll();
    setStatus("Niveau dupliqué");
  });

  elements.deleteLevelButton.addEventListener("click", () => {
    if (state.levels.length === 1) {
      state.levels[0] = {
        id: "level-1",
        name: "Niveau 1",
        enemyType: DEFAULT_LEVEL_ENEMY_TYPE,
        layout: createEmptyLayout(5, 12)
      };
      state.selectedLevelIndex = 0;
      renderAll();
      setStatus("Le dernier niveau a été réinitialisé");
      return;
    }

    state.levels.splice(state.selectedLevelIndex, 1);
    state.selectedLevelIndex = Math.max(0, state.selectedLevelIndex - 1);
    renderAll();
    setStatus("Niveau supprimé");
  });

  elements.resizeGridButton.addEventListener("click", () => {
    const currentLevel = getCurrentLevel();
    currentLevel.layout = resizeLayout(
      currentLevel.layout,
      elements.rowsInput.value,
      elements.columnsInput.value
    );
    renderAll();
    setStatus("Grille redimensionnée");
  });

  elements.clearGridButton.addEventListener("click", () => {
    const currentLevel = getCurrentLevel();
    const rows = currentLevel.layout.length;
    const columns = getLevelColumns(currentLevel.layout) || 1;
    currentLevel.layout = createEmptyLayout(rows, columns);
    renderAll();
    setStatus("Grille vidée");
  });

  elements.applyOverridesButton.addEventListener("click", () => {
    state.levels = setLevelOverrides(state.levels);
    state.sourceLabel = "Override local actif";
    renderSourceBadge();
    renderJson();
    setStatus("Override sauvegardé pour le jeu");
  });

  elements.resetOverridesButton.addEventListener("click", async () => {
    clearLevelOverrides();
    state.levels = await loadLevels({ forceRefresh: true, ignoreOverrides: true });
    state.selectedLevelIndex = 0;
    state.sourceLabel = "Fichier source";
    renderAll();
    setStatus("Override retiré, source rechargée");
  });

  elements.copyJsonButton.addEventListener("click", async () => {
    renderJson();
    try {
      await navigator.clipboard.writeText(elements.jsonOutput.value);
      setStatus("JSON copié dans le presse-papiers");
    } catch (error) {
      console.warn("Copie impossible", error);
      setStatus("Copie impossible dans ce navigateur", true);
    }
  });

  elements.downloadJsonButton.addEventListener("click", () => {
    renderJson();
    const blob = new Blob([elements.jsonOutput.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "levels.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Export JSON téléchargé");
  });

  elements.importJsonButton.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(elements.jsonOutput.value);
      state.levels = normalizeLevelCollection(parsed).levels;
      state.selectedLevelIndex = 0;
      renderAll();
      setStatus("JSON importé dans l'éditeur");
    } catch (error) {
      console.warn("Import JSON invalide", error);
      setStatus("JSON invalide", true);
    }
  });

  window.addEventListener("mouseup", () => {
    state.isPainting = false;
  });

  elements.grid.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

function renderAll() {
  syncDerivedState();
  renderSourceBadge();
  renderLevelOptions();
  renderFields();
  renderPalette();
  renderGrid();
  renderPreview();
  renderJson();
}

function syncSelectionFromUrl() {
  const params = new URLSearchParams(globalThis.location.search);
  const requestedLevel = params.get("level");

  if (!requestedLevel) {
    return;
  }

  const requestedValue = requestedLevel.trim().toLowerCase();
  const index = state.levels.findIndex((level, levelIndex) => (
    level.id.toLowerCase() === requestedValue || String(levelIndex + 1) === requestedValue
  ));

  if (index >= 0) {
    state.selectedLevelIndex = index;
  }
}

function syncDerivedState() {
  state.selectedLevelIndex = clampIndex(state.selectedLevelIndex, state.levels.length);
  const currentLevel = getCurrentLevel();
  currentLevel.id = slugify(currentLevel.id, state.selectedLevelIndex);
  currentLevel.name = currentLevel.name?.trim() || `Niveau ${state.selectedLevelIndex + 1}`;
  currentLevel.enemyType = normalizeEnemyType(currentLevel.enemyType);
}

function renderSourceBadge() {
  elements.sourceBadge.textContent = state.sourceLabel;
}

function renderLevelOptions() {
  elements.levelSelect.innerHTML = "";

  state.levels.forEach((level, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index + 1}. ${level.name}`;
    option.selected = index === state.selectedLevelIndex;
    elements.levelSelect.append(option);
  });
}

function renderFields() {
  const currentLevel = getCurrentLevel();
  const rows = currentLevel.layout.length;
  const columns = getLevelColumns(currentLevel.layout);
  const summary = summarizeLevel(currentLevel.layout);

  elements.levelIdInput.value = currentLevel.id;
  elements.levelNameInput.value = currentLevel.name;
  elements.levelEnemySelect.innerHTML = "";
  for (const [type, definition] of Object.entries(ENEMY_LIBRARY)) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = definition.label ?? type;
    option.selected = type === currentLevel.enemyType;
    elements.levelEnemySelect.append(option);
  }
  elements.rowsInput.value = String(rows);
  elements.columnsInput.value = String(columns);
  elements.gridSizeLabel.textContent = `${rows} x ${columns}`;
  elements.summary.textContent = `${summary.breakable} destructibles, ${summary.gold} or, ${summary.empty} vides`;
  elements.selectionLabel.textContent = `Sélection : ${LEVEL_CELL_LIBRARY[state.selectedCellType].label}`;
}

function renderPalette() {
  elements.palette.innerHTML = "";

  for (const key of PALETTE_ORDER) {
    const definition = LEVEL_CELL_LIBRARY[key];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-button${state.selectedCellType === key ? " is-active" : ""}`;
    button.innerHTML = `
      <span class="palette-button__swatch"></span>
      <span class="palette-button__label">${definition.label}</span>
    `;

    const swatch = button.querySelector(".palette-button__swatch");
    swatch.style.background = CELL_COLORS[key];

    button.addEventListener("click", () => {
      state.selectedCellType = key;
      renderPalette();
      renderFields();
    });

    elements.palette.append(button);
  }
}

function renderGrid() {
  const currentLevel = getCurrentLevel();
  const columns = getLevelColumns(currentLevel.layout);
  elements.grid.innerHTML = "";
  elements.grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

  currentLevel.layout.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editor-grid__cell";
      button.style.background = CELL_COLORS[cell ?? "empty"];
      button.title = getCellLabel(cell) || "Vide";
      button.setAttribute("aria-label", `Case ${rowIndex + 1}-${columnIndex + 1}: ${button.title}`);

      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        state.isPainting = true;
        paintCell(rowIndex, columnIndex, event.button === 2 ? null : LEVEL_CELL_LIBRARY[state.selectedCellType].token);
      });

      button.addEventListener("mouseenter", (event) => {
        if (!state.isPainting) {
          return;
        }

        paintCell(rowIndex, columnIndex, event.buttons === 2 ? null : LEVEL_CELL_LIBRARY[state.selectedCellType].token);
      });

      elements.grid.append(button);
    });
  });
}

function paintCell(rowIndex, columnIndex, token) {
  const currentLevel = getCurrentLevel();
  currentLevel.layout[rowIndex][columnIndex] = token;
  renderGrid();
  renderPreview();
  renderJson();
  renderFields();
}

function renderPreview() {
  const ctx = elements.previewCanvas.getContext("2d");
  const currentLevel = getCurrentLevel();

  elements.previewCanvas.width = GAME_CONFIG.canvasWidth;
  elements.previewCanvas.height = GAME_CONFIG.canvasHeight;

  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.canvasHeight);
  gradient.addColorStop(0, "#05090f");
  gradient.addColorStop(1, "#02040b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);

  ctx.fillStyle = "#010306";
  ctx.fillRect(
    GAME_CONFIG.playfield.left,
    GAME_CONFIG.playfield.top,
    GAME_CONFIG.playfield.width,
    GAME_CONFIG.frame.height - GAME_CONFIG.frame.topThickness
  );

  drawSpriteOrFallback(ctx, state.previewSprites?.frameTop, {
    x: GAME_CONFIG.playfield.left,
    y: GAME_CONFIG.frame.y,
    width: GAME_CONFIG.playfield.width,
    height: GAME_CONFIG.frame.topThickness
  }, "#b6bcc7");

  drawSpriteOrFallback(ctx, state.previewSprites?.frameLeft, {
    x: GAME_CONFIG.frame.x,
    y: GAME_CONFIG.frame.y,
    width: GAME_CONFIG.frame.wallThickness,
    height: GAME_CONFIG.frame.height
  }, "#a6afbb");

  drawSpriteOrFallback(ctx, state.previewSprites?.frameRight, {
    x: GAME_CONFIG.frame.x + GAME_CONFIG.frame.width - GAME_CONFIG.frame.wallThickness,
    y: GAME_CONFIG.frame.y,
    width: GAME_CONFIG.frame.wallThickness,
    height: GAME_CONFIG.frame.height
  }, "#a6afbb");

  for (const placement of buildBrickPlacements(currentLevel.layout)) {
    drawSpriteOrFallback(
      ctx,
      state.previewSprites?.[placement.definition.spriteKey],
      placement,
      CELL_COLORS[getCellTokenFromSpriteKey(placement.definition.spriteKey)]
    );
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.font = '600 18px "Trebuchet MS", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(currentLevel.name, GAME_CONFIG.playfield.left + 12, 58);
}

function drawSpriteOrFallback(ctx, sprite, bounds, fallbackColor) {
  if (sprite?.image) {
    ctx.drawImage(sprite.image, bounds.x, bounds.y, bounds.width, bounds.height);
    return;
  }

  ctx.fillStyle = fallbackColor;
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
}

function renderJson() {
  elements.jsonOutput.value = serializeLevels(state.levels);
}

function getCurrentLevel() {
  return state.levels[state.selectedLevelIndex];
}

function getCellLabel(token) {
  if (!token) {
    return "Vide";
  }

  const entry = Object.values(LEVEL_CELL_LIBRARY).find((item) => item.token === token);
  return entry ? entry.label : "Vide";
}

function summarizeLevel(layout) {
  let breakable = 0;
  let gold = 0;
  let empty = 0;

  for (const row of layout) {
    for (const cell of row) {
      if (!cell) {
        empty += 1;
      } else if (cell === "gold") {
        gold += 1;
      } else {
        breakable += 1;
      }
    }
  }

  return { breakable, gold, empty };
}

function slugify(value, index) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `level-${index + 1}`;
}

function clampIndex(index, length) {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0));
}

function createUniqueId(baseId) {
  let candidate = slugify(baseId, state.levels.length);
  let suffix = 2;

  while (state.levels.some((level) => level.id === candidate)) {
    candidate = `${slugify(baseId, state.levels.length)}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function loadPreviewSprites() {
  const manifest = getResolvedSpriteManifest();
  const previewManifest = Object.fromEntries(
    PREVIEW_SPRITE_KEYS
      .map((key) => [key, manifest[key]])
      .filter(([, sprite]) => Boolean(sprite))
  );

  return loadSprites(previewManifest);
}

function getCellTokenFromSpriteKey(spriteKey) {
  for (const [key, value] of Object.entries(LEVEL_CELL_LIBRARY)) {
    if (value.spriteKey === spriteKey) {
      return key;
    }
  }

  return "empty";
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#ffb0b0" : "";
}
