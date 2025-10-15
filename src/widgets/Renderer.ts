import * as THREE from "three/webgpu";
import { ServiceRegistry } from "../core/ServiceRegistry";

import type { Size } from "../utils/Size";
import type { Scene } from "./Scene";
import type { Camera } from "./Camera";

export class Renderer extends THREE.WebGPURenderer {
  private root: HTMLElement;
  private _size: Size;
  private _scene: Scene;
  private _camera: Camera;
  private isInitialized = false;

  constructor() {
    super();
    
    const registry = ServiceRegistry.getInstance();
    this._size = registry.get<Size>('size');
    this._scene = registry.get<Scene>('scene');
    this._camera = registry.get<Camera>('camera');

    this.setSize(this._size.width, this._size.height);
    this.root = document.getElementById("root")!;
    this.root.appendChild(this.domElement);
    
    this.setupEvents();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.init();
    this.isInitialized = true;
  }

  get size(): Size { return this._size; }
  get scene(): Scene { return this._scene; }
  get camera(): Camera { return this._camera; }

  private setupEvents() {
    this._size.on('resize', () => this.resize());
  }

  resize() {
    this.setSize(this._size.width, this._size.height);
  }

  update() {
    if (this.isInitialized) {
      this.render(this._scene, this._camera);
    }
  }
}
