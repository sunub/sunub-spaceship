import { inject, injectable } from "inversify"
import {
    BoxGeometry,
    BufferGeometry,
    CircleGeometry,
    DoubleSide,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicNodeMaterial,
    type Object3D,
    Plane,
    Raycaster,
    TorusGeometry,
    Vector2,
    Vector3,
} from "three/webgpu"
import type { Camera } from "@/Camera"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { Scene } from "@/core/Scene"
import { TweakPane } from "@/Debug/TweakPane"
import type { IGameObject } from "@/Services/IGameObject"

@injectable()
export class TerrainVisibilityArea implements IGameObject {
    public readonly center = new Vector3()
    public readonly playerPosition = new Vector3()
    public readonly frustumNearCenter = new Vector3()
    public readonly frustumForward = new Vector3(0, 0, -1)
    public readonly frustumRight = new Vector3(1, 0, 0)
    public radius = 10
    public frustumDepth = 0
    public frustumNearHalfWidth = 0
    public frustumFarHalfWidth = 0
    public centerToPlayerDistance = 0
    public readonly frustumEdgeFadeDistance = 4
    public isDebugVisible = false

    private readonly floorPlane = new Plane(new Vector3(0, 1, 0), 0)
    private readonly raycaster = new Raycaster()
    private readonly tempNdc = new Vector2()
    private readonly nearLeft = new Vector3()
    private readonly nearRight = new Vector3()
    private readonly farLeft = new Vector3()
    private readonly farRight = new Vector3()
    private readonly rawNearCenter = new Vector3()
    private readonly rawFarCenter = new Vector3()
    private readonly frustumFarCenter = new Vector3()
    private readonly frustumNearLeft = new Vector3()
    private readonly frustumNearRight = new Vector3()
    private readonly frustumFarLeft = new Vector3()
    private readonly frustumFarRight = new Vector3()
    private readonly tempForward = new Vector3()
    private readonly horizonProbe = new Vector3()

    private debugGroup: Object3D[] = []
    private centerMarker!: Mesh
    private playerMarker!: Mesh
    private radiusFillMarker!: Mesh
    private radiusMarker!: Mesh
    private frustumOutline!: LineSegments
    private centerToPlayerLine!: LineSegments
    private currentCenter = new Vector3()
    private currentRadius = 0
    private readonly minimumRadius = 9
    private readonly minimumDepth = 10
    private readonly lateralPadding = 2.5
    private readonly nearDepthPadding = 1.5
    private readonly farDepthPadding = 3.5

    private debugParams = {
        visible: false,
        areaColor: "#00ff00",
        centerColor: "#ffb300",
        playerColor: "#00ff00",
        offsetY: 0.1,
        radiusMultiplier: 0.9,
    }

