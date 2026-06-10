import type * as RAPIER from "@dimforge/rapier3d-compat"
import {
    Euler,
    MathUtils,
    Quaternion,
    type Vector2,
    Vector3,
} from "three/webgpu"

export class FlightController {
    public maxSpeed: number = 12.0
    public turnSpeed: number = 160.0
    public forceFactor: number = 10.0
    public torqueFactor: number = 5.0
    public inputSmoothness: number = 0.1

    private rollInput: number = 0
    private thrustInput: number = 0

    private smoothedRollInput: number = 0
    private smoothedThrustInput: number = 0

    public pointerVector: Vector2 | null = null
    private thrustEnabled: boolean = true

    private isBlocked: boolean = false

    public setBlocked(blocked: boolean) {
        this.isBlocked = blocked
    }

    public updateMovementInput(roll: number, thrust: number) {
        this.rollInput = roll
        this.thrustInput = thrust
    }

    public updatePointerInput(vector: Vector2, enableThrust: boolean = true) {
        this.pointerVector = vector.length() > 0.01 ? vector : null
        this.thrustEnabled = enableThrust
    }

    public handleMovement(
        rigidBody: RAPIER.RigidBody,
        deltaTime: number,
    ): void {
        // 1. 입력값 보간 (Smoothing) 계산
        this.updateSmoothedInputs(deltaTime)

        // 2. 현재 물리 상태 가져오기 (위치, 속도, 각속도)
        const currentRotation = new Quaternion().copy(
            rigidBody.rotation() as Quaternion,
        )
        const currentLinvel = new Vector3().copy(rigidBody.linvel() as Vector3)
        const currentAngvel = new Vector3().copy(rigidBody.angvel() as Vector3)

        // 3. 충돌 및 전진 의도 확인
        // - 벽에 막혀있는가? (isBlocked)
        // - 앞으로 가려고 하는가? (thrustInput > 0 또는 조이스틱 사용)
        const isTryingToMoveForward =
            this.thrustInput > 0 || this.pointerVector !== null

        // 4. 타겟 속도(Target Velocity) 계산
        // (이 함수는 사용자의 입력에 따라 우주선이 '가야 할' 속도와 회전을 계산합니다)
        const { targetLinvel, targetAngvel } =
            this.calculateTargetVelocities(currentRotation)

        if (this.isBlocked && isTryingToMoveForward) {
            // A. 물리적 전진 속도 강제 0 (물리적 관성 제거)
            // 현재 속도를 죽여서 즉시 멈추게 합니다. (회전은 건드리지 않음)
            rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)

            // B. 타겟 전진 속도를 0으로 덮어쓰기
            // Force 계산 시 '0'을 목표로 하도록 설정하여 앞으로 힘을 주지 않게 함
            targetLinvel.set(0, 0, 0)

            // C. 내부 스무딩 변수 초기화 (소프트웨어 관성 제거)
            // 키를 떼도 값이 서서히 줄어드는 것을 방지하고 즉시 0으로 만듦
            this.smoothedThrustInput = 0

            // 주의: targetAngvel(회전)은 그대로 둡니다.
            // 덕분에 벽에 박은 상태에서도 조이스틱이나 키보드로 방향을 틀 수 있습니다.
        }

        // 5. 목표 속도에 도달하기 위한 힘(Force)과 토크(Torque) 계산
        // (충돌 시에는 targetLinvel이 0이므로 전진 힘은 발생하지 않음)
        const force = this.calculateCorrectiveForce(targetLinvel, currentLinvel)
        const torque = this.calculateCorrectiveTorque(
            targetAngvel,
            currentAngvel,
        )

        // 6. 물리 엔진에 적용
        rigidBody.addForce(force, true)
        rigidBody.addTorque(torque, true)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 🧮 HELPER METHODS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Interpolates raw input to smoothed input using LERP.
     */
    private updateSmoothedInputs(deltaTime: number): void {
        // Frame-rate independent smoothing
        // Derived from: factor = 1 - Math.pow(1 - baseFactor, deltaTime * 60)
        const timeAdjustedFactor =
            1 - (1 - this.inputSmoothness) ** (deltaTime * 60)

        this.smoothedThrustInput +=
            (this.thrustInput - this.smoothedThrustInput) * timeAdjustedFactor
        this.smoothedRollInput +=
            (this.rollInput - this.smoothedRollInput) * timeAdjustedFactor

        // Drift prevention for tiny values
        if (Math.abs(this.smoothedThrustInput) < 0.001)
            this.smoothedThrustInput = 0
        if (Math.abs(this.smoothedRollInput) < 0.001) this.smoothedRollInput = 0
    }

