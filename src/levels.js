import { GAME_CONFIG } from "./config.js";

export const LEVEL_FILE_VERSION = 2;
export const LEVEL_STORAGE_KEY = "arkanoid.customLevels";

export const COMMON_BRICK_TOKENS = Object.freeze([
  "blue",
  "orange",
  "green",
  "red",
  "white",
  "yellow",
  "pink",
  "cyan"
]);

export const LEVEL_CELL_LIBRARY = Object.freeze({
  empty: Object.freeze({
    token: null,
    label: "Vide",
    spriteKey: null,
    type: null,
    hits: 0,
    points: 0
  }),
  blue: Object.freeze({
    token: "blue",
    label: "Bleue",
    spriteKey: "brickBlue",
    type: "common",
    hits: 1,
    points: 100
  }),
  orange: Object.freeze({
    token: "orange",
    label: "Orange",
    spriteKey: "brickOrange",
    type: "common",
    hits: 1,
    points: 100
  }),
  green: Object.freeze({
    token: "green",
    label: "Verte",
    spriteKey: "brickGreen",
    type: "common",
    hits: 1,
    points: 100
  }),
  red: Object.freeze({
    token: "red",
    label: "Rouge",
    spriteKey: "brickRed",
    type: "common",
    hits: 1,
    points: 100
  }),
  white: Object.freeze({
    token: "white",
    label: "Blanche",
    spriteKey: "brickWhite",
    type: "common",
    hits: 1,
    points: 100
  }),
  yellow: Object.freeze({
    token: "yellow",
    label: "Jaune",
    spriteKey: "brickYellow",
    type: "common",
    hits: 1,
    points: 100
  }),
  pink: Object.freeze({
    token: "pink",
    label: "Rose",
    spriteKey: "brickPink",
    type: "common",
    hits: 1,
    points: 100
  }),
  cyan: Object.freeze({
    token: "cyan",
    label: "Cyan",
    spriteKey: "brickCyan",
    type: "common",
    hits: 1,
    points: 100
  }),
  silver: Object.freeze({
    token: "silver",
    label: "Argent",
    spriteKey: "brickSilverBase",
    type: "hard",
    hits: 2,
    points: 250
  }),
  gold: Object.freeze({
    token: "gold",
    label: "Or",
    spriteKey: "brickGold",
    type: "gold",
    hits: Number.POSITIVE_INFINITY,
    points: 0,
    indestructible: true
  })
});

const FALLBACK_LEVEL_DATA = Object.freeze({
  version: LEVEL_FILE_VERSION,
  levels: Object.freeze([
    Object.freeze({
      id: "opening-volley",
      name: "Ouverture",
      layout: Object.freeze([
        Object.freeze([null, null, "blue", "blue", "silver", "silver", "silver", "silver", "blue", "blue", null, null]),
        Object.freeze([null, "orange", "orange", "orange", "orange", "gold", "gold", "orange", "orange", "orange", "orange", null]),
        Object.freeze(["green", "green", "silver", "silver", "green", "green", "green", "green", "silver", "silver", "green", "green"]),
        Object.freeze(["red", "silver", "red", "red", "red", null, null, "red", "red", "red", "silver", "red"]),
        Object.freeze(["white", "white", "white", null, "silver", "silver", "silver", "silver", null, "white", "white", "white"])
      ])
    }),
    Object.freeze({
      id: "golden-wall",
      name: "Mur d'or",
      layout: Object.freeze([
        Object.freeze(["blue", "blue", "silver", "silver", "gold", "gold", "gold", "gold", "silver", "silver", "blue", "blue"]),
        Object.freeze(["orange", "silver", "silver", "orange", "orange", "orange", "orange", "orange", "orange", "silver", "silver", "orange"]),
        Object.freeze(["green", "green", "red", "red", null, null, null, null, "red", "red", "green", "green"]),
        Object.freeze(["yellow", "silver", "silver", "yellow", "yellow", "yellow", "yellow", "yellow", "yellow", "silver", "silver", "yellow"]),
        Object.freeze(["pink", "pink", "silver", "silver", "gold", null, null, "gold", "silver", "silver", "pink", "pink"])
      ])
    })
  ])
});

let cachedBaseLevelsPromise = null;

