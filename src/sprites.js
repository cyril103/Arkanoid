function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadSprite(sprite) {
  if (Array.isArray(sprite.frames)) {
    const frameImages = (await Promise.all(sprite.frames.map((src) => loadImage(src)))).filter(Boolean);
    return {
      ...sprite,
      image: frameImages[0] ?? null,
      frameImages
    };
  }

  const image = await loadImage(sprite.src);
  return {
    ...sprite,
    image,
    frameImages: []
  };
}

export async function loadSprites(manifest) {
  const entries = await Promise.all(
    Object.entries(manifest).map(async ([key, sprite]) => {
      return [
        key,
        await loadSprite(sprite)
      ];
    })
  );

  return Object.fromEntries(entries);
}
