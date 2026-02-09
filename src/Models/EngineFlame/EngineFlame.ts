import { BoxGeometry, Group, Mesh, Vector3 } from "three/webgpu"
import { TweakPane } from "@/Debug/TweakPane"
import { EngineFlameMaterial } from "./Shader/EngineFlameMaterial"
import type Time from "@/utils/Time"
import type { Camera } from "@/Camera/instances/Camera"

export class EngineFlame {
    public modelGroup: Group
    private mesh: Mesh | null = null
    private material: EngineFlameMaterial | null = null

    private time: Time | null = null
    private camera: Camera | null = null

    constructor(position: Vector3 = new Vector3(0, 2, 0)) {
        this.modelGroup = new Group()
        this.modelGroup.position.copy(position)
    }

    // Initialize without GameContext. Pass dependencies directly.
    // Conforms to loose interpretation of IGameObject or stand-alone usage.
    async initialize(time: Time, camera: Camera): Promise<void> {
        this.time = time
        this.camera = camera

        // Temporary fix for WebGPU compatibility
        this.material = new EngineFlameMaterial()

        const geometry = new BoxGeometry(1.0, 10.0, 1.0)

        this.mesh = new Mesh(geometry, this.material)
        this.mesh.scale.set(0.3, 0.5, 0.4)
        // this.mesh.rotation.x = Math.PI / 2; // 회전 제거 혹은 필요시 로컬 회전만 적용

        this.modelGroup.add(this.mesh)
        this.mesh.frustumCulled = false
    }

    public setupTweakPane() {
        if (!this.material) return

        const pane = TweakPane.getInstance()
        const f = pane.addFolder({
            title: "Engine Flame Material",
            expanded: true,
        })

        // Main Color
        f.addBinding(this.material.uMainColor, "value", {
            label: "Main Color",
            color: { type: "float" }, // 필요시 타입 명시
        })

        // Base Color
        f.addBinding(this.material.uBaseColor, "value", {
            label: "Base Color",
            color: { type: "float" },
        })

        // Thrust (number 타입 Uniform)
        // UniformNode 객체의 'value' 키를 바인딩합니다.
        f.addBinding(this.material.uThrust, "value", {
            min: 0,
            max: 1,
            step: 0.01,
            label: "Thrust",
        })

        // Flame Length
        f.addBinding(this.material.uFlameLength, "value", {
            min: 0,
            max: 2.0,
            step: 0.01,
            label: "Flame Length",
        })

        // Transform 바인딩 (기존 유지)
        f.addBinding(this.modelGroup.rotation, "x", {
            min: -Math.PI,
            max: Math.PI,
            step: 0.01,
            label: "Rotation X",
        })
        f.addBinding(this.modelGroup.rotation, "y", {
            min: -Math.PI,
            max: Math.PI,
            step: 0.01,
            label: "Rotation Y",
        })
        f.addBinding(this.modelGroup.rotation, "z", {
            min: -Math.PI,
            max: Math.PI,
            step: 0.01,
            label: "Rotation Z",
        })

        f.addBinding(this.modelGroup.position, "x", {
            min: -10,
            max: 10,
            step: 0.01,
            label: "Position X",
        })
        f.addBinding(this.modelGroup.position, "y", {
            min: -10,
            max: 10,
            step: 0.01,
            label: "Position Y",
        })
        f.addBinding(this.modelGroup.position, "z", {
            min: -10,
            max: 10,
            step: 0.01,
            label: "Position Z",
        })

        f.addBinding(this.modelGroup.scale, "x", {
            min: 0,
            max: 2,
            step: 0.01,
            label: "Scale X",
        })
        f.addBinding(this.modelGroup.scale, "y", {
            min: 0,
            max: 2,
            step: 0.01,
            label: "Scale Y",
        })
        f.addBinding(this.modelGroup.scale, "z", {
            min: 0,
            max: 2,
            step: 0.01,
            label: "Scale Z",
        })
    }

    public setColor(mainColor: string | number, baseColor?: string | number) {
        if (this.material) {
            this.material.uMainColor.value.set(mainColor)

            if (baseColor) {
                this.material.uBaseColor.value.set(baseColor)
            }
        }
    }

    public setThrust(level: number) {
        if (this.material) {
            this.material.uThrust.value = level
        }
    }

    public setFlameLength(length: number) {
        if (this.material) {
            this.material.uFlameLength.value = length
        }
    }

    public update(_deltaTime: number): void {
        if (this.time && this.material && this.camera && this.camera.instance) {
            const elapsedTime = this.time.elapsed * 0.001

            this.material.uTime.value = elapsedTime

            if (this.mesh) {
                this.mesh.updateWorldMatrix(true, false)

                const cameraWorldPos = this.camera.instance.position.clone()
                const worldToLocal = this.mesh.matrixWorld.clone().invert()

                const cameraLocalPos = cameraWorldPos.applyMatrix4(worldToLocal)

                this.material.uLocalCameraPos.value.copy(cameraLocalPos)
            }
        }
    }

    dispose(): void {
        // Since we didn't add to scene directly, we just dispose geometry/material.
        // Parent (SpaceShip) removes modelGroup from its pivot.
        if (this.mesh) {
            this.mesh.geometry.dispose()
        }
        this.material?.dispose()
        this.mesh = null
        this.material = null
        this.time = null
        this.camera = null
    }
}
