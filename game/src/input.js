// Senja Amphibi — keyboard + mouse input. Keys are read by code, the mouse
// is held to climb, and clicks are queued for the menu screens.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseHeld = false;
    this.clicks = [];
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.keys.add(e.code);
      if (e.code === 'Space') this.spacePressed = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseHeld = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseHeld = true;
      const r = canvas.getBoundingClientRect();
      this.clicks.push({
        x: (e.clientX - r.left) * (canvas.width / r.width),
        y: (e.clientY - r.top) * (canvas.height / r.height),
      });
    });
    window.addEventListener('mouseup', () => { this.mouseHeld = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Touch: hold the canvas to climb, same as holding the mouse.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.mouseHeld = true;
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this.mouseHeld = false; });
    this.spacePressed = false;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Edge-triggered Space: true once per press.
  takeSpace() {
    const s = this.spacePressed;
    this.spacePressed = false;
    return s;
  }

  takeClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  }
}
