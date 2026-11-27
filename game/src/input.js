// Senja Amphibi — keyboard, mouse and touch input.
// Keys tracked by e.code; Space is edge-triggered; mouse hold = climb.
// The view pill rect is hit-tested BEFORE the climb hold engages, so a
// tap on the pill toggles the view and never makes the plane climb.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseHeld = false;
    this.clicks = [];
    this.pillRect = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseHeld = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      const p = this.toCanvas(e.clientX, e.clientY);
      if (this.inPill(p.x, p.y)) {
        // Pill tap: queue the click for the toggle and keep the climb
        // hold disengaged, so the plane never climbs on a view tap.
        this.clicks.push(p);
        return;
      }
      this.mouseHeld = true;
    });
    window.addEventListener('mouseup', () => { this.mouseHeld = false; });
    canvas.addEventListener('click', (e) => {
      const p = this.toCanvas(e.clientX, e.clientY);
      if (this.inPill(p.x, p.y)) return; // already queued on mousedown
      this.clicks.push(p);
    });
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const p = this.toCanvas(t.clientX, t.clientY);
      if (this.inPill(p.x, p.y)) {
        this.clicks.push(p);
        return;
      }
      this.mouseHeld = true;
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.mouseHeld = false;
    }, { passive: false });
    canvas.addEventListener('touchcancel', () => { this.mouseHeld = false; });
  }

  setPillRect(rect) {
    this.pillRect = rect;
  }

  inPill(x, y) {
    const r = this.pillRect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  toCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (1280 / rect.width),
      y: (clientY - rect.top) * (720 / rect.height),
    };
  }

  // Edge-triggered: true once per physical press.
  takePressed(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  takeSpace() {
    return this.takePressed('Space');
  }

  takeClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  // Call once per frame so a press is not re-read next frame.
  endFrame() {
    this.justPressed.clear();
  }
}
