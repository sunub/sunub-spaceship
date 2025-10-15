import { Vector3 } from "three/webgpu";
import type { FolderApi } from "tweakpane";
import type { CameraConfig } from "../types";
import type { PerspectiveCamera } from "three/webgpu";

/**
 * 🎯 Camera Target Debug Module
 * 카메라 타겟 위치 실시간 조정 담당
 */
export class CameraTargetDebugModule {
  constructor(
    private camera: PerspectiveCamera,
    private cameraParams: CameraConfig
  ) {}

  /**
   * Camera Target 관련 디버그 컨트롤 설정
   */
  setupDebugControls(parentFolder: FolderApi): void {
    const targetFolder = parentFolder.addFolder({
      title: "🎯 Camera Target",
      expanded: true,
    });

    targetFolder
      .addBinding(this.cameraParams, "targetX", {
        min: -5,
        max: 5,
        step: 0.1,
        label: "TargetX",
      })
      .on("change", (ev) => {
        this.camera.lookAt(
          new Vector3(
            ev.value,
            this.cameraParams.targetY,
            this.cameraParams.targetZ
          )
        );
      });
      
    targetFolder
      .addBinding(this.cameraParams, "targetY", {
        min: -5,
        max: 5,
        step: 0.1,
        label: "TargetY",
      })
      .on("change", (ev) => {
        this.camera.lookAt(
          new Vector3(
            this.cameraParams.targetX,
            ev.value,
            this.cameraParams.targetZ
          )
        );
      });
      
    targetFolder
      .addBinding(this.cameraParams, "targetZ", {
        min: -5,
        max: 5,
        step: 0.1,
        label: "TargetZ",
      })
      .on("change", (ev) => {
        this.camera.lookAt(
          new Vector3(
            this.cameraParams.targetX,
            this.cameraParams.targetY,
            ev.value
          )
        );
      });
  }
}
