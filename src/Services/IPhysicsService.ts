import type {
    Collider,
    ColliderDesc,
    RigidBody,
    RigidBodyDesc,
} from "@dimforge/rapier3d-compat"
import type { Object3D } from "three/webgpu"

export interface IPhysicsService {
    createPhysicsBody(desc: RigidBodyDesc): RigidBody
    removePhysicsBody(body: RigidBody): void
    createPhysicsBodyWithColliders(
        desc: RigidBodyDesc,
        colliders: ColliderDesc[],
    ): RigidBody
    createCollider(collider: ColliderDesc, body: RigidBody): Collider
    syncTransform(rigidBody: RigidBody, object3D: Object3D): void
    castShape(
        pos: { x: number; y: number; z: number },
        rot: { x: number; y: number; z: number; w: number },
        dir: { x: number; y: number; z: number },
        shape: any,
        distance: number,
        interactionGroups?: number,
        excludeBody?: RigidBody,
    ): { time_of_impact: number } | null
    checkIntersection(colliderA: Collider, colliderB: Collider): boolean
}
