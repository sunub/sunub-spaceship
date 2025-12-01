import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { ServiceRegistry } from "../core/ServiceRegistry";
import type {
  GameContext,
  IGameObject,
  IController,
} from "../core/GameContext";
import Resources from "../utils/Resources";
import sources from "../sources";

import { Physics } from "./Physics";
import { Scene } from "./Scene";
import { Renderer } from "./Renderer";
import { Size } from "../utils/Size";
import Time from "../utils/Time";
import { Camera } from "./Camera";
import { Debug } from "./Debug";
import { Floor } from "./Floor";
import { SpaceShip } from "./models";
import { InputManager } from "../Inputs/InputManager";
import { Vector2Processor } from "../Inputs/processors/Vector2Processor";
import { FlightActionMapper } from "../Inputs/mappers/FlightActionMapper";
import { CameraActionMapper } from "../Inputs/mappers/CameraActionMapper";
import { Area } from "./models/Area";
import { Rocks, Planet, Atmosphere, Land, EngineFlame } from "./models";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { EffectComposer } from "three/examples/jsm/Addons.js";
import { RenderPass } from "three/examples/jsm/Addons.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

import BlurPass from "@/widgets/Passes/Blur";
import GlowPass from "@/widgets/Passes/Glow";

interface DirectionShaderPass extends ShaderPass {
  strength?: number;
}

interface GlowShaderPass extends ShaderPass {
  color?: string;
}

interface Passes {
  renderPass: RenderPass;
  horizontalBlurPass: DirectionShaderPass;
  verticalBlurPass: DirectionShaderPass;
  glowsPass: GlowShaderPass;
  composer: EffectComposer;
}

export class Game {
  private static instance: Game;

  // Core Services (읽기 전용으로 공개)
  public readonly renderer: Renderer;
  public readonly scene: Scene;
  public readonly camera: Camera;
  public readonly physics: Physics;
  public readonly time: Time;
  public readonly size: Size;
  public readonly debug: Debug;
  public readonly inputManager: InputManager;
  public readonly resources: Resources;

  // Game Objects & Controllers 관리
  private gameObjects: IGameObject[] = [];
  private controllers: IController[] = [];
  private isInitialized = false;
  private passes?: Passes;

  private constructor() {
    // GameObject를 초기화 할 경우 내부에서 동작하는 객체들에 대한 의존성의 순서를 고려하는 것이 중요하다.
    this.debug = new Debug({ title: "Game Controller" });
    this.time = new Time();
    this.size = new Size();
    this.scene = new Scene();
    this.camera = new Camera();
    this.physics = new Physics();
    this.inputManager = InputManager.getInstance();
    this.resources = new Resources(sources);

    // Game 인스턴스에 직접 접근하지 않고 ServiceRegistry를 통해 접근할 수 있도록 GameContext를 제공한다.
    this.registerAllServices();

    // Renderer 는 여러 객체에 의존성이 있으므로 가장 마지막에 초기화하는 것이 안전하다.
    this.renderer = new Renderer();
    this.registerRenderer();
  }

  static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  setPasses() {
    this.passes = {
      composer: new EffectComposer(this.renderer),
      renderPass: new RenderPass(this.scene, this.camera.instance),
      horizontalBlurPass: new ShaderPass(BlurPass),
      verticalBlurPass: new ShaderPass(BlurPass),
      glowsPass: new ShaderPass(GlowPass),
    };

    this.passes.horizontalBlurPass.strength = 0;
    this.passes.horizontalBlurPass.material.uniforms["uResolution"].value =
      new THREE.Vector2(this.size.width, this.size.height);
    this.passes.horizontalBlurPass.material.uniforms["uStrength"].value =
      new THREE.Vector2(this.passes.horizontalBlurPass.strength, 0);

    this.passes.verticalBlurPass.strength = 0;
    this.passes.verticalBlurPass.material.uniforms["uResolution"].value =
      new THREE.Vector2(this.size.width, this.size.height);
    this.passes.verticalBlurPass.material.uniforms["uStrength"].value =
      new THREE.Vector2(0, this.passes.verticalBlurPass.strength);

    this.passes.glowsPass.color = "#ffcfe0";
    this.passes.glowsPass.material.uniforms.uPosition.value = new THREE.Vector2(
      0,
      0.25
    );
    this.passes.glowsPass.material.uniforms.uRadius.value = 0.7;
    this.passes.glowsPass.material.uniforms.uColor.value = new THREE.Color(
      this.passes.glowsPass.color
    );
    this.passes.glowsPass.material.uniforms.uColor.value.convertLinearToSRGB();
    this.passes.glowsPass.material.uniforms.uAlpha.value = 0.55;

    this.passes.composer.addPass(this.passes.renderPass);
    this.passes.composer.addPass(this.passes.horizontalBlurPass);
    this.passes.composer.addPass(this.passes.verticalBlurPass);
    this.passes.composer.addPass(this.passes.glowsPass);

    this.size.on("resize", () => {
      if (this.passes) {
        this.renderer.setSize(this.size.width, this.size.height);
        this.passes.composer.setSize(this.size.width, this.size.height);
        this.passes.horizontalBlurPass.material.uniforms.uResolution.value.x =
          this.size.width;
        this.passes.horizontalBlurPass.material.uniforms.uResolution.value.y =
          this.size.height;
        this.passes.verticalBlurPass.material.uniforms.uResolution.value.x =
          this.size.width;
        this.passes.verticalBlurPass.material.uniforms.uResolution.value.y =
          this.size.height;
      }
    });
  }

