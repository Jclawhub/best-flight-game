// Keyboard + mouse input for Senja Amphibi.
// Tracks held keys, edge-triggered presses (consumed once per frame), and the
// mouse position / button state over the canvas. Nothing here touches the
// game rules — it only reports what the pilot is doing.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    };
    this._onMouseDown = (event) => {
      this._onMouseMove(event);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  // True while the key is held down.
  isDown(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down (call once per frame per key).
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // True on the frame the mouse button went down.
  wasClicked() {
    return this.mouse.clicked;
  }

  // Any of the given codes held down.
  anyDown(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  // True if any of the given codes went down this frame.
  anyPressed(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  // Forget every held key (used when the game changes state).
  clearKeys() {
    this.keys.clear();
    this.pressed.clear();
  }

  // Call at the end of each frame: edges live for exactly one frame.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
