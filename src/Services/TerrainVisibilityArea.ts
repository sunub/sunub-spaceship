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
    private readonly tempNdc = new Vector2()
    private readonly nearLeft = new Vector3()
    private readonly nearRight = new Vector3()
    private readonly farLeft = new Vector3()
    private readonly farRight = new Vector3()
    private readonly topLeft = new Vector3()
    private readonly topRight = new Vector3()
    private readonly midNear = new Vector3()
    private readonly midFar = new Vector3()

    private debugGroup: Mesh[] = []
    private centerMarker!: Mesh
    private radiusMarker!: Mesh
    private currentCenter = new Vector3()
    private currentRadius = 0
    private updateAccumulator = 0
    private readonly idleUpdateInterval = 1 / 12
    private readonly minimumRadius = 25
    private readonly radiusPadding = 18
    private readonly radiusPaddingRatio = 0.22

    private debugParams = {
        visible: false,
        areaColor: "#00ff00",
        offsetY: 0.1,
        radiusMultiplier: 1.25,
    }

    constructor(
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Scene) private scene: Scene
    ) { }

    public async initialize() {
        this.createDebugMeshes()
        this.setupTweakPane()
    }

    public update(_delta: number): void {
        this.updateAccumulator += _delta
        const updateInterval = this.shouldUseRealtimeUpdates()
            ? 0
            : this.idleUpdateInterval

        if (updateInterval > 0 && this.updateAccumulator < updateInterval) {
            return
        }

        this.updateAccumulator = 0
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
        this.intersectFloor(0, -1, camera, this.midNear)

        // Far Plane Corners
        this.intersectFloor(-1, 0.25, camera, this.farLeft)
        this.intersectFloor(1, 0.25, camera, this.farRight)
        this.intersectFloor(-1, 1, camera, this.topLeft)
        this.intersectFloor(1, 1, camera, this.topRight)
        this.intersectFloor(0, 1, camera, this.midFar)

        // 2. Calculate Center
        const sampledPoints = [
            this.nearLeft,
            this.nearRight,
            this.midNear,
            this.farLeft,
            this.farRight,
            this.topLeft,
            this.topRight,
            this.midFar,
        ]

        this.currentCenter.set(0, 0, 0)
        sampledPoints.forEach((point) => {
            this.currentCenter.add(point)
        })
        this.currentCenter.divideScalar(sampledPoints.length)

        // Flatten Y to 0 (just in case)
        this.currentCenter.y = 0

        // 3. Calculate Radius
        // Radius should cover the furthest point from the center
        const maxDistance = sampledPoints.reduce((max, point) => {
            return Math.max(max, this.currentCenter.distanceTo(point))
        }, 0)

        const viewportPadding = Math.max(
            this.radiusPadding,
            maxDistance * this.radiusPaddingRatio,
            (camera.aspect - 1) * 12,
        )

        // Safety: ensure a minimum radius
        this.currentRadius = Math.max(
            maxDistance + viewportPadding,
            this.minimumRadius,
        )

        // Apply debug multiplier
        this.currentRadius *= this.debugParams.radiusMultiplier

        // Smoothly update public values (optional, can be direct)
        this.center.copy(this.currentCenter)
        this.radius = this.currentRadius
    }

    private intersectFloor(ndcX: number, ndcY: number, camera: any, target: Vector3) {
        this.tempNdc.set(ndcX, ndcY)
        this.raycaster.setFromCamera(this.tempNdc, camera)

        // Check intersection with the infinite floor plane
        const intersection = this.raycaster.ray.intersectPlane(this.floorPlane, target)

        // If looking at sky (no intersection), project far away on the floor
        if (!intersection) {
            // Fallback: This is tricky if the horizon is visible.
            // For isometric-like games, it usually hits.
            // If it doesn't hit, we project a point at some max distance on the ray projected to XZ plane.
            const fallbackDist = Math.min(Math.max(camera.far * 0.35, 300), 700)
            target.copy(this.raycaster.ray.origin)
                .add(this.raycaster.ray.direction.multiplyScalar(fallbackDist))
            target.y = 0
        }
    }

    private shouldUseRealtimeUpdates(): boolean {
        return this.camera.mode === "follow" || this.camera.isTransitioning
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
