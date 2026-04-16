export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function isCircleCollidingWithRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return (dx * dx) + (dy * dy) <= circle.radius * circle.radius;
}
