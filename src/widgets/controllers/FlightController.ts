import type * as RAPIER from "@dimforge/rapier3d-compat"
import * as THREE from "three"
import type { FlightActions } from "../../Inputs/types"

/**
 * A physics-based flight controller that applies forces and torques for realistic movement.
 * This controller calculates the necessary forces to reach a target velocity based on user input,
 * allowing the physics engine to produce natural acceleration and deceleration.
 */
export class FlightController
{
	// --- Public Tunable Parameters ---

	/**
	 * The maximum forward speed of the spaceship in m/s.
	 */
	public maxSpeed: number = 10.0

	/**
	 * The maximum turning speed in degrees per second.
	 */
	public turnSpeed: number = 90.0

	/**
	 * A factor that determines how quickly the ship reaches its target velocity.
	 * Higher values provide a "tighter" feel, while lower values feel "looser" and more floaty.
	 */
	public forceFactor: number = 10.0

	/**
	 * A factor that determines how quickly the ship reaches its target angular velocity for turning.
	 */
	public torqueFactor: number = 5.0

	/**
	 * Determines how smoothly the spaceship accelerates.
	 * A lower value (e.g., 0.05) results in slower, smoother acceleration.
	 * A higher value (e.g., 0.2) results in faster, more responsive acceleration.
	 * This value is the interpolation factor applied each frame.
	 */
	public inputSmoothness: number = 0.1

	// --- Private State ---
	private rollInput: number = 0
	private thrustInput: number = 0

	// Smoothed input values for gradual acceleration
	private smoothedRollInput: number = 0
	private smoothedThrustInput: number = 0

	/**
	 * Updates the internal state of the controller based on user actions.
	 * @param actions - The flight actions from the input manager.
	 */
	public updateMovementInput(actions: FlightActions): void
	{
		this.rollInput = actions.movement.x // A/D keys (-1 to 1)
		this.thrustInput = actions.movement.y // W/S keys (-1 to 1)
	}

	/**
	 * The main update loop for the controller.
	 * This should be called in every frame to apply forces to the spaceship's rigid body.
	 * @param rigidBody - The RAPIER.RigidBody of the spaceship.
	 * @param deltaTime - The time elapsed since the last frame.
	 */
	public handleMovement(rigidBody: RAPIER.RigidBody): void
	{
		// 1. Smooth the raw user input for gradual acceleration
		this.updateSmoothedInputs()

		// 2. Get current orientation and velocity from the physics body
		const currentRotation = new THREE.Quaternion().copy(
			rigidBody.rotation() as THREE.Quaternion,
		)
		const currentLinvel = new THREE.Vector3().copy(
			rigidBody.linvel() as THREE.Vector3,
		)
		const currentAngvel = new THREE.Vector3().copy(
			rigidBody.angvel() as THREE.Vector3,
		)

		// 3. Calculate Target Velocities based on the *smoothed* input
		const { targetLinvel, targetAngvel } =
			this.calculateTargetVelocities(currentRotation)

		// 4. Calculate forces and torques needed to reach the target velocities
		const force = this.calculateCorrectiveForce(targetLinvel, currentLinvel)
		const torque = this.calculateCorrectiveTorque(
			targetAngvel,
			currentAngvel,
		)

		// 5. Apply the calculated forces and torques to the rigid body
		rigidBody.addForce(force, true)
		rigidBody.addTorque(torque, true)
	}

	/**
	 * Smoothly interpolates the raw input towards the target value.
	 * This prevents jerky movements and allows for smooth acceleration and deceleration.
	 */
	private updateSmoothedInputs(): void
	{
		// LERP towards the target input. The `inputSmoothness` factor determines the speed.
		this.smoothedThrustInput +=
			(this.thrustInput - this.smoothedThrustInput) * this.inputSmoothness
		this.smoothedRollInput +=
			(this.rollInput - this.smoothedRollInput) * this.inputSmoothness

		// Prevent tiny values from causing drift
		if (Math.abs(this.smoothedThrustInput) < 0.001)
			this.smoothedThrustInput = 0
		if (Math.abs(this.smoothedRollInput) < 0.001) this.smoothedRollInput = 0
	}

	/**
	 * Calculates the desired linear and angular velocities based on smoothed input.
	 * @param currentRotation - The current orientation of the spaceship.
	 * @returns An object containing the target linear and angular velocities.
	 */
	private calculateTargetVelocities(currentRotation: THREE.Quaternion):
		{
			targetLinvel: THREE.Vector3
			targetAngvel: THREE.Vector3
		}
	{
		// Target linear velocity (using smoothed input)
		const localForward = new THREE.Vector3(1, 0, 0)
		const worldForward = localForward
			.clone()
			.applyQuaternion(currentRotation)
		const targetLinvel = worldForward.multiplyScalar(
			this.smoothedThrustInput * this.maxSpeed,
		)

		// Target angular velocity (using smoothed input)
		const targetAngvel = new THREE.Vector3(
			0,
			-this.smoothedRollInput * THREE.MathUtils.degToRad(this.turnSpeed),
			0,
		)

		return { targetLinvel, targetAngvel }
	}

	/**
	 * Calculates the corrective force to apply to move from current to target linear velocity.
	 * @param targetVelocity - The desired linear velocity.
	 * @param currentVelocity - The current linear velocity.
	 * @returns The force vector to apply.
	 */
	private calculateCorrectiveForce(
		targetVelocity: THREE.Vector3,
		currentVelocity: THREE.Vector3,
	): THREE.Vector3
	{
		const velocityError = new THREE.Vector3().subVectors(
			targetVelocity,
			currentVelocity,
		)
		const correctiveForce = velocityError.multiplyScalar(this.forceFactor)
		return correctiveForce
	}

	/**
	 * Calculates the corrective torque to apply to move from current to target angular velocity.
	 * @param targetVelocity - The desired angular velocity.
	 * @param currentVelocity - The current angular velocity.
	 * @returns The torque vector to apply.
	 */
	private calculateCorrectiveTorque(
		targetVelocity: THREE.Vector3,
		currentVelocity: THREE.Vector3,
	): THREE.Vector3
	{
		const velocityError = new THREE.Vector3().subVectors(
			targetVelocity,
			currentVelocity,
		)
		const correctiveTorque = velocityError.multiplyScalar(this.torqueFactor)
		return correctiveTorque
	}

	// --- Getter/Setter for TweakPane ---
	public setMaxSpeed(speed: number): void
	{
		this.maxSpeed = speed
	}
	public getMaxSpeed(): number
	{
		return this.maxSpeed
	}
	public setTurnSpeed(speed: number): void
	{
		this.turnSpeed = speed
	}
	public getTurnSpeed(): number
	{
		return this.turnSpeed
	}
	public setForceFactor(factor: number): void
	{
		this.forceFactor = factor
	}
	public getForceFactor(): number
	{
		return this.forceFactor
	}
	public setTorqueFactor(factor: number): void
	{
		this.torqueFactor = factor
	}
	public getTorqueFactor(): number
	{
		return this.torqueFactor
	}
	public setInputSmoothness(smoothness: number): void
	{
		this.inputSmoothness = smoothness
	}
	public getInputSmoothness(): number
	{
		return this.inputSmoothness
	}

	public getSmoothedThrust(): number
	{
		return this.smoothedThrustInput
	}
}
