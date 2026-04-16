export function createInputController(canvas) {
  const heldKeys = new Set();
  const state = {
    pointerX: null,
    axis: 0,
    launchQueued: false
  };

  canvas.tabIndex = 0;

  const isLeftKey = (event) => (
    event.code === "ArrowLeft" ||
    event.code === "KeyA" ||
    event.code === "KeyQ" ||
    event.key === "ArrowLeft" ||
    event.key === "a" ||
    event.key === "A" ||
    event.key === "q" ||
    event.key === "Q"
  );

  const isRightKey = (event) => (
    event.code === "ArrowRight" ||
    event.code === "KeyD" ||
    event.key === "ArrowRight" ||
    event.key === "d" ||
    event.key === "D"
  );

  const isLaunchKey = (event) => event.code === "Space" || event.key === " ";

  const updateAxis = () => {
    const left = heldKeys.has("left");
    const right = heldKeys.has("right");
    state.axis = Number(right) - Number(left);
  };

  const syncHeldKey = (event, pressed) => {
    if (isLeftKey(event)) {
      if (pressed) {
        heldKeys.add("left");
      } else {
        heldKeys.delete("left");
      }
    }

    if (isRightKey(event)) {
      if (pressed) {
        heldKeys.add("right");
      } else {
        heldKeys.delete("right");
      }
    }

    updateAxis();
  };

  const onMouseMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    state.pointerX = (event.clientX - rect.left) * scaleX;
  };

  const onMouseLeave = () => {
    state.pointerX = null;
  };

  const onKeyDown = (event) => {
    if (isLeftKey(event) || isRightKey(event) || isLaunchKey(event)) {
      event.preventDefault();
    }

    syncHeldKey(event, true);

    if (isLeftKey(event) || isRightKey(event)) {
      state.pointerX = null;
    }

    if (isLaunchKey(event)) {
      state.launchQueued = true;
    }
  };

  const onKeyUp = (event) => {
    syncHeldKey(event, false);
  };

  const onPointerLaunch = () => {
    canvas.focus();
    state.launchQueued = true;
  };

  const onBlur = () => {
    heldKeys.clear();
    state.axis = 0;
  };

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("click", onPointerLaunch);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    get state() {
      return state;
    },
    consumeLaunch() {
      const queued = state.launchQueued;
      state.launchQueued = false;
      return queued;
    },
    dispose() {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click", onPointerLaunch);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    }
  };
}
