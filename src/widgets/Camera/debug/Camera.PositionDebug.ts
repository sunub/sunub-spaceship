import type { FolderApi } from "tweakpane";
import type { CameraConfig } from "../types";
import type { PerspectiveCamera } from "three/webgpu";

/**
 * 📍 Camera Position Debug Module
 * 카메라 위치 실시간 조정 담당
 */
export class CameraPositionDebugModule {
  constructor(
    private camera: PerspectiveCamera,
    private cameraParams: CameraConfig
  ) {}

  /**
   * Camera Position 관련 디버그 컨트롤 설정
   */
  setupDebugControls(parentFolder: FolderApi): void {
    const positionFolder = parentFolder.addFolder({
      title: "📍 Camera Position",
      expanded: true,
    });

    positionFolder
      .addBinding(this.cameraParams, "position", {
        label: "Position",
      })
      .on("change", (ev) => {
        this.camera.position.set(ev.value.x, ev.value.y, ev.value.z);
        this.camera.updateProjectionMatrix();
      });
  }
}