    constructor(
        @inject(GAME_CONTEXT.CORE.Camera) private camera: Camera,
        @inject(GAME_CONTEXT.CORE.Scene) private scene: Scene,
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
        const horizonY = this.findHighestVisibleFloorNdcY(camera)

        this.intersectFloor(-1, -1, camera, this.nearLeft)
        this.intersectFloor(1, -1, camera, this.nearRight)
        this.intersectFloor(-1, horizonY, camera, this.farLeft)
        this.intersectFloor(1, horizonY, camera, this.farRight)

        this.rawNearCenter
            .copy(this.nearLeft)
            .add(this.nearRight)
            .multiplyScalar(0.5)
        this.rawFarCenter
            .copy(this.farLeft)
            .add(this.farRight)
            .multiplyScalar(0.5)

        this.tempForward.subVectors(this.rawFarCenter, this.rawNearCenter)
        this.tempForward.y = 0

        if (this.tempForward.lengthSq() < 1e-4) {
            camera.getWorldDirection(this.tempForward)
            this.tempForward.y = 0
        }

        if (this.tempForward.lengthSq() < 1e-4) {
            this.tempForward.set(0, 0, -1)
        }

        this.tempForward.normalize()
        this.frustumForward.copy(this.tempForward)
        this.frustumRight
            .set(this.tempForward.z, 0, -this.tempForward.x)
            .normalize()

        this.frustumNearHalfWidth =
            this.nearLeft.distanceTo(this.nearRight) * 0.5 + this.lateralPadding
        this.frustumFarHalfWidth =
            this.farLeft.distanceTo(this.farRight) * 0.5 + this.lateralPadding

        this.frustumNearCenter
            .copy(this.rawNearCenter)
            .addScaledVector(this.frustumForward, -this.nearDepthPadding)
        this.frustumFarCenter
            .copy(this.rawFarCenter)
            .addScaledVector(this.frustumForward, this.farDepthPadding)

        if (
            this.frustumNearCenter.distanceToSquared(this.frustumFarCenter) <
            this.minimumDepth * this.minimumDepth
        ) {
            this.frustumFarCenter
                .copy(this.frustumNearCenter)
                .addScaledVector(this.frustumForward, this.minimumDepth)
        }

        this.frustumDepth = this.frustumNearCenter.distanceTo(
            this.frustumFarCenter,
        )

        this.frustumNearLeft
            .copy(this.frustumNearCenter)
            .addScaledVector(this.frustumRight, -this.frustumNearHalfWidth)
        this.frustumNearRight
            .copy(this.frustumNearCenter)
            .addScaledVector(this.frustumRight, this.frustumNearHalfWidth)
        this.frustumFarLeft
            .copy(this.frustumFarCenter)
            .addScaledVector(this.frustumRight, -this.frustumFarHalfWidth)
        this.frustumFarRight
            .copy(this.frustumFarCenter)
            .addScaledVector(this.frustumRight, this.frustumFarHalfWidth)

        this.currentCenter
            .set(0, 0, 0)
            .add(this.frustumNearLeft)
            .add(this.frustumNearRight)
            .add(this.frustumFarLeft)
            .add(this.frustumFarRight)
            .multiplyScalar(0.25)

        const projectedCorners = [
            this.frustumNearLeft,
            this.frustumNearRight,
            this.frustumFarLeft,
            this.frustumFarRight,
        ]

        const maxDistance = projectedCorners.reduce((max, point) => {
            return Math.max(max, this.currentCenter.distanceTo(point))
        }, 0)

        this.currentRadius =
            Math.max(maxDistance, this.minimumRadius) *
            this.debugParams.radiusMultiplier

        this.center.copy(this.currentCenter)
        this.radius = this.currentRadius
    }

    private findHighestVisibleFloorNdcY(camera: Camera["instance"]): number {
        return Math.min(
            this.findHighestVisibleFloorNdcYForX(-1, camera),
            this.findHighestVisibleFloorNdcYForX(0, camera),
            this.findHighestVisibleFloorNdcYForX(1, camera),
        )
    }

    private findHighestVisibleFloorNdcYForX(
        ndcX: number,
        camera: Camera["instance"],
    ): number {
        if (!this.tryIntersectFloor(ndcX, -1, camera, this.horizonProbe)) {
            return -1
        }

        if (this.tryIntersectFloor(ndcX, 1, camera, this.horizonProbe)) {
            return 1
        }

        let low = -1
        let high = 1

        for (let i = 0; i < 8; i++) {
            const mid = (low + high) * 0.5

            if (this.tryIntersectFloor(ndcX, mid, camera, this.horizonProbe)) {
                low = mid
            } else {
                high = mid
            }
        }

        return low
    }

    private tryIntersectFloor(
        ndcX: number,
        ndcY: number,
        camera: Camera["instance"],
        target: Vector3,
    ): boolean {
        this.tempNdc.set(ndcX, ndcY)
        this.raycaster.setFromCamera(this.tempNdc, camera)

        return Boolean(
            this.raycaster.ray.intersectPlane(this.floorPlane, target),
        )
    }

