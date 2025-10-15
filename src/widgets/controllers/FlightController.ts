import type { FlightActions } from '../../Inputs/types';
import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';

export class FlightController {
  /**
   * Roll 회전 속도 (단위: deg/s) AD 키나 좌우 화살표 키를 누를 때 Roll 축 회전 속도
   */
  private rollSpeed: number = 60;
  /**
   * 전진 속도 (단위: m/s)
   * W키를 누를 때 전진 속도, S키를 누를 때 후진 속도
   */
  private thrustSpeed: number = 3;
  /**
   *  뱅킹-투-턴 계수 (Banking-to-Turn Factor)
   * Roll 각도가 Yaw 회전에 미치는 영향 강도 (0~1)
   * 높을수록 더 급격한 선회, 낮을수록 더 부드러운 선회
   */
  private bankingToTurnFactor: number = 0.8;
  /**
   * 수평 비행을 위한 기본 Pitch 감쇠 계수
   */
  private turnPitchCompensation: number = 0.4;
  /**
   *  수평 선회를 위한 기본 계수 (미사용)
   */
  private coordinatedTurnFactor: number = 0.6;

  // 자연스러운 비행을 위한 가속도 제어 설정 
  /**
   * 추진력 강도 (힘 기반 제어)
   */
  private thrustAcceleration: number = 0.5;
  /**
   * 키를 누를 때 가해지는 토크의 강도
   */
  private rollAcceleration: number = 0.3;
  /**
   * 힘 기반 제어에서는 낮은 값으로 설정
   */
  private airResistance: number = 0.5;
  private rotationalDrag: number = 0.3;
  /**
   * 실제 항공기처럼 축별로 다른 회전 특성 구현
   */
  private rollInertia: number = 1.2;    // Roll축 관성 (좌우 기울기)
  private pitchInertia: number = 1.8;   // Pitch축 관성 (상하 기울기)

  // --- 내부 상태 변수 ---
  private rollInput: number = 0;
  private thrustInput: number = 0;
  private currentRollAngle: number = 0; // 현재 Roll 각도 추적 (라디안)
  private isTurning: boolean = false; // 현재 선회 중인지 감지

  updateMovementInput(actions: FlightActions): void {
    // AD 키 또는 좌우 화살표 키 입력을 Roll 입력으로 사용
    this.rollInput = actions.movement.x;
    
    // WS 키 또는 상하 화살표 키 입력을 Thrust 입력으로 사용
    this.thrustInput = actions.movement.y;
    
    // 🎯 선회 감지: W키와 A/D키를 동시에 누르는 경우 선회로 판단
    this.isTurning = this.thrustInput > 0 && Math.abs(this.rollInput) > 0.1;
  }

  /**
   * Roll 회전과 전진을 동시에 처리하여 원형 비행 구현
   */
  handleMovement(rigidBody: RAPIER.RigidBody, deltaTime: number): void {
    this.updateFlightPhysics(rigidBody);
  }

  /**
   * 🛩️ 수평 비행 물리학을 적용한 비행 제어
   * 물리 기반 힘(Force)과 토크(Torque)를 사용하여 자연스러운 움직임 구현
   */
  private updateFlightPhysics(rigidBody: RAPIER.RigidBody): void {
    const currentRotation = new THREE.Quaternion(
      rigidBody.rotation().x,
      rigidBody.rotation().y,
      rigidBody.rotation().z,
      rigidBody.rotation().w
    );

    // 현재 Euler 각도 계산 (디버깅 및 상태 추적용)
    const euler = new THREE.Euler().setFromQuaternion(currentRotation, 'XYZ');
    this.currentRollAngle = euler.y; // Y축이 수평 선회 각도 (비행기 진행 방향 기준)

    // 1. 🎯 회전 제어 - 토크 기반 자연스러운 회전
    this.applyRotationTorques(rigidBody, currentRotation);

    // 2. 🚀 추진력 제어 - 힘 기반 자연스러운 가속/감속
    this.applyThrustForces(rigidBody, currentRotation);
  }

