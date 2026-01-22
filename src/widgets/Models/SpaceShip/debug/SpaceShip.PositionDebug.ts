import type * as RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three/webgpu"
import type { FolderApi } from "tweakpane"

export interface SpaceShipPositionDebugContext {
    rigidBody: RAPIER.RigidBody | null
    shipPivot: THREE.Object3D | null
    mesh: THREE.Object3D | null
}

export class SpaceShipPositionDebugModule {
    constructor(private getContext: () => SpaceShipPositionDebugContext) {}

    setupDebugControls(parentFolder: FolderApi): void {
        this.setupPositionDebugButton(parentFolder)
        this.setupRotationInfoButton(parentFolder)
    }

    private setupPositionDebugButton(parentFolder: FolderApi): void {
        parentFolder.addButton({ title: "Position Debug" }).on("click", () => {
            const { rigidBody, shipPivot, mesh } = this.getContext()

            if (rigidBody && shipPivot && mesh) {
                const physicsPos = rigidBody.translation()
                console.log(
                    "🔵 Physics Body Position:",
                    physicsPos.x.toFixed(2),
                    physicsPos.y.toFixed(2),
                    physicsPos.z.toFixed(2),
                )
                console.log(
                    "🟢 Ship Pivot Position:",
                    shipPivot.position.x.toFixed(2),
                    shipPivot.position.y.toFixed(2),
                    shipPivot.position.z.toFixed(2),
                )
                console.log(
                    "🟡 Ship Mesh Local Position:",
                    mesh.position.x.toFixed(2),
                    mesh.position.y.toFixed(2),
                    mesh.position.z.toFixed(2),
                )
                console.log(
                    "📏 Altitude (Height):",
                    physicsPos.y.toFixed(2),
                    "meters",
                )

                const worldPos = new THREE.Vector3()
                mesh.getWorldPosition(worldPos)
            } else {
                console.warn("⚠️ Position Debug: Required objects not available")
            }
        })
    }

    private setupRotationInfoButton(parentFolder: FolderApi): void {
        parentFolder.addButton({ title: "Rotation Info" }).on("click", () => {
            const { rigidBody, mesh } = this.getContext()

            if (mesh && rigidBody) {
                const rotation = rigidBody.rotation()
                const euler = new THREE.Euler().setFromQuaternion(
                    new THREE.Quaternion(
                        rotation.x,
                        rotation.y,
                        rotation.z,
                        rotation.w,
                    ),
                )
                console.log(
                    "🔄 Roll (Przechylenie):",
                    THREE.MathUtils.radToDeg(euler.z).toFixed(2),
                    "°",
                )
                console.log(
                    "🔄 Yaw (Odchylenie):",
                    THREE.MathUtils.radToDeg(euler.y).toFixed(2),
                    "°",
                )
                console.log(
                    "🔄 Pitch (Pochylenie):",
                    THREE.MathUtils.radToDeg(euler.x).toFixed(2),
                    "°",
                )
            } else {
                console.warn("⚠️ Rotation Info: Required objects not available")
            }
        })
    }
}
