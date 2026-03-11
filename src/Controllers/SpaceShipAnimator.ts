import { injectable } from "inversify";
import { Object3D } from "three/webgpu";

@injectable()
export class SpaceShipAnimator {
    private _visualPivot: Object3D | null = null;
    private _maxBankingAngle: number = Math.PI / 4.5;

    public initialize(visualPivot: Object3D, maxBankingAngle: number): void {
        this._visualPivot = visualPivot;
        this._maxBankingAngle = maxBankingAngle;
    }

    public updateBanking(
        rollInput: number,
        deltaTime: number,
        responseSpeed: number,
    ): void {
        if (!this._visualPivot) return;

        let targetAngle = Math.abs(rollInput) > 0.01 ? rollInput * this._maxBankingAngle : 0;

        targetAngle = Math.max(
            -this._maxBankingAngle,
            Math.min(this._maxBankingAngle, targetAngle)
        );

        const smoothing = 1 - Math.exp(-Math.max(responseSpeed, 0.001) * deltaTime);
        this._visualPivot.rotation.x +=
            (targetAngle - this._visualPivot.rotation.x) * smoothing;
    }

    public setMaxBankingAngle(angleRad: number): void {
        this._maxBankingAngle = angleRad;
    }
}
