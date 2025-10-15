import { PerspectiveCamera, Vector3 } from "three/webgpu";
import { TweakPane } from "../TweakPane";

import type { CameraConfig } from "./types";
import type { Size } from "../../utils/Size";
import { ServiceRegistry } from "../../core/ServiceRegistry";
import type { GameContext } from "../../core/GameContext";

// Debug Modules
import { CameraParametersDebugModule } from "./debug/Camera.ParametersDebug";
import { CameraPositionDebugModule } from "./debug/Camera.PositionDebug";
import { CameraTargetDebugModule } from "./debug/Camera.TargetDebug";

export class Camera extends PerspectiveCamera {
  private _context!: GameContext;
  private debugMode: boolean = false;

  // 🔧 Debug Modules
  private parametersDebugModule!: CameraParametersDebugModule;
  private positionDebugModule!: CameraPositionDebugModule;
  private targetDebugModule!: CameraTargetDebugModule;

  CAMERA_PARAMS: CameraConfig = {
    fov: 75,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 1000,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    position: {
      x: 0,
      y: 6,
      z: 10,
    },
  };

  constructor() {
    super();
    this.fov = this.CAMERA_PARAMS.fov;
    this.aspect =
      this.CAMERA_PARAMS.aspect || window.innerWidth / window.innerHeight;
    this.near = this.CAMERA_PARAMS.near || 0.1;
    this.far = this.CAMERA_PARAMS.far || 1000;

    this.parametersDebugModule = new CameraParametersDebugModule(
      this,
      this.CAMERA_PARAMS
    );
    this.positionDebugModule = new CameraPositionDebugModule(
      this,
      this.CAMERA_PARAMS
    );
    this.targetDebugModule = new CameraTargetDebugModule(
      this,
      this.CAMERA_PARAMS
    );
    this.initializeDebugModules();
  }

  async initialize(context: GameContext) {
    this._context = context;
    const serviceRegistry = ServiceRegistry.getInstance();
    this.setInitialPosition();
    this.updateProjectionMatrix();

    const size = serviceRegistry.get<Size>("size");
    size.on("resize", () => this.handleResize(size));
  }

  handleResize(size: Size) {
    const stageWidth = size.width;
    const stageHeight = size.height;

    this.aspect = stageWidth / stageHeight;
    this.updateProjectionMatrix();
  }

  private setInitialPosition() {
    const cameraTarget = new Vector3(
      this.CAMERA_PARAMS.targetX,
      this.CAMERA_PARAMS.targetY,
      this.CAMERA_PARAMS.targetZ
    );
    this.position.set(
      this.CAMERA_PARAMS.position.x,
      this.CAMERA_PARAMS.position.y,
      this.CAMERA_PARAMS.position.z
    );
    this.lookAt(cameraTarget);
  }

  private initializeDebugModules(): void {
    if(!this.checkDebugMode()) {
      return;
    }

    const pane = TweakPane.getInstance();
    const folder = pane.addFolder({
      title: "📷 Camera Debug Controls",
      expanded: true,
    });

    // 각 디버그 모듈에 위임
    this.parametersDebugModule.setupDebugControls(folder);
    this.positionDebugModule.setupDebugControls(folder);
    this.targetDebugModule.setupDebugControls(folder);
  }

  private checkDebugMode(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get("debug");
    this.debugMode = debugParam === "camera";
    return this.debugMode;
  }
}
