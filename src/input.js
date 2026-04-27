export function createInputController(canvas, { mobileControls = null } = {}) {
  const heldKeys = new Set();
  const heldMobileDirections = new Set();
  const state = {
    pointerX: null,
    axis: 0,
    launchQueued: false,
    editorQueued: false,
    nextLevelQueued: false
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
  const isEditorKey = (event) => event.code === "F2";
  const isNextLevelKey = (event) => event.code === "KeyN" || event.key === "n" || event.key === "N";

  const updateAxis = () => {
    const left = heldKeys.has("left") || heldMobileDirections.has("left");
    const right = heldKeys.has("right") || heldMobileDirections.has("right");
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
    updatePointerPosition(event);
  };

  const updatePointerPosition = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    state.pointerX = (event.clientX - rect.left) * scaleX;
  };

  const onPointerDown = (event) => {
    canvas.focus();
    updatePointerPosition(event);
    state.launchQueued = true;

    if (event.pointerType === "touch" || event.pointerType === "pen") {
      event.preventDefault();
    }

    if (typeof canvas.setPointerCapture === "function") {
      canvas.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      event.preventDefault();
      updatePointerPosition(event);
    }
  };

  const onPointerUp = (event) => {
    if (typeof canvas.releasePointerCapture === "function") {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
  };

  const onMouseLeave = () => {
    state.pointerX = null;
  };

  const onKeyDown = (event) => {
    if (isLeftKey(event) || isRightKey(event) || isLaunchKey(event) || isEditorKey(event) || isNextLevelKey(event)) {
      event.preventDefault();
    }

    syncHeldKey(event, true);

    if (isLeftKey(event) || isRightKey(event)) {
      state.pointerX = null;
    }

    if (isLaunchKey(event)) {
      state.launchQueued = true;
    }

    if (isEditorKey(event)) {
      state.editorQueued = true;
    }

    if (isNextLevelKey(event)) {
      state.nextLevelQueued = true;
    }
  };

  const onKeyUp = (event) => {
    syncHeldKey(event, false);
  };

  const onPointerLaunch = () => {
    canvas.focus();
    state.launchQueued = true;
  };

  const mobileControlButtons = mobileControls
    ? Array.from(mobileControls.querySelectorAll("[data-mobile-action]"))
    : [];

  const setMobileDirection = (action, pressed) => {
    if (action !== "left" && action !== "right") {
      return;
    }

    if (pressed) {
      heldMobileDirections.add(action);
    } else {
      heldMobileDirections.delete(action);
    }

    state.pointerX = null;
    updateAxis();
  };

  const onMobileControlDown = (event) => {
    const action = event.currentTarget.dataset.mobileAction;
    event.preventDefault();
    canvas.focus();

    if (action === "launch") {
      state.launchQueued = true;
      return;
    }

    setMobileDirection(action, true);
  };

  const onMobileControlUp = (event) => {
    setMobileDirection(event.currentTarget.dataset.mobileAction, false);
  };

  const onBlur = () => {
    heldKeys.clear();
    heldMobileDirections.clear();
    state.axis = 0;
  };

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("click", onPointerLaunch);
  for (const button of mobileControlButtons) {
    button.addEventListener("pointerdown", onMobileControlDown);
    button.addEventListener("pointerup", onMobileControlUp);
    button.addEventListener("pointercancel", onMobileControlUp);
    button.addEventListener("pointerleave", onMobileControlUp);
  }
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
    consumeEditorRequest() {
      const queued = state.editorQueued;
      state.editorQueued = false;
      return queued;
    },
    consumeNextLevelRequest() {
      const queued = state.nextLevelQueued;
      state.nextLevelQueued = false;
      return queued;
    },
    dispose() {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("click", onPointerLaunch);
      for (const button of mobileControlButtons) {
        button.removeEventListener("pointerdown", onMobileControlDown);
        button.removeEventListener("pointerup", onMobileControlUp);
        button.removeEventListener("pointercancel", onMobileControlUp);
        button.removeEventListener("pointerleave", onMobileControlUp);
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    }
  };
}
