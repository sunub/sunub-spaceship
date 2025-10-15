import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { ServiceRegistry } from "../core/ServiceRegistry";
import type { GameContext, IGameObject, IController } from "../core/GameContext";
import Resources from "../utils/Resources";
import sources from "../sources";

import { Physics } from "./Physics";
import { Scene } from "./Scene";
import { Renderer } from "./Renderer";
import { Size } from "../utils/Size";
import Time from "../utils/Time";
import { Camera } from "./Camera";
import { Debug } from "./Debug";
import { OrbitController } from "./OrbitController";
import { Floor } from "./Floor";
import { Rocks, CrystalStand, SpaceShip } from "./models";
import { InputManager } from "../Inputs/InputManager";
import { Vector2Processor } from "../Inputs/processors/Vector2Processor";
import { FlightActionMapper } from "../Inputs/mappers/FlightActionMapper";

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
  private orbitController: OrbitController | null = null;
  private isInitialized = false;

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
  
  private registerAllServices() {
    const registry = ServiceRegistry.getInstance();
    registry.register('game', this);
    registry.register('debug', this.debug);
    registry.register('time', this.time);
    registry.register('size', this.size);
    registry.register('scene', this.scene);
    registry.register('camera', this.camera);
    registry.register('physics', this.physics);
    registry.register('inputManager', this.inputManager);
    registry.register('resources', this.resources);
  }
  
  private registerRenderer() {
    const registry = ServiceRegistry.getInstance();
    registry.register('renderer', this.renderer);
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
      resources: this.resources
    };
  }
  
  getService<T>(key: string): T {
    return ServiceRegistry.getInstance().get<T>(key);
  }

  enableOrbitController(enable: boolean): void {
    if (this.orbitController) {
      this.orbitController.enabled = enable;
    }
  }

  getOrbitController(): OrbitController | null {
    return this.orbitController;
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    await RAPIER.init();
    await this.physics.initialize();
    
    // 리소스 로딩 완료까지 대기
    await this.resources.waitForReady();
    
    await this.renderer.initialize();
    
    const spaceShip = new SpaceShip();
    const floor = new Floor();
    const rocks = new Rocks(new THREE.Vector3(0, 0, 0), true); // Enable instance mode with 50 rocks
    this.orbitController = new OrbitController(this.camera, this.renderer.domElement);
    
    this.addGameObject(spaceShip);
    this.addGameObject(floor);
    this.addGameObject(rocks);
    this.addController(this.orbitController);
    
    const context = this.getContext();
    await this.camera.initialize(context);
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
      throw new Error('Game must be initialized before starting');
    }
    // 모든 초기화가 완료된 후에만 게임 루프 시작
    this.time.startGameLoop();
  }
  
  private setupEnvironment() {
    // HDR 환경 설정, 조명 등
    // 기존 main.ts의 환경 설정 코드를 여기로 이동
  }
  
  private setupInputSystem() {
    const movementProcessor = new Vector2Processor('movement', {
      upKey: 'KeyW',
      downKey: 'KeyS',
      leftKey: 'KeyA',
      rightKey: 'KeyD'
    });
    this.inputManager.addProcessor(movementProcessor);
    
    // 플레이어 비행 액션 매퍼 등록
    // 현재 등록되어 있는 FlightActionMapper 에는 KeyWASD 기반 움직임이 포함되어 있음
    // 필요시 별도의 매퍼를 만들어 등록 가능
    const flightMapper = new FlightActionMapper();
    this.inputManager.addActionMapper(flightMapper);
  }
  
  private setupEvents() {
    this.time.on('tick', () => this.update());
    this.size.on('resize', () => this.resize());
  }
  
  private update() {
    const deltaTime = this.time.delta;
    
    this.inputManager.update();
    this.physics.step();
    
    // 등록되어 있는 모든 게임 오브젝트와 컨트롤러 업데이트(ex, 우주선, 카메라 등)
    this.gameObjects.forEach(obj => obj.update(deltaTime));

    // 활성화된 컨트롤러 업데이트(ex, OrbitController등)
    this.controllers.forEach(controller => {
      if (controller.enabled) {
        controller.update();
      }
    });
    
    // 물리 디버그 , 렌더링업데이트
    this.physics.update();
    this.renderer.update();
  }
  
  private resize() {
    this.controllers.forEach(controller => controller.update?.());
  }
}
