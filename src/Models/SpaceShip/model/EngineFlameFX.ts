import { Object3D, Vector3 } from "three/webgpu";
import { EngineFlame } from "../../EngineFlame";
import type Time from "@/utils/Time";
import type { Camera } from "@/Camera/instances/Camera";

export class EngineFlameFX {
    private engineFlames: EngineFlame[] = [];

    private currentFlameLength: number = 0.1;
    private readonly maxFlameLength: number = 1.5;
    private readonly flameGrowthSpeed: number = 1.0;
    private readonly flameShrinkSpeed: number = 1.2;

    constructor(
        private readonly time: Time,
        private readonly camera: Camera,
    ) {}

    public async initialize(visualPivot: Object3D): Promise<void> {
        const positions = [
            new Vector3(-1.1, -0.15, -0.15),
            new Vector3(-1.1, -0.15, 0.175),
        ];

        for (const pos of positions) {
            const flame = new EngineFlame(pos);
            flame.modelGroup.rotateZ(1.55);
            this.engineFlames.push(flame);

            visualPivot.add(flame.modelGroup);
        }

        const initPromises = this.engineFlames.map((flame) =>
            flame.initialize(this.time, this.camera),
        );

        await Promise.all(initPromises);
    }

    public update(thrustLevel: number): void {
        const absThrust = Math.abs(thrustLevel);
        const deltaTime = this.time.delta;

        if (absThrust > 0.05) {
            this.currentFlameLength = Math.min(
                this.maxFlameLength,
                this.currentFlameLength + this.flameGrowthSpeed * deltaTime,
            );
        } else {
            this.currentFlameLength = Math.max(
                0.1,
                this.currentFlameLength - this.flameShrinkSpeed * deltaTime,
            );
        }

        for (const flame of this.engineFlames) {
            flame.setThrust(absThrust);
            flame.setFlameLength(this.currentFlameLength);
            flame.update(deltaTime);
        }
    }
}
