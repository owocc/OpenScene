/**
 * Prevents native browser full-page zoom gestures and keyboard shortcuts.
 *
 * Browsers (Safari / Chrome on macOS / iOS / Windows) can trigger full-page zoom
 * via:
 * 1. Trackpad pinch gestures (Chrome sends `wheel` with `ctrlKey=true`, Safari fires `gesturestart`/`gesturechange`)
 * 2. Mouse wheel while holding Ctrl/Cmd key
 * 3. Multi-touch pinch gestures on touchscreens
 * 4. Keyboard shortcuts: Ctrl/Cmd + Plus/Minus/0/Equal/NumpadAdd/NumpadSubtract
 *
 * Calling `setupPreventPageZoom()` registers non-passive window/document event listeners
 * to intercept these and prevent the entire browser window from zooming.
 */
export function setupPreventPageZoom(): () => void {
  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  };

  const handleGesture = (event: Event) => {
    event.preventDefault();
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const isModifier = event.ctrlKey || event.metaKey;
    if (!isModifier) return;

    const zoomKeys = ["+", "=", "-", "_", "0"];
    const zoomCodes = [
      "Equal",
      "Minus",
      "Digit0",
      "NumpadAdd",
      "NumpadSubtract",
      "Numpad0",
      "NumpadEqual",
    ];

    if (zoomKeys.includes(event.key) || zoomCodes.includes(event.code)) {
      // Prevent browser page zoom
      event.preventDefault();
    }
  };

  window.addEventListener("wheel", handleWheel, { passive: false });
  document.addEventListener("gesturestart", handleGesture, { passive: false });
  document.addEventListener("gesturechange", handleGesture, { passive: false });
  document.addEventListener("gestureend", handleGesture, { passive: false });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  window.addEventListener("keydown", handleKeyDown, { capture: true });

  return () => {
    window.removeEventListener("wheel", handleWheel);
    document.removeEventListener("gesturestart", handleGesture);
    document.removeEventListener("gesturechange", handleGesture);
    document.removeEventListener("gestureend", handleGesture);
    document.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
  };
}
