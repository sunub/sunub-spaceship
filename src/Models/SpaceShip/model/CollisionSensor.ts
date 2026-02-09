import { Cuboid, RigidBody } from "@dimforge/rapier3d-compat"
import {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    Vector3,
} from "three/webgpu"
import { injectable, inject } from "inversify"
import { GAME_CONTEXT } from "@/core/DI/DITypes"
import type { IPhysicsService } from "@/Services/IPhysicsService"

export interface SensorConfig {
    detectionRange: number
    halfExtents: { x: number, y: number, z: number }
    offset: { forward: number, up: number }
}

@injectable()
export class CollisionSensor {
    private isObstacle: boolean = false
    private config: SensorConfig | null = null

    private debugMesh: Mesh | null = null
    private readonly COLOR_SAFE = 0x0000ff
    private readonly COLOR_HIT = 0xff0000

    constructor(
        @inject(GAME_CONTEXT.SERVICE.PhysicsService) private physicsService: IPhysicsService
    ) {}

    /**
     * 센서 설정을 초기화합니다. DI로 주입받은 후 각 모델의 특성에 맞게 설정할 수 있습니다.
     */
    public setup(config: SensorConfig): void {

        this.config = config;

    }

    /**
     * 디버그용 메쉬를 생성하고 반환합니다.
     */
    public initDebugMesh(): Mesh {

        if ( !this.config ) {

            throw new Error('CollisionSensor must be setup with config before initializing debug mesh.');

        }

        const geometry = new BoxGeometry(
            this.config.halfExtents.x * 2,
            this.config.halfExtents.y * 2,
            this.config.halfExtents.z * 2,
        );
        const material = new MeshBasicMaterial({
            color: this.COLOR_SAFE,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
        });

        this.debugMesh = new Mesh(geometry, material);
        this.debugMesh.name = 'CollisionSensorDebugMesh';
        this.debugMesh.position.set(
            this.config.offset.forward,
            this.config.offset.up,
            0,
        );

        return this.debugMesh;

    }

    /**
     * 물리 엔진과 연동하여 충돌을 감지합니다.
     * @param world 물리 월드 인스턴스
     * @param rigidBody 충돌체의 주체가 되는 물리 바디
     * @param orientationReference 방향의 기준이 되는 Object3D (보통 parent pivot)
     * @param debugMode 디버그 시각화 활성화 여부
     */
    public update(
        rigidBody: RigidBody,
        orientationReference: Object3D,
        debugMode: boolean
    ): void {

        if ( !this.config ) return;

        const shape = new Cuboid(
            this.config.halfExtents.x,
            this.config.halfExtents.y,
            this.config.halfExtents.z,
        );

        const currentPos = rigidBody.translation();
        const shapeRot = rigidBody.rotation();

        // 방향 벡터 계산 (주입받은 기준 객체의 방향을 따름)
        const forwardVector = new Vector3(1, 0, 0)
            .applyQuaternion(orientationReference.quaternion)
            .normalize();
        const upVector = new Vector3(0, 1, 0)
            .applyQuaternion(orientationReference.quaternion)
            .normalize();

        const forwardOffset = forwardVector
            .clone()
            .multiplyScalar(this.config.offset.forward);
        const upOffset = upVector
            .clone()
            .multiplyScalar(this.config.offset.up);

        const shapePos = {
            x: currentPos.x + forwardOffset.x + upOffset.x,
            y: currentPos.y + forwardOffset.y + upOffset.y,
            z: currentPos.z + forwardOffset.z + upOffset.z,
        };

        const interactionGroups = (0x0001 << 16) | 0x0002;

        const hit = this.physicsService.castShape(
            shapePos,
            shapeRot,
            forwardVector,
            shape,
            this.config.detectionRange,
            interactionGroups,
            rigidBody
        );

        this.isObstacle = !!(hit && hit.time_of_impact < this.config.detectionRange);

        if ( debugMode && this.debugMesh ) {

            (this.debugMesh.material as MeshBasicMaterial).color.setHex(
                this.isObstacle ? this.COLOR_HIT : this.COLOR_SAFE,
            );

        }

    }

    public get isObstacleDetected(): boolean {

        return this.isObstacle;

    }
}