    /**
     * Calculates desired linear and angular velocities based on inputs.
     */
    private calculateTargetVelocities(currentRotation: Quaternion): {
        targetLinvel: Vector3
        targetAngvel: Vector3
    } {
        // [CASE A: Joystick / Mouse Pointer Mode]
        if (this.pointerVector) {
            const currentHeading = new Vector3(1, 0, 0).applyQuaternion(
                currentRotation,
            )

            // 1. Rotation (Angular Velocity)
            // Calculate angle difference between current heading and pointer direction
            const targetAngle = Math.atan2(
                -this.pointerVector.y,
                this.pointerVector.x,
            )
            const currentEuler = new Euler().setFromQuaternion(
                currentRotation,
                "YXZ",
            )

            let angleDiff = targetAngle - currentEuler.y
            // Normalize angle to -PI ~ PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

            const targetAngvel = new Vector3(
                0,
                angleDiff * MathUtils.degToRad(this.turnSpeed),
                0,
            )

            // 2. Movement (Linear Velocity)
            const rawThrust = this.pointerVector.length()
            const thrust = this.thrustEnabled ? rawThrust : 0
            const targetLinvel = currentHeading
                .clone()
                .multiplyScalar(thrust * this.maxSpeed)

            return { targetLinvel, targetAngvel }
        }

        // [CASE B: Keyboard Mode]
        const localForward = new Vector3(1, 0, 0)
        const worldForward = localForward
            .clone()
            .applyQuaternion(currentRotation)

        // Linear Velocity based on 'W/S' keys
        const targetLinvel = worldForward.multiplyScalar(
            this.smoothedThrustInput * this.maxSpeed,
        )

        // Angular Velocity based on 'A/D' keys
        const targetAngvel = new Vector3(
            0,
            -this.smoothedRollInput * MathUtils.degToRad(this.turnSpeed),
            0,
        )

        return { targetLinvel, targetAngvel }
    }

    private calculateCorrectiveForce(
        targetVelocity: Vector3,
        currentVelocity: Vector3,
    ): Vector3 {
        const velocityError = new Vector3().subVectors(
            targetVelocity,
            currentVelocity,
        )
        return velocityError.multiplyScalar(this.forceFactor)
    }

    private calculateCorrectiveTorque(
        targetVelocity: Vector3,
        currentVelocity: Vector3,
    ): Vector3 {
        const velocityError = new Vector3().subVectors(
            targetVelocity,
            currentVelocity,
        )
        return velocityError.multiplyScalar(this.torqueFactor)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 🔧 GETTERS / SETTERS (For TweakPane)
    // ─────────────────────────────────────────────────────────────────────────────
    public setMaxSpeed(speed: number): void {
        this.maxSpeed = speed
    }
    public getMaxSpeed(): number {
        return this.maxSpeed
    }

    public setTurnSpeed(speed: number): void {
        this.turnSpeed = speed
    }
    public getTurnSpeed(): number {
        return this.turnSpeed
    }

    public setForceFactor(factor: number): void {
        this.forceFactor = factor
    }
    public getForceFactor(): number {
        return this.forceFactor
    }

    public setTorqueFactor(factor: number): void {
        this.torqueFactor = factor
    }
    public getTorqueFactor(): number {
        return this.torqueFactor
    }

    public setInputSmoothness(smoothness: number): void {
        this.inputSmoothness = smoothness
    }
    public getInputSmoothness(): number {
        return this.inputSmoothness
    }

    public getSmoothedThrust(): number {
        if (this.pointerVector) {
            return Math.max(
                Math.abs(this.smoothedThrustInput),
                this.pointerVector.length(),
            )
        }
        return this.smoothedThrustInput
    }
}
