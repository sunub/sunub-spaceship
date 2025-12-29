import type { FolderApi } from "tweakpane"
import { ServiceRegistry } from "@/core/ServiceRegistry"

/**
 * 🎥 SpaceShip Camera Debug Module
 * 카메라 제어 관련 디버깅 담당
 */
export class SpaceShipCameraDebugModule {
	/**
	 * Camera 관련 디버그 컨트롤 설정
	 */
	setupDebugControls(parentFolder: FolderApi): void {
		const cameraFolder = parentFolder.addFolder({
			title: "Camera Control",
			expanded: true,
		})

		cameraFolder
			.addButton({ title: "Toggle Orbit Controller" })
			.on("click", () => {
				const game = ServiceRegistry.getInstance().get<any>("game")
				const orbitController = game?.getOrbitController?.()
				if (orbitController) {
					const newState = !orbitController.enabled
					game.enableOrbitController(newState)
					console.log(
						`🎥 OrbitController: ${newState ? "ON (Free Camera)" : "OFF (Ship Tracking)"}`,
					)
				} else {
					console.warn(
						"⚠️ Camera Debug: OrbitController not available",
					)
				}
			})
	}
}
