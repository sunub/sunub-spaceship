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
        volume: 0.1,
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
    public volume: number = 0.5

    constructor() {
        this.initialize()
    }

    async initialize() {
        const savedVolume = localStorage.getItem("volumeLevel")
        const savedMute = localStorage.getItem("soundToggle")

        this.volume = savedVolume ? parseFloat(savedVolume) : 0.5
        this.mute.active = savedMute === "1"

        Howler.volume(this.volume)
        Howler.mute(this.mute.active)

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
        const input = document.querySelector(
            ".volume-input",
        ) as HTMLInputElement
        const wrapper = document.querySelector(".slider-wrapper") as HTMLElement
        const waveOrigin = document.getElementById("wave-origin") as HTMLElement

        if (input && wrapper && waveOrigin) {
            input.value = (this.volume * 100).toString()
            this.updateWavePosition(input, waveOrigin)

            const startInteraction = () => {
                wrapper.classList.add("active")
                this.updateWavePosition(input, waveOrigin)
            }

            const endInteraction = () => {
                wrapper.classList.remove("active")
            }

            input.addEventListener("mousedown", startInteraction)
            input.addEventListener("touchstart", startInteraction, {
                passive: true,
            })

            input.addEventListener("mouseup", endInteraction)
            input.addEventListener("touchend", endInteraction)

            input.addEventListener("input", (e) => {
                const target = e.target as HTMLInputElement
                const value = parseFloat(target.value) / 100

                this.volume = value
                Howler.volume(value)
                localStorage.setItem("volumeLevel", value.toString())

                this.updateWavePosition(target, waveOrigin)

                if (value > 0 && this.mute.active) {
                    this.muteDeactivate()
                    const muteBtn = document.querySelector(
                        ".mute-btn",
                    ) as HTMLElement
                    this.updateMuteIcon(muteBtn)
                }
            })
        }

        const button = document.querySelector(".mute-btn") as HTMLElement
        if (button) {
            this.updateMuteIcon(button)

            button.addEventListener("click", () => {
                if (this.mute.active) {
                    this.muteDeactivate()
                } else {
                    this.muteActivate()
                }
                this.updateMuteIcon(button)
            })
        }
    }

    public muteActivate() {
        if (this.mute.active) return

        Howler.mute(true)
        this.mute.active = true
        localStorage.setItem("soundToggle", "1")
    }

    public muteDeactivate() {
        if (!this.mute.active) return

        Howler.mute(false)
        this.mute.active = false
        localStorage.setItem("soundToggle", "0")
    }

    private updateWavePosition(
        input: HTMLInputElement,
        waveOrigin: HTMLElement,
    ) {
        if (waveOrigin) {
            const val = parseFloat(input.value)
            // Thumb width(12px)를 고려한 중앙 정렬 계산: calc(${val}% + (${6 - 12 * val / 100}px))
            const offset = 6 - (12 * val) / 100
            waveOrigin.style.left = `calc(${val}% + ${offset}px)`
        }
    }

    private updateMuteIcon(btn: HTMLElement | null) {
        if (!btn) return

        const icon = btn.querySelector(
            ".material-symbols-outlined",
        ) as HTMLElement
        if (icon) {
            icon.innerText = this.mute.active ? "volume_off" : "volume_up"
        }
    }

    public update(_: number) {}
}
