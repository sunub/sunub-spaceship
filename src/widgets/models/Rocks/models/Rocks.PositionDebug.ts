import type { FolderApi } from "tweakpane";
import type { PositionOptions } from "..";

export class RocksPositionDebuger {
  private _options: PositionOptions;

  constructor(options: PositionOptions) {
    this._options = options;
  }

  
  public setupDebugControls(
    folder: FolderApi, 
    onPositionChange?: (options: PositionOptions) => void
  ): void {
    folder.addBinding(this._options, 'positionX', { min: -50, max: 50, step: 0.1 }).on("change", (ev) => {
      this._options.positionX = ev.value;
      onPositionChange?.(this._options);
    });

    folder.addBinding(this._options, 'positionY', { min: -50, max: 50, step: 0.1 }).on("change", (ev) => {
      this._options.positionY = ev.value;
      onPositionChange?.(this._options);
    });

    folder.addBinding(this._options, 'positionZ', { min: -50, max: 50, step: 0.1 }).on("change", (ev) => {
      this._options.positionZ = ev.value;
      onPositionChange?.(this._options);
    });
  }

  public getPosition(): { x: number; y: number; z: number } {
    return {
      x: this._options.positionX,
      y: this._options.positionY,
      z: this._options.positionZ
    };
  }
}
