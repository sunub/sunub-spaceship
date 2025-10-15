import type { FolderApi } from "tweakpane";
import type { CameraConfig } from "../types";
import type { PerspectiveCamera } from "three/webgpu";

/**
 * 📷 Camera Parameters Debug Module
 * 카메라 기본 파라미터(FOV, Near, Far) 실시간 조정 담당
 */
export class CameraParametersDebugModule {
  constructor(
    private camera: PerspectiveCamera,
    private cameraParams: CameraConfig
  ) {}

  /**
   * Camera Parameters 관련 디버그 컨트롤 설정
   */
  setupDebugControls(parentFolder: FolderApi): void {
    const cameraParamsFolder = parentFolder.addFolder({
      title: "📷 Camera Parameters",
      expanded: true,
    });

    cameraParamsFolder
      .addBinding(this.cameraParams, "fov", {
        min: 1,
        max: 180,
        step: 1,
        label: "Field of View",
      })
      .on("change", (ev) => {
        this.camera.fov = ev.value;
        this.camera.updateProjectionMatrix();
      });

    cameraParamsFolder
      .addBinding(this.cameraParams, "near", {
        min: 0.01,
        max: 10.0,
        step: 0.01,
        label: "Near Plane",
      })
      .on("change", (ev) => {
        this.camera.near = ev.value!;
        this.camera.updateProjectionMatrix();
      });

    cameraParamsFolder
      .addBinding(this.cameraParams, "far", {
        min: 10.0,
        max: 10000.0,
        step: 10.0,
        label: "Far Plane",
      })
      .on("change", (ev) => {
        this.camera.far = ev.value!;
        this.camera.updateProjectionMatrix();
      });
  }
}
