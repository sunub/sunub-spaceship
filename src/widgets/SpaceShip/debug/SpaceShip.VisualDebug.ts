import * as THREE from "three";
import type { FolderApi } from "tweakpane";

export interface SpaceShipVisualDebugContext {
  showAxes: boolean;
  axesHelper: THREE.AxesHelper | null;
  rollAxisHelper: THREE.ArrowHelper | null;
  yawAxisHelper: THREE.ArrowHelper | null;
  pitchAxisHelper: THREE.ArrowHelper | null;
  toggleAxesVisibility: () => void;
}

/**
 * 👁️ SpaceShip Visual Debug Module
 * 시각적 디버깅 요소들(축 시각화 등) 담당
 */
export class SpaceShipVisualDebugModule {
  constructor(private getContext: () => SpaceShipVisualDebugContext) {}

  /**
   * Visual 관련 디버그 컨트롤 설정
   */
  setupDebugControls(parentFolder: FolderApi): void {
    const axesFolder = parentFolder.addFolder({ title: "Flight Axes Debug", expanded: true });
    
    axesFolder.addButton({ title: "Toggle Axes" }).on("click", () => {
      const context = this.getContext();
      context.toggleAxesVisibility();
      console.log("🎯 Axes Visibility:", context.showAxes ? "ON" : "OFF");
    });
  }
}
