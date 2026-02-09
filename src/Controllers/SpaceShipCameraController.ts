import { inject, injectable } from "inversify";
import { Vector3, Object3D } from "three/webgpu";
import { GAME_CONTEXT } from "@/core/DI/DITypes";
import type { Camera } from "@/Camera/instances/Camera";
import type { EventBus } from "@/core/EventBus/EventBus";
import { GameEvents } from "@/core/EventBus/EventBusType";

@injectable()
export class SpaceShipCameraController {
    private _target: Object3D | null = null;
    private _offset: Vector3 = new Vector3(8, 20, 10);
    private _lerpSpeed: number = 0.12;

    constructor(
        @inject(GAME_CONTEXT.CORE.Camera) private readonly camera: Camera,
        @inject(GAME_CONTEXT.CORE.EventBus) private readonly eventBus: EventBus,
    ) {

        this._setupListeners();

    }

    private _setupListeners(): void {

        this.eventBus.on(GameEvents.KEYBOARD_INPUT, (payload) => {

            if ( Math.abs(payload.roll) > 0 || Math.abs(payload.thrust) > 0 ) {

                this.ensureFollowMode();

            }

        });

    }

    public setTarget(target: Object3D, offset?: Vector3, lerpSpeed?: number): void {

        this._target = target;
        if ( offset ) this._offset = offset;
        if ( lerpSpeed !== undefined ) this._lerpSpeed = lerpSpeed;

    }

    public ensureFollowMode(): void {

        if ( !this._target ) return;

        if ( this.camera.mode !== 'follow' ) {

            this.camera.setFollowTargetObject(this._target, this._offset, this._lerpSpeed);
            this.camera.mode = 'follow';
            
            if ( this.camera.orbitControls ) {

                this.camera.orbitControls.enabled = false;

            }

        }

        this.camera.stopManualControl();

    }

    public async transitionToFollow(target: Object3D, offset: Vector3, duration: number = 2.0): Promise<void> {

        this.setTarget(target, offset);
        const targetPos = target.getWorldPosition(new Vector3());

        if ( this.camera.orbitControls ) {

            this.camera.orbitControls.enabled = false;

        }

        this.camera.setFollowTargetObject(target, offset, this._lerpSpeed);
        await this.camera.transitionTo(
            'follow',
            offset,
            targetPos,
            duration
        );

    }

}
