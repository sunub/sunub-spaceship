// import { PerspectiveCamera, Vector3 } from "three/webgpu";
// import CameraControls from 'camera-controls';
// import * as THREE from "three/webgpu";
// import type { IController, GameContext } from "../../../core/GameContext";
// import {
//   CameraMode,
//   type CameraState,
//   type CameraSettings
// } from "../types";
// import type { CameraTransitionConfig } from "./types/CameraAnimation";

// /**
//  * AdaptiveCameraController - Advanced camera system that adapts to different flight scenarios
//  *
//  * Features:
//  * - Multiple camera modes (Free, Follow, Cockpit, Cinematic, Orbit)
//  * - Smooth transitions between modes using camera-controls
//  * - Integration with existing ServiceRegistry and GameContext
//  * - Performance optimized for 60fps
//  *
//  * Based on analysis of folio-2019 camera system with modern TypeScript architecture
//  */
// export class AdaptiveCameraController implements IController {
//   // WASD 입력 상태 추적
//   private _isFollowingTarget: boolean = false;
//   public enabled: boolean = true;

//   private _context!: GameContext; // Will be used in future phases
//   private _camera: PerspectiveCamera;
//   private _cameraControls: CameraControls;
//   private _currentMode: CameraMode = CameraMode.FOLLOW;
//   private _targetObject: THREE.Object3D | null = null;
//   private _isTransitioning: boolean = false;

//   // Camera state tracking
//   private _state: CameraState = {
//     mode: CameraMode.FOLLOW,
//     position: new Vector3(0, 5, -8),
//     target: new Vector3(0, 1, 0),
//     isTransitioning: false,
//     transitionProgress: 0
//   };

//   // Default settings for Follow mode only
//   private _followModeSettings: CameraSettings = {
//     enableDamping: true,
//     dampingFactor: 0.08,
//     enableZoom: true,
//     enableRotate: true,
//     enablePan: false,
//     minDistance: 14,  // folio-2019와 같은 최소 거리
//     maxDistance: 29,  // minDistance + amplitude
//     maxPolarAngle: Math.PI * 0.45, // 더 제한된 각도로 조감뷰 유지
//     smoothTime: 0.4,
//     followOffset: new Vector3(8, 10, 8), // 바닥 위에서 측면이 보이도록 수정
//     followLookAhead: 2.0
//   };

//   constructor(camera: PerspectiveCamera, domElement: HTMLElement) {
//     this._camera = camera;

//     // Initialize camera-controls with Three.js subobjects
//     CameraControls.install({ THREE: THREE });
//     this._cameraControls = new CameraControls(camera, domElement);

//     this.applyFollowModeSettings();
//     this.setupEventHandlers();
//   }

//   /**
//    * Initialize the controller with game context
//    */
//   async initialize(context: GameContext): Promise<void> {
//     this._context = context;

//     // Set initial camera position based on settings (context-based default position)
//     const offset = this._followModeSettings.followOffset || new Vector3(8, 12, 8);
//     this._camera.position.copy(offset);
//     // Look at origin (0, 0, 0) to match setTarget behavior and prevent unnecessary camera movement

//     // Initial camera state
//     this.updateState();
//   }

//   /**
//    * Update camera controls - called every frame
//    * IController requires () => void, so we adapt the signature
//    */
//   update(): void {
//     if (!this.enabled) return;

//     const deltaTime = 0.016; // Approximate 60fps frame time
//     const hasUpdated = this._cameraControls.update(deltaTime);

//     if (hasUpdated) {
//       this.updateState();
//       // WASD 입력이 있을 때만 자동 추적
//       if (this._isFollowingTarget) {
//         this.handleModeSpecificUpdate(deltaTime);
//       }
//     }
//   }

//   /**
//    * Set camera mode - only Follow mode is supported
//    */
//   async setMode(mode: CameraMode, config?: CameraTransitionConfig): Promise<void> {
//     // Only accept Follow mode
//     if (mode !== CameraMode.FOLLOW) {
//       console.warn(`Only Follow mode is supported. Ignoring mode: ${mode}`);
//       return;
//     }

//     if (this._currentMode === mode || this._isTransitioning) {
//       return;
//     }

//     this._isTransitioning = true;
//     this._state.isTransitioning = true;

//     console.log(`🎬 Activating Follow camera mode`);

//     try {
//       // Apply Follow mode settings
//       this.applyFollowModeSettings();

//       // Handle Follow mode setup
//       await this.transitionToFollowMode(config?.duration || 1.0);

//       // Update current mode
//       this._currentMode = CameraMode.FOLLOW;
//       this._state.mode = CameraMode.FOLLOW;

//       console.log(`✅ Follow camera mode activated`);

//     } catch (error) {
//       console.error(`Failed to activate Follow mode:`, error);
//     } finally {
//       this._isTransitioning = false;
//       this._state.isTransitioning = false;
//       this._state.transitionProgress = 1.0;
//     }
//   }

//   /**
//    * Set target object for follow and orbit modes
//    */
//   /**
//    * setTarget - 타겟 지정 및 카메라 위치 이동
//    * @param target 타겟 오브젝트
//    * @param options { immediate?: boolean } - true면 트랜지션 없이 즉시 이동
//    */
//   setTarget(target: THREE.Object3D | null, options?: { immediate?: boolean }): void {
//     this._targetObject = target;
//     if (target) {
//       const offset = this._followModeSettings.followOffset || new Vector3(8, 12, 8);
//       const followPosition = target.position.clone().add(offset);
//       // 최초 진입 시에는 트랜지션 없이 바로 이동
//       this._cameraControls.setTarget(
//         target.position.x,
//         target.position.y,
//         target.position.z,
//         !(options?.immediate) // immediate=true면 enableTransition=false
//       );
//       this._cameraControls.setPosition(
//         followPosition.x,
//         followPosition.y,
//         followPosition.z,
//         !(options?.immediate)
//       );
//     }
//     console.log(`🎯 Camera target changed:`, target?.name || 'null');
//   }