  private registerAllServices() {
    const registry = ServiceRegistry.getInstance();
    registry.register("game", this);
    registry.register("debug", this.debug);
    registry.register("time", this.time);
    registry.register("size", this.size);
    registry.register("scene", this.scene);
    registry.register("camera", this.camera);
    registry.register("physics", this.physics);
    registry.register("inputManager", this.inputManager);
    registry.register("resources", this.resources);
  }

  private registerRenderer() {
    const registry = ServiceRegistry.getInstance();
    registry.register("renderer", this.renderer);
  }

  addGameObject(obj: IGameObject): void {
    this.gameObjects.push(obj);
    if (this.isInitialized) {
      obj.initialize?.(this.getContext());
    }
  }

  addController(controller: IController): void {
    this.controllers.push(controller);
  }

  removeController(controller: IController): void {
    const index = this.controllers.indexOf(controller);
    if (index > -1) {
      this.controllers.splice(index, 1);
    }
  }

  getContext(): GameContext {
    return {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      physics: this.physics,
      time: this.time,
      size: this.size,
      debug: this.debug,
      inputManager: this.inputManager,
      resources: this.resources,
    };
  }

  getService<T>(key: string): T {
    return ServiceRegistry.getInstance().get<T>(key);
  }

  get orbitControls(): OrbitControls | undefined {
    return this.camera.orbitControls;
  }

  async initialize() {
    if (this.isInitialized) return;

    await RAPIER.init();
    await this.physics.initialize();

    // 리소스 로딩 완료까지 대기
    await this.resources.waitForReady();

    await this.renderer.initialize();

    const spaceShip = new SpaceShip();
    const floor = new Floor(200);
    const rocks = new Rocks(new THREE.Vector3(0, 0, 0));
    const area = new Area();
    const planet = new Planet(new THREE.Vector3(0, 4, 0));
    const atmosphere = new Atmosphere(new THREE.Vector3(0, 4, 0));
    const land = new Land(new THREE.Vector3(0, 0, 0));
    const engineFlame = new EngineFlame(new THREE.Vector3(0, 2, 5));

    // this.addGameObject(spaceShip);
    // this.addGameObject(floor);
    // this.addGameObject(rocks);
    this.addGameObject(area);
    // this.addGameObject(planet);
    // this.addGameObject(atmosphere);
    // this.addGameObject(land);
    this.addGameObject(engineFlame);

    const context = this.getContext();
    await this.camera.initialize(context);
    this.setPasses();

    for (const obj of this.gameObjects) {
      await obj.initialize?.(context);
    }

    this.setupInputSystem();
    this.setupEnvironment();
    this.setupEvents();

    this.isInitialized = true;
  }

  start() {
    if (!this.isInitialized) {
      throw new Error("Game must be initialized before starting");
    }
    this.time.startGameLoop();
  }

  private setupEnvironment() {
    // HDR 환경 설정, 조명 등
    // 기존 main.ts의 환경 설정 코드를 여기로 이동
  }

  private setupInputSystem() {
    const movementProcessor = new Vector2Processor("movement", {
      upKey: "KeyW",
      downKey: "KeyS",
      leftKey: "KeyA",
      rightKey: "KeyD",
    });
    this.inputManager.addProcessor(movementProcessor);

    // 플레이어 비행 액션 매퍼 등록
    // 현재 등록되어 있는 FlightActionMapper 에는 KeyWASD 기반 움직임이 포함되어 있음
    // 필요시 별도의 매퍼를 만들어 등록 가능
    const flightMapper = new FlightActionMapper();
    this.inputManager.addActionMapper(flightMapper);
  }

  private setupEvents() {
    this.time.on("tick", () => this.update());
    this.size.on("resize", () => this.resize());
  }

  private update() {
    const deltaTime = this.time.delta;
    this.inputManager.update();
    this.physics.step();
    // 등록되어 있는 모든 게임 오브젝트와 컨트롤러 업데이트(ex, 우주선, 카메라 등)
    this.gameObjects.forEach((obj) => obj.update(deltaTime));
    this.controllers.forEach((controller) => {
      if (controller.enabled) {
        controller.update();
      }
    });

    this.camera.orbitControls?.update(deltaTime);
    this.physics.update();

    if (this.passes) {
      this.passes.horizontalBlurPass.enabled =
        this.passes.horizontalBlurPass.material.uniforms.uStrength.value.x > 0;
      this.passes.verticalBlurPass.enabled =
        this.passes.verticalBlurPass.material.uniforms.uStrength.value.y > 0;

      this.passes.composer.render();
    }
  }

  private resize() {
    this.controllers.forEach((controller) => controller.update?.());
  }
}