export function createEmptyLayout(rows = 5, columns = 12) {
  const safeRows = clampInteger(rows, 1, 30);
  const safeColumns = clampInteger(columns, 1, 30);
  return Array.from({ length: safeRows }, () => Array.from({ length: safeColumns }, () => null));
}

export function resizeLayout(layout, rows, columns) {
  const safeRows = clampInteger(rows, 1, 30);
  const safeColumns = clampInteger(columns, 1, 30);
  const normalizedLayout = normalizeLayout(layout);

  return Array.from({ length: safeRows }, (_, rowIndex) => {
    const sourceRow = normalizedLayout[rowIndex] ?? [];
    return Array.from({ length: safeColumns }, (_, columnIndex) => sourceRow[columnIndex] ?? null);
  });
}

export function getLevelColumns(layout) {
  const normalizedLayout = normalizeLayout(layout);
  return normalizedLayout.reduce((max, row) => Math.max(max, row.length), 0);
}

export function normalizeLayout(layout = []) {
  if (!Array.isArray(layout)) {
    return createEmptyLayout(1, 1);
  }

  const normalizedRows = layout.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      return [null];
    }

    return row.map((cell) => normalizeCellToken(cell, rowIndex));
  });

  return normalizedRows.length > 0 ? normalizedRows : createEmptyLayout(1, 1);
}

export function normalizeLevelCollection(source) {
  const payload = Array.isArray(source) ? { levels: source } : (source ?? {});
  const levels = Array.isArray(payload.levels) ? payload.levels : [];
  const normalizedLevels = levels.map((level, index) => normalizeLevel(level, index)).filter(Boolean);

  if (normalizedLevels.length === 0) {
    return cloneLevelCollection(FALLBACK_LEVEL_DATA);
  }

  return {
    version: clampInteger(payload.version ?? LEVEL_FILE_VERSION, 1, 9999),
    levels: normalizedLevels
  };
}

export function serializeLevels(levels) {
  const normalized = normalizeLevelCollection({ version: LEVEL_FILE_VERSION, levels });
  return JSON.stringify(
    {
      version: LEVEL_FILE_VERSION,
      levels: normalized.levels
    },
    null,
    2
  );
}

