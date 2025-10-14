import EventEmitter from "./EventEmitter";

export class Size extends EventEmitter {
  width: number;
  height: number;
  pixelRatio: number;

  constructor() {
    super();

    const stageWidth = window.innerWidth;
    const stageHeight = window.innerHeight;

    this.width = stageWidth;
    this.height = stageHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);

    window.addEventListener("resize", () => {
      const stageWidth = window.innerWidth;
      const stageHeight = window.innerHeight;

      this.width = stageWidth;
      this.height = stageHeight;
      this.pixelRatio = Math.min(window.devicePixelRatio, 2);

      this.trigger("resize");
    });
  }
}
