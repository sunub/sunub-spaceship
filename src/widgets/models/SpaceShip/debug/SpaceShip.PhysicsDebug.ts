import type { FolderApi } from "tweakpane";
import type { FlightController } from "@/widgets/controllers/FlightController"; 

/**
 * 🛩️ SpaceShip Physics Debug Module
 * FlightController의 물리 파라미터 실시간 조정 및 디버깅 담당
 */
export class SpaceShipPhysicsDebugModule {
  constructor(private flightController: FlightController) {}

  /**
   * Physics 관련 디버그 컨트롤 설정
   */
  setupDebugControls(parentFolder: FolderApi): void {
    this.setupFlightInputButtons(parentFolder);
    this.setupPhysicsParameterControls(parentFolder);
    this.setupFlightStatusButton(parentFolder);
  }

  /**
   * 비행 입력 상태 조회 버튼들
   */
  private setupFlightInputButtons(parentFolder: FolderApi): void {
    parentFolder.addButton({ title: "Flight Inputs" }).on("click", () => {
      console.log("Roll Input:", this.flightController.getRollInput().toFixed(2));
      console.log("Thrust Input:", this.flightController.getThrustInput().toFixed(2));
    });

    parentFolder.addButton({ title: "Current Velocities" }).on("click", () => {
      console.log("Y-axis Rotation (Horizontal Turn):", this.flightController.getCurrentRollVelocity().toFixed(2), "rad/s");
      console.log("Thrust Velocity:", this.flightController.getCurrentThrustVelocity().toFixed(2), "m/s");
      console.log("Z-axis Rotation (Pitch):", this.flightController.getCurrentPitchVelocity().toFixed(2), "rad/s");
    });

    parentFolder.addButton({ title: "Banking-to-Turn Info" }).on("click", () => {
      console.log("Current Y-rotation Angle:", this.flightController.getCurrentRollAngle().toFixed(2), "°");
      console.log("Banking Factor:", this.flightController.getBankingToTurnFactor());
      console.log("Is Turning:", this.flightController.getIsTurning());
      console.log("Pitch Compensation:", this.flightController.getTurnPitchCompensation());
    });

    parentFolder.addButton({ title: "Speed Settings" }).on("click", () => {
      console.log("Max Roll Speed:", this.flightController.getRollSpeed(), "deg/s");
      console.log("Max Thrust Speed:", this.flightController.getThrustSpeed(), "m/s");
      console.log("🚀 Thrust Acceleration:", this.flightController.getThrustAcceleration(), "m/s²");
      console.log("🔄 Roll Acceleration:", this.flightController.getRollAcceleration(), "rad/s²");
      console.log("🛑 Air Resistance:", this.flightController.getAirResistance());
      console.log("🌀 Rotational Drag:", this.flightController.getRotationalDrag());
    });
  }

  /**
   * 실시간 물리 파라미터 조정 슬라이더들
   */
  private setupPhysicsParameterControls(parentFolder: FolderApi): void {
    const physicsFolder = parentFolder.addFolder({ title: "✈️ Realistic Flight Physics", expanded: true });
    
    const physicsParams = {
      thrustAcceleration: this.flightController.getThrustAcceleration(),
      rollAcceleration: this.flightController.getRollAcceleration(),
      airResistance: this.flightController.getAirResistance(),
      rotationalDrag: this.flightController.getRotationalDrag(),
      rollInertia: this.flightController.getRollInertia(),
      pitchInertia: this.flightController.getPitchInertia()
    };

    physicsFolder.addBinding(physicsParams, 'thrustAcceleration', {
      min: 1.0, max: 15.0, step: 0.5,
      label: '🚀 Thrust Accel'
    }).on('change', (ev) => {
      this.flightController.setThrustAcceleration(ev.value);
    });

    physicsFolder.addBinding(physicsParams, 'rollAcceleration', {
      min: 0.5, max: 8.0, step: 0.2,
      label: '🔄 Roll Accel'
    }).on('change', (ev) => {
      this.flightController.setRollAcceleration(ev.value);
    });

    physicsFolder.addBinding(physicsParams, 'airResistance', {
      min: 0.7, max: 0.99, step: 0.01,
      label: '🛑 Air Resistance'
    }).on('change', (ev) => {
      this.flightController.setAirResistance(ev.value);
    });

    physicsFolder.addBinding(physicsParams, 'rotationalDrag', {
      min: 0.7, max: 0.99, step: 0.01,
      label: '🌀 Rotation Drag'
    }).on('change', (ev) => {
      this.flightController.setRotationalDrag(ev.value);
    });

    physicsFolder.addBinding(physicsParams, 'rollInertia', {
      min: 0.5, max: 3.0, step: 0.1,
      label: '⚖️ Roll Inertia'
    }).on('change', (ev) => {
      this.flightController.setRollInertia(ev.value);
    });

    physicsFolder.addBinding(physicsParams, 'pitchInertia', {
      min: 0.5, max: 4.0, step: 0.1,
      label: '📐 Pitch Inertia'
    }).on('change', (ev) => {
      this.flightController.setPitchInertia(ev.value);
    });
  }

  /**
   * 종합 비행 상태 정보 버튼
   */
  private setupFlightStatusButton(parentFolder: FolderApi): void {
    parentFolder.addButton({ title: "Horizontal Flight Control" }).on("click", () => {
      console.log("🛩️ === HORIZONTAL FLIGHT CONTROL STATUS ===");
      console.log("📊 INPUTS:");
      console.log("  Roll Input (A/D → Y-axis rotation):", this.flightController.getRollInput().toFixed(2));
      console.log("  Thrust Input (W/S):", this.flightController.getThrustInput().toFixed(2));
      console.log("  Is Turning (WA/WD):", this.flightController.getIsTurning());
      
      console.log("⚡ VELOCITIES:");
      console.log("  Y-axis Rotation (Horizontal Turn):", this.flightController.getCurrentRollVelocity().toFixed(3), "rad/s");
      console.log("  Z-axis Rotation (Pitch):", this.flightController.getCurrentPitchVelocity().toFixed(3), "rad/s");
      console.log("  Thrust Velocity:", this.flightController.getCurrentThrustVelocity().toFixed(2), "m/s");
      
      console.log("📐 CURRENT ATTITUDES:");
      console.log("  Current Y-rotation Angle:", this.flightController.getCurrentRollAngle().toFixed(2), "°");
      
      console.log("⚙️ CONTROL FACTORS:");
      console.log("  Banking-to-Turn Factor:", this.flightController.getBankingToTurnFactor());
      console.log("  Pitch Compensation:", this.flightController.getTurnPitchCompensation());
    });
  }
}