    private intersectFloor(
        ndcX: number,
        ndcY: number,
        camera: any,
        target: Vector3,
    ) {
        if (!this.tryIntersectFloor(ndcX, ndcY, camera, target)) {
            const fallbackDist = Math.min(Math.max(camera.far * 0.35, 300), 700)
            target
                .copy(this.raycaster.ray.origin)
                .add(this.raycaster.ray.direction.multiplyScalar(fallbackDist))
            target.y = 0
        }
    }

    private createDebugMeshes() {
        // 1. Visibility Center Marker
        this.centerMarker = new Mesh(
            new BoxGeometry(0.75, 2.2, 0.75),
            new MeshBasicNodeMaterial({
                color: this.debugParams.centerColor,
                wireframe: true,
            }),
        )
        this.centerMarker.visible = false
        this.centerMarker.frustumCulled = false

        // 2. Player Marker
        this.playerMarker = new Mesh(
            new BoxGeometry(1, 4, 1),
            new MeshBasicNodeMaterial({
                color: this.debugParams.playerColor,
                wireframe: true,
            }),
        )
        this.playerMarker.visible = false
        this.playerMarker.frustumCulled = false

        // 3. Radius Fill
        this.radiusFillMarker = new Mesh(
            new CircleGeometry(1, 96).rotateX(-Math.PI / 2),
            new MeshBasicNodeMaterial({
                color: this.debugParams.areaColor,
                transparent: true,
                opacity: 0.08,
                side: DoubleSide,
            }),
        )
        this.radiusFillMarker.visible = false
        this.radiusFillMarker.frustumCulled = false

        // 4. Radius Marker (Outer Ring)
        this.radiusMarker = new Mesh(
            new TorusGeometry(1, 0.09, 24, 128).rotateX(Math.PI / 2),
            new MeshBasicNodeMaterial({
                color: this.debugParams.areaColor,
                transparent: true,
                opacity: 0.9,
            }),
        )
        this.radiusMarker.visible = false
        this.radiusMarker.frustumCulled = false

        // 5. Projected Frustum Outline
        this.frustumOutline = new LineSegments(
            new BufferGeometry(),
            new LineBasicMaterial({ color: this.debugParams.areaColor }),
        )
        this.frustumOutline.visible = false
        this.frustumOutline.frustumCulled = false

        // 6. Link Line Between Player And Visibility Center
        this.centerToPlayerLine = new LineSegments(
            new BufferGeometry(),
            new LineBasicMaterial({ color: this.debugParams.playerColor }),
        )
        this.centerToPlayerLine.visible = false
        this.centerToPlayerLine.frustumCulled = false

        this.scene.add(this.centerMarker)
        this.scene.add(this.playerMarker)
        this.scene.add(this.radiusFillMarker)
        this.scene.add(this.radiusMarker)
        this.scene.add(this.frustumOutline)
        this.scene.add(this.centerToPlayerLine)

        this.debugGroup = [
            this.centerMarker,
            this.playerMarker,
            this.radiusFillMarker,
            this.radiusMarker,
            this.frustumOutline,
            this.centerToPlayerLine,
        ]
    }

