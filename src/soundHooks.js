import { resolveSoundManifest } from "./config.js";

export function getSoundOverrides() {
  return globalThis.ARKANOID_CUSTOM_SOUNDS ?? {};
}

export function setSoundOverrides(overrides) {
  globalThis.ARKANOID_CUSTOM_SOUNDS = {
    ...getSoundOverrides(),
    ...overrides
  };
  return globalThis.ARKANOID_CUSTOM_SOUNDS;
}

export function getResolvedSoundManifest() {
  return resolveSoundManifest(getSoundOverrides());
}