//   /**
//    * Get current camera state
//    */
//   getState(): Readonly<CameraState> {
//     return { ...this._state };
//   }

//   /**
//    * Get current camera mode
//    */
//   getCurrentMode(): CameraMode {
//     return this._currentMode;
//   }

//   /**
//    * Check if camera is currently transitioning
//    */
//   isTransitioning(): boolean {
//     return this._isTransitioning;
//   }

//   /**
//    * Apply Follow mode settings
//    */
//   private applyFollowModeSettings(): void {
//     const settings = this._followModeSettings;
//     // camera-controls 기본 세팅
//     this._cameraControls.smoothTime = settings.smoothTime;
//     this._cameraControls.minDistance = settings.minDistance;
//     this._cameraControls.maxDistance = settings.maxDistance;
//     this._cameraControls.maxPolarAngle = settings.maxPolarAngle;

//     // 마우스/터치 입력 활성화 (회전, 줌, 패닝)
//     this._cameraControls.mouseButtons = {
//       left: CameraControls.ACTION.ROTATE,
//       middle: CameraControls.ACTION.ZOOM,
//       right: CameraControls.ACTION.TRUCK,
//       wheel: CameraControls.ACTION.ZOOM
//     };
//     this._cameraControls.touches = {
//       one: CameraControls.ACTION.TOUCH_ROTATE,
//       two: CameraControls.ACTION.TOUCH_TRUCK,
//       three: CameraControls.ACTION.TOUCH_DOLLY_TRUCK
//     };

//     // 전체 컨트롤 활성화
//     this._cameraControls.enabled = true;

//     console.log(`📐 Applied Follow mode settings:`, settings);
//   }

//   private async transitionToFollowMode(_duration: number): Promise<void> {
//     if (!this._targetObject) {
//       console.warn("No target object set for follow mode");
//       return;
//     }

//     const settings = this._followModeSettings;
//     const offset = settings.followOffset || new Vector3(8, 12, 8);

//     // Position camera above floor to see target's side view
//     const targetPosition = this._targetObject.position.clone().add(offset);

//     return this._cameraControls.setPosition(
//       targetPosition.x,
//       targetPosition.y,
//       targetPosition.z,
//       true // enableTransition
//     );
//   }

//   /**
//    * Handle Follow mode updates called every frame
//    */
//   private handleModeSpecificUpdate(deltaTime: number): void {
//   // Only Follow mode is supported
//   this.updateFollowMode(deltaTime);
//   }

//   private updateFollowMode(_deltaTime: number): void {
//     if (!this._targetObject) return;
//     // 자동 추적이 활성화된 경우에만 동작
//     if (!this._isFollowingTarget) return;

//     const settings = this._followModeSettings;
//     const lookAhead = settings.followLookAhead || 2.0;
//     const easing = 0.15;

//     // Update target position with look-ahead
//     const velocity = this._targetObject.userData.velocity || new Vector3();
//     const predictedPosition = this._targetObject.position.clone().add(
//       velocity.clone().multiplyScalar(lookAhead)
//     );

//     // Apply easing similar to folio-2019
//     const currentTarget = this._cameraControls.getTarget(new Vector3());
//     const easedTarget = new Vector3(
//       currentTarget.x + (predictedPosition.x - currentTarget.x) * easing,
//       currentTarget.y + (predictedPosition.y - currentTarget.y) * easing,
//       currentTarget.z + (predictedPosition.z - currentTarget.z) * easing
//     );

//     this._cameraControls.setTarget(
//       easedTarget.x,
//       easedTarget.y,
//       easedTarget.z,
//       false
//     );

//     // Maintain position above floor with side view of the spaceship
//     const offset = settings.followOffset || new Vector3(8, 12, 8);
//     const idealPosition = easedTarget.clone().add(offset);

//     // Apply easing to camera position as well
//     const currentPosition = this._camera.position;
//     const easedPosition = new Vector3(
//       currentPosition.x + (idealPosition.x - currentPosition.x) * easing,
//       currentPosition.y + (idealPosition.y - currentPosition.y) * easing,
//       currentPosition.z + (idealPosition.z - currentPosition.z) * easing
//     );

//     this._cameraControls.setPosition(
//       easedPosition.x,
//       easedPosition.y,
//       easedPosition.z,
//       false
//     );
//   }

//   /**
//    * Update internal camera state
//    */
//   private updateState(): void {
//     this._state.position.copy(this._camera.position);
//     this._state.target.copy(this._cameraControls.getTarget(new Vector3()));
//     this._state.mode = this._currentMode;
//   }

//   /**
//    * Setup event handlers for camera-controls
//    */
//   private setupEventHandlers(): void {
//     this._cameraControls.addEventListener('controlstart', () => {
//     });

//     this._cameraControls.addEventListener('control', () => {
//       this.updateState();
//     });

//     this._cameraControls.addEventListener('controlend', () => {
//     });
//   }

//   /**
//    * 외부에서 WASD 입력 상태를 전달받아 자동 추적 on/off
//    */
//   public setFollowingTarget(isFollowing: boolean) {
//     this._isFollowingTarget = isFollowing;
//   }

//   /**
//    * Dispose of resources
//    */
//   dispose(): void {
//     this._cameraControls.dispose();
//   }
// }
