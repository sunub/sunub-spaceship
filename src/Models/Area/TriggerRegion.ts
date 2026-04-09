import type { Collider, RigidBody } from "@dimforge/rapier3d-compat"
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"
import {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    type Vector3,
} from "three/webgpu"
import type { Audio } from "@/Environment/Audio"
import type { IPhysicsService } from "@/Services/IPhysicsService"
import type { ISceneManager } from "@/Services/ISceneManager"
import EventEmitter from "@/utils/EventEmitter"

export class TriggerRegion extends EventEmitter {
    private mesh: Mesh
    private sensor: Collider | null = null
    public sensorBody: RigidBody | null = null
    private isIn: boolean = false
    private targetBody: RigidBody | null = null

    private audio: Audio | null = null
    private physicsService: IPhysicsService | null = null
    private sceneManager: ISceneManager | null = null

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

    async initialize(
        audio: Audio,
        physicsService: IPhysicsService,
        sceneManager: ISceneManager,
    ): Promise<void> {
        this.audio = audio
        this.physicsService = physicsService
        this.sceneManager = sceneManager

        this.sceneManager.add(this.mesh)

        // Create Rapier Sensor
        const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
            this.position.x,
            this.position.y,
            this.position.z,
        )

        this.sensorBody = this.physicsService.createPhysicsBody(rigidBodyDesc)

        const colliderDesc = ColliderDesc.cuboid(
            this.size.x / 2,
            this.size.y / 2,
            this.size.z / 2,
        )
        // Offset relative to body is 0
        colliderDesc.setSensor(true)
        colliderDesc.setCollisionGroups((0x0001 << 16) | 0xffff)

        this.sensor = this.physicsService.createCollider(
            colliderDesc,
            this.sensorBody,
        )
    }

    setTargetBody(body: RigidBody) {
        this.targetBody = body
    }

    public setPosition(position: Vector3) {
        this.mesh.position.copy(position)
        if (this.sensorBody && this.physicsService) {
            this.sensorBody.setTranslation(position, true)
        }
    }

    update(_deltaTime: number) {
        if (
            !this.physicsService ||
            !this.targetBody ||
            !this.audio ||
            !this.sensor
        )
            return

        // 모든 콜라이더에 대해 겹침 확인 (더 견고한 방식)
        let isIntersecting = false
        const numColliders = this.targetBody.numColliders()

        for (let i = 0; i < numColliders; i++) {
            const collider = this.targetBody.collider(i)
            if (
                collider &&
                this.physicsService.checkIntersection(this.sensor, collider)
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
        if (this.sceneManager) {
            this.sceneManager.remove(this.mesh)
        }
        if (this.physicsService && this.sensorBody) {
            this.physicsService.removePhysicsBody(this.sensorBody)
        }
        this.sensorBody = null
        this.sensor = null
    }
}