export function getLevelOverrides() {
  const runtimeOverride = globalThis.ARKANOID_CUSTOM_LEVELS;
  if (runtimeOverride) {
    return normalizeLevelCollection(runtimeOverride);
  }

  if (!globalThis.localStorage) {
    return null;
  }

  try {
    const raw = globalThis.localStorage.getItem(LEVEL_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeLevelCollection(JSON.parse(raw));
  } catch (error) {
    console.warn("Override de niveaux ignoré", error);
    return null;
  }
}

export function setLevelOverrides(levels) {
  const normalized = normalizeLevelCollection({ version: LEVEL_FILE_VERSION, levels });
  globalThis.ARKANOID_CUSTOM_LEVELS = cloneLevels(normalized.levels);

  if (globalThis.localStorage) {
    globalThis.localStorage.setItem(
      LEVEL_STORAGE_KEY,
      JSON.stringify({
        version: LEVEL_FILE_VERSION,
        levels: normalized.levels
      })
    );
  }

  return cloneLevels(normalized.levels);
}

export function clearLevelOverrides() {
  delete globalThis.ARKANOID_CUSTOM_LEVELS;

  if (globalThis.localStorage) {
    globalThis.localStorage.removeItem(LEVEL_STORAGE_KEY);
  }
}

export async function loadLevels({ forceRefresh = false, ignoreOverrides = false } = {}) {
  if (!ignoreOverrides) {
    const overrides = getLevelOverrides();
    if (overrides) {
      return cloneLevels(overrides.levels);
    }
  }

  const baseLevels = await loadBaseLevels(forceRefresh);
  return cloneLevels(baseLevels.levels);
}

export function buildBrickPlacements(layout) {
  const normalizedLayout = normalizeLayout(layout);
  const columns = Math.max(1, getLevelColumns(normalizedLayout));
  const totalGap = (columns - 1) * GAME_CONFIG.bricks.gap;
  const usableWidth = GAME_CONFIG.playfield.width - (GAME_CONFIG.bricks.sideMargin * 2) - totalGap;
  const brickWidth = usableWidth / columns;

  return normalizedLayout.flatMap((row, rowIndex) =>
    row.flatMap((cellToken, columnIndex) => {
      const definition = getCellDefinition(cellToken);
      if (!definition) {
        return [];
      }

      return [
        {
          x: GAME_CONFIG.playfield.left + GAME_CONFIG.bricks.sideMargin + columnIndex * (brickWidth + GAME_CONFIG.bricks.gap),
          y: GAME_CONFIG.bricks.topOffset + rowIndex * (GAME_CONFIG.bricks.rowHeight + GAME_CONFIG.bricks.gap),
          width: brickWidth,
          height: GAME_CONFIG.bricks.rowHeight,
          definition
        }
      ];
    })
  );
}

function normalizeLevel(level, index) {
  if (!level || typeof level !== "object") {
    return null;
  }

  const fallbackName = `Niveau ${index + 1}`;
  return {
    id: sanitizeId(level.id, index),
    name: sanitizeName(level.name, fallbackName),
    layout: normalizeLayout(level.layout)
  };
}

function sanitizeId(value, index) {
  const raw = String(value ?? "").trim().toLowerCase();
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `level-${index + 1}`;
}

function sanitizeName(value, fallback) {
  const name = String(value ?? "").trim();
  return name || fallback;
}

function normalizeCellToken(cell, rowIndex) {
  if (cell === null || cell === undefined || cell === 0 || cell === "0" || cell === "empty") {
    return null;
  }

  if (typeof cell === "number") {
    switch (cell) {
      case 1:
        return COMMON_BRICK_TOKENS[rowIndex % COMMON_BRICK_TOKENS.length];
      case 2:
        return "silver";
      case 3:
        return "gold";
      default:
        return null;
    }
  }

  if (typeof cell === "string") {
    const token = cell.trim().toLowerCase();
    if (!token) {
      return null;
    }

    if (COMMON_BRICK_TOKENS.includes(token) || token === "silver" || token === "gold") {
      return token;
    }

    if (token === "hard") {
      return "silver";
    }

    if (token === "common") {
      return COMMON_BRICK_TOKENS[rowIndex % COMMON_BRICK_TOKENS.length];
    }

    return null;
  }

  if (typeof cell === "object") {
    const type = String(cell.type ?? cell.kind ?? "").trim().toLowerCase();
    const color = String(cell.color ?? "").trim().toLowerCase();

    if (type === "gold") {
      return "gold";
    }

    if (type === "hard" || type === "silver") {
      return "silver";
    }

    if (type === "common" && COMMON_BRICK_TOKENS.includes(color)) {
      return color;
    }
  }

  return null;
}

function getCellDefinition(cellToken) {
  if (!cellToken) {
    return null;
  }

  const entry = LEVEL_CELL_LIBRARY[cellToken];
  if (!entry) {
    return null;
  }

  return {
    type: entry.type,
    hits: entry.hits,
    points: entry.points,
    spriteKey: entry.spriteKey,
    indestructible: Boolean(entry.indestructible)
  };
}

async function loadBaseLevels(forceRefresh = false) {
  if (!cachedBaseLevelsPromise || forceRefresh) {
    cachedBaseLevelsPromise = fetchBaseLevels();
  }

  return cachedBaseLevelsPromise;
}

async function fetchBaseLevels() {
  try {
    const response = await fetch(new URL("./levels.json", import.meta.url));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return normalizeLevelCollection(await response.json());
  } catch (error) {
    console.warn("Chargement du fichier de niveaux impossible, fallback utilisé", error);
    return cloneLevelCollection(FALLBACK_LEVEL_DATA);
  }
}

function cloneLevelCollection(collection) {
  return {
    version: collection.version,
    levels: cloneLevels(collection.levels)
  };
}

function cloneLevels(levels) {
  return levels.map((level) => ({
    id: level.id,
    name: level.name,
    layout: level.layout.map((row) => [...row])
  }));
}

function clampInteger(value, min, max) {
  const normalized = Number.parseInt(value, 10);
  if (Number.isNaN(normalized)) {
    return min;
  }

  return Math.min(max, Math.max(min, normalized));
}
