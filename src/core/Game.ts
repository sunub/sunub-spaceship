import { inject, injectable } from "inversify";
import { GAME_CONTEXT } from "@/core/DI/DITypes";
import { GameEvents } from "@/core/EventBus/EventBusType";
import type { WorldManager } from "../Manager/WorldManager";
import type { ProjectManager } from "../Manager/ProjectManager";
import type { EnvironmentManager } from "../Manager/EnvironmentManager";
import type { EventBus } from "@/core/EventBus/EventBus";
import type { SpaceShip } from "../Models";
import type { InputManager } from "@/Inputs/InputManager";
import type { InputIndicator } from "../UI/InputIndicator";
import type { Notification } from "../UI/Notification";
import type { TerminalOverlay } from "../UI/TerminalOverlay";
import type { SpaceShipCameraController } from "../Controllers/SpaceShipCameraController";
import type { Audio } from "../Environment/Audio";
import type Time from "@/utils/Time";

/**
 * Game 클래스는 게임 라이프사이클만 조율하는 thin orchestrator입니다.
 *
 * 책임 범위:
 *  - 게임 오브젝트 생성 조율 (WorldManager, ProjectManager 위임)
 *  - 환경 설정 조율 (EnvironmentManager 위임)
 *  - 게임 시작 시퀀스 (카메라 전환, 오디오, 알림)
 *  - 상호작용 브리지 (InputManager ↔ ProjectManager ↔ TerminalOverlay)
 *
 * 렌더링 루프, 물리, 리사이즈, 가시성 이벤트 등은
 * 각각 GameLoop, Physics, InputManager(EventBus) 등에서 독립적으로 처리됩니다.
 */
@injectable()
export class Game {
    public isReady = false;
    public spaceShip!: SpaceShip;
    private disposables: (() => void)[] = [];

    constructor(
        @inject(GAME_CONTEXT.MANAGER.WorldManager)
        private readonly worldManager: WorldManager,
        @inject(GAME_CONTEXT.MANAGER.ProjectManager)
        private readonly projectManager: ProjectManager,
        @inject(GAME_CONTEXT.CORE.EventBus)
        private readonly eventBus: EventBus,
        @inject(GAME_CONTEXT.FACTORY.SpaceShipFactory)
        private readonly spaceShipFactory: () => SpaceShip,
        @inject(GAME_CONTEXT.MANAGER.EnvironmentManager)
        private readonly environmentManager: EnvironmentManager,
        @inject(GAME_CONTEXT.UI.InputIndicator)
        private readonly inputIndicator: InputIndicator,
        @inject(GAME_CONTEXT.UI.Notification)
        private readonly notification: Notification,
        @inject(GAME_CONTEXT.UI.TerminalOverlay)
        private readonly terminalOverlay: TerminalOverlay,
        @inject(GAME_CONTEXT.CONTROLLER.SpaceShipCameraController)
        private readonly spaceShipCameraController: SpaceShipCameraController,
        @inject(GAME_CONTEXT.CORE.Audio)
        private readonly audio: Audio,
        @inject(GAME_CONTEXT.UTILITY.Time)
        private readonly time: Time,
        @inject(GAME_CONTEXT.MANAGER.InputManager)
        private readonly inputManager: InputManager,
    ) {}

    /**
     * Phase 3a: 월드 오브젝트와 SpaceShip을 생성하고 초기화합니다.
     */
    public async prepareGameObjects(): Promise<void> {
        await this.worldManager.prepareGameObjects();
        await this.projectManager.initialize();

        const spaceShip = this.spaceShipFactory();
        await spaceShip.initialize();
        this.worldManager.addGameObject(spaceShip);
        this.spaceShip = spaceShip;
    }

    /**
     * Phase 3b: 환경 설정(안개 등)과 UI 시스템을 초기화하고
     * InputManager ↔ ProjectManager ↔ TerminalOverlay 간의
     * 상호작용 브리지를 설정합니다.
     */
    public setupEnvironment(): void {
        this.environmentManager.setup();
        this.inputIndicator.initialize();
        this.setupInteractionBridge();
    }

    /**
     * Phase 4: 게임을 시작합니다.
     * 오디오 재생, PLAYER_READY 이벤트 발행, 카메라 전환,
     * 알림 표시 후 SpaceShip 조작을 활성화합니다.
     */
    public async startGame(): Promise<void> {
        this.isReady = true;
        this.time.reset(performance.now());

        if (this.spaceShip?.rigidBody) {
            this.eventBus.emit(GameEvents.PLAYER_READY, {
                spaceshipRigidBody: this.spaceShip.rigidBody,
            });
        }

        this.audio.play("background");
        this.showControlGroup();

        if (this.spaceShip?.shipPivot) {
            await this.spaceShipCameraController.transitionToFollow(
                this.spaceShip.shipPivot,
                this.spaceShip.flightCameraOffset,
                2.0,
            );
        }

        this.notification.show(
            "조작키를 사용하여 우주선을 조작해 프로젝트 영역을 찾아주세요",
            3000,
        );
        this.spaceShip.unlock();
    }

    /**
     * InputManager의 "Interact" 액션을 게임 시스템들과 연결합니다.
     *
     * 흐름:
     *  1. E키 → 터미널 열려있으면 닫기
     *  2. E키 → 터미널 닫혀있으면 ProjectManager에 상호작용 위임
     *  3. TERMINAL_OPENED → SpaceShip 잠금
     *  4. TERMINAL_CLOSED → SpaceShip 잠금 해제
     */
    private setupInteractionBridge(): void {
        const unsubInteract = this.inputManager.subscribe(
            "Interact",
            (isPressed) => {
                if (!isPressed) return;

                if (this.terminalOverlay.isOpen) {
                    this.terminalOverlay.hide();
                    return;
                }

                this.projectManager.handleInteraction();
            },
        );
        this.disposables.push(unsubInteract);

        const unsubOpen = this.eventBus.on(GameEvents.TERMINAL_OPENED, () => {
            this.spaceShip?.lock();
        });
        this.disposables.push(unsubOpen);

        const unsubClose = this.eventBus.on(GameEvents.TERMINAL_CLOSED, () => {
            this.spaceShip?.unlock();
        });
        this.disposables.push(unsubClose);
    }

    private showControlGroup(): void {
        const controlGroup = document.querySelector<HTMLElement>(".control-group");
        if (controlGroup) {
            controlGroup.style.display = "flex";
            requestAnimationFrame(() => {
                controlGroup.style.opacity = "var(--control-group-opacity)";
                controlGroup.style.visibility = "var(--control-group-visibility)";
            });
        }
    }

    public dispose(): void {
        this.disposables.forEach((d) => d());
        this.disposables = [];
    }
}
