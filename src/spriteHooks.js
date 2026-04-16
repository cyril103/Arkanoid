import { resolveSpriteManifest } from "./config.js";

export function getSpriteOverrides() {
  return globalThis.ARKANOID_CUSTOM_SPRITES ?? {};
}

export function setSpriteOverrides(overrides) {
  globalThis.ARKANOID_CUSTOM_SPRITES = {
    ...getSpriteOverrides(),
    ...overrides
  };
  return globalThis.ARKANOID_CUSTOM_SPRITES;
}

export function getResolvedSpriteManifest() {
  return resolveSpriteManifest(getSpriteOverrides());
}
