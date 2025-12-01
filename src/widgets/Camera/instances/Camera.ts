import gsap from "gsap";
import { TweakPane } from "../../TweakPane";
import {
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

import type { CameraConfig } from "../types";
import type { Size } from "@/utils/Size";
import { ServiceRegistry } from "@/core/ServiceRegistry";
import type { GameContext } from "@/core/GameContext";

// Debug Modules
import { CameraParametersDebugModule } from "../debug/Camera.ParametersDebug";
import { CameraPositionDebugModule } from "../debug/Camera.PositionDebug";
import { CameraTargetDebugModule } from "../debug/Camera.TargetDebug";

interface Angle {
  items: {
    default: Vector3;
    projects: Vector3;
  };
  value: Vector3;
  set: (_name: keyof Angle["items"]) => void;
}

interface CustomOrbitControls extends OrbitControls {
  enableKeys?: boolean;
}

interface Zoom {
  easing: number;
  minDistance: number;
  amplitude: number;
  value: number;
  targetValue: number;
  distance: number;
}

interface Pan {
  enabled: boolean;
  active: boolean;
  easing: number;
  start: {
    x: number;
    y: number;
  };
  value: {
    x: number;
    y: number;
  };
  targetValue: {
    x: number;
    y: number;
  };
  raycaster: Raycaster;
  mouse: Vector2;
  needsUpdate: boolean;
  hitMesh: Mesh;
  reset: () => void;
  enable: () => void;
  disable: () => void;
  down: (_x: number, _y: number) => void;
  move: (_x: number, _y: number) => void;
  up: () => void;
}


export class Camera {
  public container: Object3D;
  public instance!: PerspectiveCamera;
  public orbitControls?: CustomOrbitControls;
  public zoom: Zoom = {
    easing: 0,
    minDistance: 0,
    amplitude: 0,
    value: 0,
    targetValue: 0,
    distance: 0,
  };
  public pan!: Pan;
  public target: Vector3;

  private _context!: GameContext;
  private debugMode: boolean = false;

  private parametersDebugModule!: CameraParametersDebugModule;
  private positionDebugModule!: CameraPositionDebugModule;
  private targetDebugModule!: CameraTargetDebugModule;

  private targetEased: Vector3;
  private easing: number;

  private angle?: Angle;

  // --- Camera follow 관련 추가 ---
  private followTargetObject?: Object3D; // 추적할 대상(스페이스십 등)
  private followOffset: Vector3 = new Vector3(8, 20, 8); // 기본 오프셋
  private followEasing: number = 0.12; // lerp 계수

  CAMERA_PARAMS: CameraConfig = {
    fov: 40,
    aspect: window.innerWidth / window.innerHeight,
    near: 1,
    far: 80,
    targetX: 0,
    targetY: 1,
    targetZ: 0,
    position: {
      x: 8,
      y: 20,
      z: 8,
    },
  };

  constructor() {
    this.target = new Vector3(0, 0, 0);
    this.targetEased = new Vector3(0, 0, 0);
    this.easing = 0.15;
    this.container = new Object3D();
    this.container.matrixAutoUpdate = false;
  }

  async initialize(context: GameContext) {
    this._context = context;
    const serviceRegistry = ServiceRegistry.getInstance();

    this.setupAngle();
    this.setupInstance();
    this.setupZoom();
    this.setupPan();
    this.setupOrbitControls();

    this.setInitialPosition();
    this.instance.updateProjectionMatrix();
    this.initializeDebugModules();

    const size = serviceRegistry.get<Size>("size");
    size.on("resize", () => this.handleResize(size));
  }


  /**
   * 스페이스십 등 Object3D를 추적 대상으로 지정
   * @param targetObject 추적할 Object3D (예: 스페이스십)
   * @param offset 카메라와 대상 간의 상대 위치 (옵션)
   * @param easing 부드러운 이동 계수 (옵션)
   */
  public setFollowTargetObject(targetObject: Object3D, offset?: Vector3, easing?: number) {
    this.followTargetObject = targetObject;
    if (offset) this.followOffset = offset.clone();
    if (typeof easing === 'number') this.followEasing = easing;
  }

  setupPan() {
    this.pan = {} as Pan;
    this.pan.enabled = false;
    this.pan.active = false;
    this.pan.easing = 0.1;
    this.pan.start = {} as { x: number; y: number };
    this.pan.start.x = 0;
    this.pan.start.y = 0;
    this.pan.value = {} as { x: number; y: number };
    this.pan.value.x = 0;
    this.pan.value.y = 0;
    this.pan.targetValue = {} as { x: number; y: number };
    this.pan.targetValue.x = this.pan.value.x;
    this.pan.targetValue.y = this.pan.value.y;

    this.pan.raycaster = new Raycaster();
    this.pan.mouse = new Vector2();
    this.pan.needsUpdate = false;
    this.pan.hitMesh = new Mesh(
      new PlaneGeometry(500, 500, 1, 1),
      new MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        visible: false,
      })
    );
    this.container.add(this.pan.hitMesh);

    this.pan.reset = () => {
      this.pan.targetValue.x = 0;
      this.pan.targetValue.y = 0;
    };

    this.pan.enable = () => {
      this.pan.enabled = true;

      // Update cursor
      this._context.renderer.domElement.classList.add("has-cursor-grab");
    };

    this.pan.disable = () => {
      this.pan.enabled = false;

      // Update cursor
      this._context.renderer.domElement.classList.remove("has-cursor-grab");
    };

    this.pan.down = (_x, _y) => {
      if (!this.pan.enabled) {
        return;
      }

      // Update cursor
      this._context.renderer.domElement.classList.add("has-cursor-grabbing");

      // Activate
      this.pan.active = true;

      // Update mouse position
      this.pan.mouse.x = (_x / this._context.size.width) * 2 - 1;
      this.pan.mouse.y = -(_y / this._context.size.height) * 2 + 1;

      // Get start position
      this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance);

      const intersects = this.pan.raycaster.intersectObjects([
        this.pan.hitMesh,
      ]);

      if (intersects.length) {
        this.pan.start.x = intersects[0].point.x;
        this.pan.start.y = intersects[0].point.y;
      }
    };

    this.pan.move = (_x, _y) => {
      if (!this.pan.enabled) {
        return;
      }

      if (!this.pan.active) {
        return;
      }

      this.pan.mouse.x = (_x / this._context.size.width) * 2 - 1;
      this.pan.mouse.y = -(_y / this._context.size.height) * 2 + 1;

      this.pan.needsUpdate = true;
    };

    this.pan.up = () => {
      // Deactivate
      this.pan.active = false;

      // Update cursor
      this._context.renderer.domElement.classList.remove("has-cursor-grabbing");
    };

    // Mouse
    window.addEventListener("mousedown", (_event) => {
      this.pan.down(_event.clientX, _event.clientY);
    });

    window.addEventListener("mousemove", (_event) => {
      this.pan.move(_event.clientX, _event.clientY);
    });

    window.addEventListener("mouseup", () => {
      this.pan.up();
    });

    this._context.time.on("tick", () => {
      if (this.pan.active && this.pan.needsUpdate) {
        // Update target value
        this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance);

        const intersects = this.pan.raycaster.intersectObjects([
          this.pan.hitMesh,
        ]);

        if (intersects.length) {
          this.pan.targetValue.x = -(intersects[0].point.x - this.pan.start.x);
          this.pan.targetValue.y = -(intersects[0].point.y - this.pan.start.y);
        }

        // Update needsUpdate
        this.pan.needsUpdate = false;
      }

      // Update value and apply easing
      this.pan.value.x +=
        (this.pan.targetValue.x - this.pan.value.x) * this.pan.easing;
      this.pan.value.y +=
        (this.pan.targetValue.y - this.pan.value.y) * this.pan.easing;
    });
  }

  setupZoom() {
    this.zoom.easing = 0.1;
    this.zoom.minDistance = 14;
    this.zoom.amplitude = 15;
    this.zoom.value = 0.5;
    this.zoom.targetValue = this.zoom.value;
    this.zoom.distance =
      this.zoom.minDistance + this.zoom.amplitude * this.zoom.value;

    document.addEventListener(
      "wheel",
      (_event) => {
        this.zoom.targetValue += _event.deltaY * 0.001;
        this.zoom.targetValue = Math.min(Math.max(this.zoom.targetValue, 0), 1);
      },
      { passive: true }
    );

    this._context.time.on("tick", () => {
      this.zoom.value +=
        (this.zoom.targetValue - this.zoom.value) * this.zoom.easing;
      this.zoom.distance =
        this.zoom.minDistance + this.zoom.amplitude * this.zoom.value;
    });
  }

  setupInstance() {
    const { fov, near, far } = this.CAMERA_PARAMS;
    const aspect =
      this._context.size.width / this._context.size.height ||
      this.CAMERA_PARAMS.aspect;
    this.instance = new PerspectiveCamera(fov, aspect, near, far);
    this.instance.up.set(0, 1, 0);
    if (this.angle) {
      this.instance.position.copy(this.angle.value);
    }
    this.instance.lookAt(new Vector3());
    this.container.add(this.instance);

    this._context.size.on("resize", () => {
      this.instance.aspect =
        this._context.size.width / this._context.size.height;
      this.instance.updateProjectionMatrix();
    });

    this._context.time.on("tick", () => {
      // --- 카메라 추적 로직 ---
      if (this.followTargetObject) {
        const targetPos = this.followTargetObject.getWorldPosition(new Vector3());
        const desiredPos = targetPos.clone().add(this.followOffset);

        if (this.orbitControls && this.orbitControls.enabled) {
          // OrbitControls가 활성화된 경우 target만 보간해서 갱신
          this.orbitControls.target.lerp(targetPos, this.followEasing);
          this.orbitControls.update();
        } else {
          // OrbitControls가 비활성화된 경우 position과 lookAt 직접 갱신
          this.instance.position.lerp(desiredPos, this.followEasing);
          this.instance.lookAt(targetPos);
        }
        return; // 추적 모드일 때는 아래 기존 로직 생략
      }
      // --- 기존 로직 유지 ---
      if (this.orbitControls && !this.orbitControls.enabled) {
        this.targetEased.x += (this.target.x - this.targetEased.x) * this.easing;
        this.targetEased.y += (this.target.y - this.targetEased.y) * this.easing;
        this.targetEased.z += (this.target.z - this.targetEased.z) * this.easing;

        if (this.angle) {
          this.instance.position.copy(this.targetEased).add(this.angle.value.clone().normalize().multiplyScalar(this.zoom.distance));
        }

        this.instance.lookAt(this.targetEased);

        this.instance.position.x += this.pan.value.x;
        this.instance.position.y += this.pan.value.y;
      }
    });
  }

  setupOrbitControls() {
    this.orbitControls = new OrbitControls(
      this.instance,
      this._context.renderer.domElement
    );
    this.orbitControls.enabled = true;
    this.orbitControls.enableKeys = false;
    this.orbitControls.zoomSpeed = 0.5;
  }

  setupAngle() {
    const items = {
      default: new Vector3(1.135, -1.45, 1.15),
      projects: new Vector3(0.38, -1.4, 1.63),
    };
    const value = new Vector3();
    value.copy(items.default);

    const setter = (_name: keyof Angle["items"]) => {
      if (this.angle?.items) {
        const angle = this.angle?.items[_name];
        gsap.to(this.angle!.value, {
          ...angle,
          duration: 1.5,
          ease: "power2.out",
        });
      }
    };

    this.angle = { items, value, set: setter };
  }

  handleResize(size: Size) {
    const stageWidth = size.width;
    const stageHeight = size.height;

    this.instance.aspect = stageWidth / stageHeight;
    this.instance.updateProjectionMatrix();
  }

  private setInitialPosition() {
    const cameraTarget = new Vector3(
      this.CAMERA_PARAMS.targetX,
      this.CAMERA_PARAMS.targetY,
      this.CAMERA_PARAMS.targetZ
    );
    this.instance.position.set(
      this.CAMERA_PARAMS.position.x,
      this.CAMERA_PARAMS.position.y,
      this.CAMERA_PARAMS.position.z
    );
    this.instance.lookAt(cameraTarget);
  }

  private initializeDebugModules(): void {
    if (!this.checkDebugMode()) {
      return;
    }

    const pane = TweakPane.getInstance();
    const folder = pane.addFolder({
      title: "📷 Camera Debug Controls",
      expanded: true,
    });

    this.parametersDebugModule = new CameraParametersDebugModule(
      this.instance,
      this.CAMERA_PARAMS
    );
    this.positionDebugModule = new CameraPositionDebugModule(
      this.instance,
      this.CAMERA_PARAMS
    );
    this.targetDebugModule = new CameraTargetDebugModule(
      this.instance,
      this.CAMERA_PARAMS
    );

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