  /**
   * 🔄 토크 기반 회전 제어 - 자연스러운 각가속도 구현
   */
  private applyRotationTorques(rigidBody: RAPIER.RigidBody, currentRotation: THREE.Quaternion): void {
    // 현재 각속도 확인 및 최대 각속도 제한
    const currentAngularVel = rigidBody.angvel();
    const currentAngularSpeed = Math.sqrt(
      currentAngularVel.x * currentAngularVel.x + 
      currentAngularVel.y * currentAngularVel.y + 
      currentAngularVel.z * currentAngularVel.z
    );
    const maxAngularSpeed = THREE.MathUtils.degToRad(this.rollSpeed);
    
    const yawAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(currentRotation);
    
    if (Math.abs(this.rollInput) > 0.01 && currentAngularSpeed < maxAngularSpeed) {
      // 입력이 있고 최대 각속도 미만일 때만 토크 적용
      const torqueStrength = this.rollInput * this.rollAcceleration * this.rollInertia;
      const torqueVector = yawAxis.multiplyScalar(torqueStrength);
      
      rigidBody.addTorque({ 
        x: torqueVector.x, 
        y: torqueVector.y, 
        z: torqueVector.z 
      }, true);
    } else if (Math.abs(this.rollInput) <= 0.01 && currentAngularSpeed > 0.01) {
      // 입력이 없을 때 비례적 ease-out 제동 (부드럽게 먈춤)
      const speedRatio = Math.min(currentAngularSpeed / THREE.MathUtils.degToRad(this.rollSpeed), 1.0);
      const brakingStrength = -Math.sign(currentAngularVel.y) * this.rollAcceleration * this.rollInertia * speedRatio * 0.8;
      const brakingVector = yawAxis.multiplyScalar(brakingStrength);
      
      rigidBody.addTorque({ 
        x: brakingVector.x, 
        y: brakingVector.y, 
        z: brakingVector.z 
      }, true);
    }
  }

  /**
   * 🚀 힘 기반 추진 제어 - 자연스러운 가속/감속 구현
   */
  private applyThrustForces(rigidBody: RAPIER.RigidBody, currentRotation: THREE.Quaternion): void {
    // 전진 방향 벡터 계산
    const forwardAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(currentRotation);
    
    // 현재 속도 확인 및 최대 속도 제한
    const currentVelocity = rigidBody.linvel();
    const currentSpeed = Math.sqrt(
      currentVelocity.x * currentVelocity.x + 
      currentVelocity.y * currentVelocity.y + 
      currentVelocity.z * currentVelocity.z
    );
    
    if (Math.abs(this.thrustInput) > 0.01 && currentSpeed < this.thrustSpeed) {
      // 입력이 있고 최대 속도 미만일 때만 추진력 적용
      const thrustForce = this.thrustInput * this.thrustAcceleration;
      const forceVector = forwardAxis.multiplyScalar(thrustForce);
      
      rigidBody.addForce({ 
        x: forceVector.x, 
        y: forceVector.y, 
        z: forceVector.z 
      }, true);
    } else if (Math.abs(this.thrustInput) <= 0.01 && currentSpeed > 0.01) {
      // 입력이 없을 때 비례적 ease-out 제동 (부드럽게 먈춤)
      const currentVel = rigidBody.linvel();
      const speedRatio = Math.min(currentSpeed / this.thrustSpeed, 1.0);
      const brakingStrength = this.thrustAcceleration * speedRatio * 1.2; // 속도에 비례하는 부드러운 제동
      const brakingForce = new THREE.Vector3(-currentVel.x, -currentVel.y, -currentVel.z)
        .normalize()
        .multiplyScalar(brakingStrength);
      
      rigidBody.addForce({ 
        x: brakingForce.x, 
        y: brakingForce.y, 
        z: brakingForce.z 
      }, true);
    }
  }







  // --- 디버깅용 메서드들 ---
  getRollInput(): number { return this.rollInput; }
  getThrustInput(): number { return this.thrustInput; }
  getCurrentRollVelocity(): number { return 0; } // 물리 엔진에서 관리되므로 0 반환
  getCurrentThrustVelocity(): number { return 0; } // 물리 엔진에서 관리되므로 0 반환
  getCurrentPitchVelocity(): number { return 0; } // 물리 엔진에서 관리되므로 0 반환
  getCurrentRollAngle(): number { return THREE.MathUtils.radToDeg(this.currentRollAngle); }
  getBankingYawVelocity(): number { return 0; } // 수평 비행에서는 Y축 회전 사용 안함
  getRollSpeed(): number { return this.rollSpeed; }
  getThrustSpeed(): number { return this.thrustSpeed; }
  getBankingToTurnFactor(): number { return this.bankingToTurnFactor; }
  getIsTurning(): boolean { return this.isTurning; }
  getTurnPitchCompensation(): number { return this.turnPitchCompensation; }
  getCoordinatedTurnFactor(): number { return this.coordinatedTurnFactor; }

  // --- 🛩️ 새로운 가속도 기반 제어 매개변수 getter/setter ---
  getThrustAcceleration(): number { return this.thrustAcceleration; }
  setThrustAcceleration(value: number): void { this.thrustAcceleration = value; }
  
  getRollAcceleration(): number { return this.rollAcceleration; }
  setRollAcceleration(value: number): void { this.rollAcceleration = value; }
  
  getAirResistance(): number { return this.airResistance; }
  setAirResistance(value: number): void { this.airResistance = value; }
  
  getRotationalDrag(): number { return this.rotationalDrag; }
  setRotationalDrag(value: number): void { this.rotationalDrag = value; }
  
  getRollInertia(): number { return this.rollInertia; }
  setRollInertia(value: number): void { this.rollInertia = value; }
  
  getPitchInertia(): number { return this.pitchInertia; }
  setPitchInertia(value: number): void { this.pitchInertia = value; }
}
