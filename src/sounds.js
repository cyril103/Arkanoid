function createAudioInstance(definition) {
  const audio = new Audio(definition.src);
  audio.preload = "auto";
  audio.volume = definition.volume ?? 1;
  return audio;
}

export class Soundboard {
  constructor(manifest) {
    this.enabled = true;
    this.unlocked = false;
    this.sounds = Object.fromEntries(
      Object.entries(manifest).map(([key, definition]) => [
        key,
        {
          definition,
          lastPlayedAt: -Infinity,
          pool: Array.from({ length: definition.poolSize ?? 3 }, () => createAudioInstance(definition))
        }
      ])
    );
  }

  installUnlockHandlers() {
    const unlock = () => {
      this.unlock();
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  unlock() {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;

    for (const sound of Object.values(this.sounds)) {
      const audio = sound.pool[0];
      if (!audio) {
        continue;
      }

      const previousMuted = audio.muted;
      audio.muted = true;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = previousMuted;
          })
          .catch(() => {
            audio.muted = previousMuted;
          });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = previousMuted;
      }
    }
  }

  play(key) {
    if (!this.enabled || !this.unlocked) {
      return;
    }

    const sound = this.sounds[key];
    if (!sound?.definition?.src) {
      return;
    }

    const now = performance.now();
    const cooldownMs = sound.definition.cooldownMs ?? 0;
    if (now - sound.lastPlayedAt < cooldownMs) {
      return;
    }

    const audio = sound.pool.find((entry) => entry.paused || entry.ended) ?? createAudioInstance(sound.definition);
    if (!sound.pool.includes(audio)) {
      sound.pool.push(audio);
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = sound.definition.volume ?? 1;
    sound.lastPlayedAt = now;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {});
    }
  }
}

export function createSoundboard(manifest) {
  return new Soundboard(manifest);
}
