import { inject, injectable } from "inversify";
import type { Object3D } from "three/webgpu";
import type { IPhysicsService } from "./IPhysicsService";
import type { Physics } from "@/core/Physics";
import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { RigidBody, RigidBodyDesc, ColliderDesc, Collider } from "@dimforge/rapier3d-compat";

@injectable()
export class PhysicsService implements IPhysicsService {
  constructor(
    @inject(GAME_CONTEXT.CORE.Physics) private physics: Physics,
  ) {}

  createPhysicsBody(desc: RigidBodyDesc): RigidBody {
    if(!desc) {
      throw new Error("RigidBodyDesc is required")
    }

    const rigidBody = this.physics.world.createRigidBody(desc)
    return rigidBody
  }

  createPhysicsBodyWithColliders(desc: RigidBodyDesc, colliders: ColliderDesc[]): RigidBody {
    if(!desc) {
      throw new Error("RigidBodyDesc is required")
    }
    if(!colliders) {
      throw new Error("Colliders is required")
    }

    const rigidBody = this.physics.world.createRigidBody(desc)
    colliders.forEach((collider) => {
      this.physics.world.createCollider(collider, rigidBody)
    })
    return rigidBody
  }

  createCollider(collider: ColliderDesc, body: RigidBody): Collider {
    if(!collider) {
      throw new Error("ColliderDesc is required")
    }
    if(!body) {
      throw new Error("RigidBody is required")
    }
    return this.physics.world.createCollider(collider, body)
  }

  removePhysicsBody(body: RigidBody): void {
    if(!body) {
      throw new Error("RigidBody is required")
    }
    this.physics.world.removeRigidBody(body)
  }

  syncTransform(rigidBody: RigidBody, object3D: Object3D) {
    const t = rigidBody.translation();
    const r = rigidBody.rotation();
    object3D.position.set(t.x, t.y, t.z);
    object3D.quaternion.set(r.x, r.y, r.z, r.w);
  }

  castShape(
    pos: { x: number, y: number, z: number },
    rot: { x: number, y: number, z: number, w: number },
    dir: { x: number, y: number, z: number },
    shape: any,
    distance: number,
    interactionGroups?: number,
    excludeBody?: RigidBody
  ): { time_of_impact: number } | null {

    return this.physics.world.castShape(
      pos,
      rot,
      dir,
      shape,
      distance,
      distance,
      true,
      undefined,
      interactionGroups,
      undefined,
      excludeBody
    );
  }

  checkIntersection(colliderA: Collider, colliderB: Collider): boolean {
    return this.physics.world.intersectionPair(colliderA, colliderB)
  }
}
