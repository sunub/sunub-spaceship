import { Vector3 } from "three/webgpu"
import type { FolderApi } from "tweakpane"
import type { Camera } from "../instances/Camera"
import type { CameraConfig } from "../types"

/**
 * 🎯 Camera Target Debug Module
 * 카메라 타겟 위치 실시간 조정 담당
 */
export class CameraTargetDebugModule {
    constructor(
        private camera: Camera,
        private cameraParams: CameraConfig,
    ) {}

    /**
     * Camera Target 관련 디버그 컨트롤 설정
     */
    setupDebugControls(parentFolder: FolderApi): void {
        const targetFolder = parentFolder.addFolder({
            title: "🎯 Camera Target",
            expanded: true,
        })

        const updateTarget = () => {
            console.log(this.camera.mode)
            this.camera.mode = "orbit"
            const newTarget = new Vector3(
                this.cameraParams.targetX,
                this.cameraParams.targetY,
                this.cameraParams.targetZ,
            )
            if (this.camera.orbitControls) {
                this.camera.orbitControls.target.copy(newTarget)
                this.camera.orbitControls.update()
            }

            this.camera.instance.lookAt(newTarget)
        }

        targetFolder
            .addBinding(this.cameraParams, "targetX", {
                min: -5,
                max: 5,
                step: 0.1,
                label: "TargetX",
            })
            .on("change", updateTarget)
        targetFolder
            .addBinding(this.cameraParams, "targetY", {
                min: -5,
                max: 5,
                step: 0.1,
                label: "TargetY",
            })
            .on("change", updateTarget)
        targetFolder
            .addBinding(this.cameraParams, "targetZ", {
                min: -5,
                max: 5,
                step: 0.1,
                label: "TargetZ",
            })
            .on("change", updateTarget)

        targetFolder
            .addBinding(this.camera, "mode", {
                options: {
                    Follow: "follow",
                    Orbit: "orbit",
                    Entry: "entry",
                },
            })
            .on("change", (ev) => {
                this.camera.mode = ev.value
            })

        // targetFolder.addBlade({
        //   view: 'list',
        //   label: 'Mode',
        //   options: [
        //     { value: 'follow', text: 'Follow' }, // label -> text 로 변경
        //     { value: 'orbit', text: 'Orbit' },
        //     { value: 'entry', text: 'Entry' },
        //   ],
        //   value: this.camera.mode,
        // })
    }
}
