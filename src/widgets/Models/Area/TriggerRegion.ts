import type { Collider, RigidBody } from "@dimforge/rapier3d-compat"
import { ColliderDesc } from "@dimforge/rapier3d-compat"
import type { Vector3 } from "three/webgpu"
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three/webgpu"
import type { GameContext, IGameObject } from "@/core/GameContext"
import EventEmitter from "@/utils/EventEmitter"
import type { Audio } from "@/widgets/Audio"

export class TriggerRegion extends EventEmitter implements IGameObject {
    private mesh: Mesh
    private sensor!: Collider
    private isIn: boolean = false
    private context: GameContext | null = null
    private targetBody: RigidBody | null = null
    private audio!: Audio

    public get isActive(): boolean {
        return this.isIn
    }

    constructor(
        private position: Vector3,
        private size: Vector3,
        name: string,
        color: number = 0x00ff00,
        visible: boolean = false,
    ) {
        super()
        this.mesh = new Mesh(
            new BoxGeometry(size.x, size.y, size.z),
            new MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.2,
                visible: visible,
            }),
        )
        this.mesh.name = name
        this.mesh.position.copy(position)
    }

    async initialize(context: GameContext): Promise<void> {
        this.context = context
        context.scene.add(this.mesh)
        this.audio = context.audio

        // Create Rapier Sensor
        const colliderDesc = ColliderDesc.cuboid(
            this.size.x / 2,
            this.size.y / 2,
            this.size.z / 2,
        )
            .setTranslation(this.position.x, this.position.y, this.position.z)
            .setSensor(true)
        colliderDesc.setCollisionGroups((0x0001 << 16) | 0xffff)

        this.sensor = context.physics.world.createCollider(colliderDesc)
    }

    setTargetBody(body: RigidBody) {
        this.targetBody = body
    }

    public setPosition(position: Vector3) {
        this.mesh.position.copy(position)
        if (this.sensor) {
            this.sensor.setTranslation(position)
        }
    }

    update(_deltaTime: number) {
        if (!this.context || !this.targetBody) return

        // 모든 콜라이더에 대해 겹침 확인 (더 견고한 방식)
        let isIntersecting = false
        const numColliders = this.targetBody.numColliders()

        for (let i = 0; i < numColliders; i++) {
            const collider = this.targetBody.collider(i)
            if (
                collider &&
                this.context.physics.world.intersectionPair(
                    this.sensor,
                    collider,
                )
            ) {
                isIntersecting = true
                break
            }
        }

        if (isIntersecting && !this.isIn) {
            this.isIn = true
            this.trigger("enter")
            if (!this.audio.isPlaying("portal")) {
                this.audio.play("portal")
            }
        } else if (!isIntersecting && this.isIn) {
            this.isIn = false
            this.trigger("exit")

            if (this.audio.isPlaying("portal")) {
                this.audio.stop("portal")
            }
        }
    }

    dispose() {
        if (this.context) {
            this.context.scene.remove(this.mesh)
            this.context.physics.world.removeCollider(this.sensor, true)
        }
    }
}
