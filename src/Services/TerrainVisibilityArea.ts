import {
    BoxGeometry,
    Mesh,
    MeshBasicNodeMaterial,
    Plane,
    Raycaster,
    Vector2,
    Vector3,
    TorusGeometry,
} from "three/webgpu"
import { inject, injectable } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Camera } from "@/Camera"
import type { Scene } from "@/core/Scene"
import { TweakPane } from "@/Debug/TweakPane"
import type { IGameObject } from "@/Services/IGameObject"

@injectable()
export class TerrainVisibilityArea implements IGameObject {
    public readonly center = new Vector3()
    public radius = 200
    public isDebugVisible = false

    private readonly floorPlane = new Plane(new Vector3(0, 1, 0), 0)
    private readonly raycaster = new Raycaster()
    private readonly nearLeft = new Vector3()
    private readonly nearRight = new Vector3()
    private readonly farLeft = new Vector3()
    private readonly farRight = new Vector3()
    private readonly tempVec3 = new Vector3()
    private readonly tempVec3B = new Vector3()

    private debugGroup: Mesh[] = []
    private centerMarker!: Mesh
    private radiusMarker!: Mesh
    private currentCenter = new Vector3()
    private currentRadius = 0

    private debugParams = {
        visible: false,
        areaColor: "#00ff00",
        offsetY: 0.1,
        radiusMultiplier: 1.0,
    }

    constructor(
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Scene) private scene: Scene
    ) {}

    public async initialize() {
        this.createDebugMeshes()
        this.setupTweakPane()
    }

    public update(_delta: number): void {
        this.calculateVisibility()
        this.updateDebugVisuals()
    }

    private calculateVisibility() {
        if (!this.camera.instance) {
            return
        }

        const camera = this.camera.instance

        // 1. Calculate Frustum Corners on Floor
        // normalized device coordinates: (-1, -1) is bottom-left, (1, 1) is top-right
        // Using slightly smaller bounds to keep grass strictly within view if desired, but standard -1~1 is fine
        this.intersectFloor(-1, -1, camera, this.nearLeft)
        this.intersectFloor(1, -1, camera, this.nearRight)

        // Far Plane Corners
        this.intersectFloor(-1, 0.5, camera, this.farLeft) // Use 0.5 Y for horizon avoidance or full 1.0
        this.intersectFloor(1, 0.5, camera, this.farRight)

        // 2. Calculate Center
        // Approximate center by averaging the four corners
        // Or better, average of the diagonal centers to weight it properly
        const centerNear = this.tempVec3.copy(this.nearLeft).lerp(this.nearRight, 0.5)
        const centerFar = this.tempVec3B.copy(this.farLeft).lerp(this.farRight, 0.5)

        this.currentCenter.copy(centerNear).lerp(centerFar, 0.5)

        // Flatten Y to 0 (just in case)
        this.currentCenter.y = 0

        // 3. Calculate Radius
        // Radius should cover the furthest point from the center
        const distFarLeft = this.currentCenter.distanceTo(this.farLeft)
        const distFarRight = this.currentCenter.distanceTo(this.farRight)
        const distNearLeft = this.currentCenter.distanceTo(this.nearLeft)
        const distNearRight = this.currentCenter.distanceTo(this.nearRight)

        // Safety: ensure a minimum radius
        this.currentRadius = Math.max(distFarLeft, distFarRight, distNearLeft, distNearRight, 15.0)

        // Apply debug multiplier
        this.currentRadius *= this.debugParams.radiusMultiplier

        // Smoothly update public values (optional, can be direct)
        this.center.copy(this.currentCenter)
        this.radius = this.currentRadius
    }

    private intersectFloor(ndcX: number, ndcY: number, camera: any, target: Vector3) {
        this.raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera)

        // Check intersection with the infinite floor plane
        const intersection = this.raycaster.ray.intersectPlane(this.floorPlane, target)

        // If looking at sky (no intersection), project far away on the floor
        if (!intersection) {
            // Fallback: This is tricky if the horizon is visible.
            // For isometric-like games, it usually hits.
            // If it doesn't hit, we project a point at some max distance on the ray projected to XZ plane.
            const fallbackDist = 300
            target.copy(this.raycaster.ray.origin)
                  .add(this.raycaster.ray.direction.multiplyScalar(fallbackDist))
            target.y = 0
        }
    }

    private createDebugMeshes() {
        // 1. Center Marker
        this.centerMarker = new Mesh(
            new BoxGeometry(1, 4, 1),
            new MeshBasicNodeMaterial({ color: this.debugParams.areaColor, wireframe: true })
        )
        this.centerMarker.visible = false
        this.centerMarker.frustumCulled = false

        // 2. Radius Marker (Ring)
        this.radiusMarker = new Mesh(
            new TorusGeometry(1, 0.05, 32, 100).rotateX(Math.PI / 2),
            new MeshBasicNodeMaterial({ color: this.debugParams.areaColor, transparent: true, opacity: 0.5 })
        )
        this.radiusMarker.visible = false
        this.radiusMarker.frustumCulled = false

        this.scene.add(this.centerMarker)
        this.scene.add(this.radiusMarker)

        this.debugGroup = [this.centerMarker, this.radiusMarker]
    }

    private updateDebugVisuals() {
        // Toggle visibility based on params
        if (this.centerMarker.visible !== this.debugParams.visible) {
             this.debugGroup.forEach(m => m.visible = this.debugParams.visible)
        }

        if (!this.debugParams.visible) return

        // Update Center
        this.centerMarker.position.copy(this.center)
        this.centerMarker.position.y = this.debugParams.offsetY + 2 // Raise it up a bit

        // Update Radius
        this.radiusMarker.position.copy(this.center)
        this.radiusMarker.position.y = this.debugParams.offsetY

        // Scale the torus to match radius.
        // Torus created with radius 1. So scale * radius = actual radius.
        const scale = Math.max(0.1, this.radius)
        this.radiusMarker.scale.set(scale, 1, scale)
    }

    private setupTweakPane() {
        const urlParams = new URLSearchParams(window.location.search)
        if (urlParams.get("debug") !== "view") return

        this.debugParams.visible = true // Auto-show if URL param is present

        const pane = TweakPane.getInstance()
        const folder = pane.addFolder({
            title: "👁️ Terrain Visibility",
            expanded: true,
        })

        folder.addBinding(this.debugParams, "visible", { label: "Show Gizmo" })
        folder.addBinding(this.debugParams, "areaColor", { label: "Area Color" }).on("change", (ev) => {
            (this.centerMarker.material as any).color.set(ev.value);
            (this.radiusMarker.material as any).color.set(ev.value);
        })

        folder.addBinding(this.debugParams, "radiusMultiplier", {
            min: 0.5,
            max: 3.0,
            step: 0.1,
            label: "Radius Multiplier",
        })

        folder.addBinding(this, "radius", {
            readonly: true,
            label: "Current Radius",
            format: (v) => v.toFixed(2)
        })

        folder.addBinding(this.center, "x", { readonly: true, label: "Center X", format: (v) => v.toFixed(2) })
        folder.addBinding(this.center, "z", { readonly: true, label: "Center Z", format: (v) => v.toFixed(2) })
    }
}
