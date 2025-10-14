import EventEmitter from "./EventEmitter";

export default class Time extends EventEmitter {
  start: number;
  current: number;
  elapsed: number;
  delta: number;
  private isRunning = false;
  private animationId: number | null = null;

  constructor() {
    super();

    this.start = Date.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 16;

    // 자동으로 시작하지 않음 - Game.start()에서 명시적으로 시작
  }

  startGameLoop() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.animationId = window.requestAnimationFrame(() => {
      this.tick();
    });
  }

  stopGameLoop() {
    this.isRunning = false;
    if (this.animationId) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  tick() {
    if (!this.isRunning) return;

    const currentTime = Date.now();
    this.delta = currentTime - this.current;
    this.current = currentTime;
    this.elapsed = this.current - this.start;

    this.trigger('tick');

    this.animationId = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
}
