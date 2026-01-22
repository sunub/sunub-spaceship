import { Howl, Howler } from "howler"

const PLAYLIST_CONFIG = [
    {
        path: "sounds/background_nebula-the-grey-room.ogg",
        name: "background",
        volume: 0.15,
        loop: true,
        html5: true,
    },
    {
        path: "sounds/button-sound_glass.ogg",
        name: "button",
        volume: 0.3,
        loop: false,
        html5: false,
    },
    {
        path: "sounds/engine_thrusterFire.aac",
        name: "engine",
        volume: 0.2,
        loop: true,
        html5: false,
    },
    {
        path: "sounds/portal-sound_forceField.aac",
        name: "portal",
        volume: 0.15,
        loop: false,
        html5: false,
    },
] as const

export type SoundName = (typeof PLAYLIST_CONFIG)[number]["name"]

export interface SoundItem {
    config: (typeof PLAYLIST_CONFIG)[number]
    sound: Howl
}

export type Songs = Record<SoundName, SoundItem>

export class Audio {
    public songs: Partial<Songs> = {}
    public mute: { active: boolean } = { active: false }

    constructor() {
        this.initialize()
    }

    async initialize() {
        this.setPlaylist()
    }

    private setPlaylist() {
        for (const config of PLAYLIST_CONFIG) {
            this.songs[config.name] = {
                config,
                sound: new Howl({
                    src: [config.path],
                    volume: config.volume,
                    loop: config.loop,
                    html5: config.html5,
                }),
            }
        }
    }

    public play(name: SoundName) {
        this.songs[name]?.sound.play()
    }

    public isPlaying(name: SoundName) {
        return this.songs[name]?.sound.playing() ?? false
    }

    public stop(name: SoundName) {
        this.songs[name]?.sound.stop()
    }

    public handleSoundControl() {
        // 슬라이더 움직임에 따라 파동 위치 업데이트
        const input = document.querySelector(
            ".volume-input",
        ) as HTMLInputElement
        this.updateWavePosition(input)

        const button = document.querySelector(".mute-btn") as HTMLElement
        this.toggleMute(button)
    }

    public muteActivate() {
        if (this.mute.active) {
            return
        }

        Howler.mute(true)
        this.mute.active = true
        localStorage.setItem("soundToggle", "1")
    }

    public muteDeactivate() {
        if (!this.mute.active) {
            return
        }

        Howler.mute(false)
        this.mute.active = false
        localStorage.setItem("soundToggle", "0")
    }

    private updateWavePosition(input: HTMLInputElement) {
        const wave_origin = document.getElementById(
            "wave-origin",
        ) as HTMLElement
        wave_origin.style.left = `${input.value}%`
    }

    // 아이콘 토글 (Mute/Unmute)
    private toggleMute(btn: HTMLElement) {
        const icon = btn.querySelector(
            ".material-symbols-outlined",
        ) as HTMLElement
        icon.innerText =
            icon.innerText === "volume_up" ? "volume_off" : "volume_up"
    }

    public update(_: number) {}
}
