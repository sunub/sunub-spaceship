import { Camera } from "three/webgpu";
import { OrbitControls as OriginOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { IController } from "../core/GameContext";

export class OrbitController extends OriginOrbitControls implements IController {
  public enabled = true;

  constructor(camera: Camera, domElement: HTMLElement) {
    super(camera, domElement);
    this.enableDamping = true;
    this.dampingFactor = 0.25;
    this.enableZoom = true;
    this.minDistance = 5;
    this.maxDistance = 50;
    this.update();
  }

  update(): boolean {
    if (this.enabled) {
      return super.update();
    }
    return false;
  }
}