    private updateDebugVisuals() {
        // Toggle visibility based on params
        if (this.centerMarker.visible !== this.debugParams.visible) {
            this.debugGroup.forEach((m) => {
                m.visible = this.debugParams.visible
            })
        }

        if (!this.debugParams.visible) return

        const markerHeight = this.debugParams.offsetY + 2

        // Update visibility center
        this.centerMarker.position.copy(this.center)
        this.centerMarker.position.y = markerHeight

        // Update radius fill and outline
        this.radiusFillMarker.position.copy(this.center)
        this.radiusFillMarker.position.y = this.debugParams.offsetY + 0.01
        this.radiusMarker.position.copy(this.center)
        this.radiusMarker.position.y = this.debugParams.offsetY
        const scale = Math.max(0.1, this.radius)
        this.radiusFillMarker.scale.set(scale, 1, scale)
        this.radiusMarker.scale.set(scale, 1, scale)

        this.frustumOutline.geometry.setFromPoints([
            new Vector3(
                this.frustumNearLeft.x,
                this.debugParams.offsetY + 0.12,
                this.frustumNearLeft.z,
            ),
            new Vector3(
                this.frustumNearRight.x,
                this.debugParams.offsetY + 0.12,
                this.frustumNearRight.z,
            ),
            new Vector3(
                this.frustumNearRight.x,
                this.debugParams.offsetY + 0.12,
                this.frustumNearRight.z,
            ),
            new Vector3(
                this.frustumFarRight.x,
                this.debugParams.offsetY + 0.12,
                this.frustumFarRight.z,
            ),
            new Vector3(
                this.frustumFarRight.x,
                this.debugParams.offsetY + 0.12,
                this.frustumFarRight.z,
            ),
            new Vector3(
                this.frustumFarLeft.x,
                this.debugParams.offsetY + 0.12,
                this.frustumFarLeft.z,
            ),
            new Vector3(
                this.frustumFarLeft.x,
                this.debugParams.offsetY + 0.12,
                this.frustumFarLeft.z,
            ),
            new Vector3(
                this.frustumNearLeft.x,
                this.debugParams.offsetY + 0.12,
                this.frustumNearLeft.z,
            ),
        ])

        const ship = this.scene.getObjectByName("ShipPivot")
        if (ship) {
            this.playerPosition.copy(ship.position)
            this.centerToPlayerDistance = Math.hypot(
                this.center.x - ship.position.x,
                this.center.z - ship.position.z,
            )

            this.playerMarker.visible = true
            this.playerMarker.position.copy(ship.position)
            this.playerMarker.position.y += 2

            this.centerToPlayerLine.visible = true
            this.centerToPlayerLine.geometry.setFromPoints([
                new Vector3(
                    this.center.x,
                    this.debugParams.offsetY + 0.2,
                    this.center.z,
                ),
                new Vector3(
                    ship.position.x,
                    this.debugParams.offsetY + 0.2,
                    ship.position.z,
                ),
            ])
        } else {
            this.playerPosition.set(0, 0, 0)
            this.centerToPlayerDistance = 0
            this.playerMarker.visible = false
            this.centerToPlayerLine.visible = false
        }
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
        folder
            .addBinding(this.debugParams, "areaColor", { label: "Area Color" })
            .on("change", (ev) => {
                ;(this.radiusFillMarker.material as any).color.set(ev.value)
                ;(this.radiusMarker.material as any).color.set(ev.value)
                ;(this.frustumOutline.material as LineBasicMaterial).color.set(
                    ev.value,
                )
            })
        folder
            .addBinding(this.debugParams, "centerColor", {
                label: "Center Color",
            })
            .on("change", (ev) => {
                ;(this.centerMarker.material as any).color.set(ev.value)
            })
        folder
            .addBinding(this.debugParams, "playerColor", {
                label: "Player Color",
            })
            .on("change", (ev) => {
                ;(this.playerMarker.material as any).color.set(ev.value)
                ;(
                    this.centerToPlayerLine.material as LineBasicMaterial
                ).color.set(ev.value)
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
            format: (v) => v.toFixed(2),
        })

        folder.addBinding(this.center, "x", {
            readonly: true,
            label: "Vis Center X",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this.center, "z", {
            readonly: true,
            label: "Vis Center Z",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this.playerPosition, "x", {
            readonly: true,
            label: "Player X",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this.playerPosition, "z", {
            readonly: true,
            label: "Player Z",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this, "centerToPlayerDistance", {
            readonly: true,
            label: "Center->Player",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this, "frustumDepth", {
            readonly: true,
            label: "Frustum Depth",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this, "frustumNearHalfWidth", {
            readonly: true,
            label: "Near Half W",
            format: (v) => v.toFixed(2),
        })
        folder.addBinding(this, "frustumFarHalfWidth", {
            readonly: true,
            label: "Far Half W",
            format: (v) => v.toFixed(2),
        })
    }
}
