# 구현 계획 - 오디오 시스템 지속성 및 볼륨 제어 (Audio Persistence & Volume Control)

## 목표 설명 (Goal Description)
`src/widgets/Audio.ts`에서 오디오 볼륨 조절, 음소거(Mute) 전환 및 이를 `localStorage`에 저장하여 세션이 바뀌어도 설정이 유지되는 시스템을 구축합니다. 사용자가 드래그하는 슬라이더 소리와 버튼 클릭 음소거 설정을 영속적으로 관리합니다.

## 기술 구성 (Tech Stack)
- **Library**: `Howler.js` (Master volume, mute).
- **Persistence**: `localStorage` (`"volumeLevel"`, `"soundToggle"`).

## 제안된 변경 사항 (Proposed Changes)

### [src/widgets/Audio.ts]
- **초기화 로직**: `initialize()` 시점에 `localStorage`에서 저장된 볼륨 값과 음소거 여부를 읽어와 `Howler.volume()`과 `Howler.mute()`에 즉시 적용.
- **UI 연동**:
    - `.volume-input` (Slider)의 `input` 이벤트 발생 시 실시간 볼륨 업데이트 및 저장.
    - `.mute-btn` 클릭 시 음소거 토글 처리 및 저장.
- **시각적 업데이트**: 볼륨과 음소거 상태의 변화를 UI 아이콘(`volume_up`, `volume_off`)과 슬라이더 위치에 즉각 반영.

## 검증 계획 (Verification Plan)
1. **지속성 테스트**: 볼륨을 특정 위치(예: 0.5)로 설정하고 새로고침 시 이 설정이 유지되는가?
2. **기능성 테스트**: 슬라이더를 0으로 드래그할 때 실제로 소리가 들리지 않으며, 음소거 버튼이 음소거 상태를 정확히 반영하는가?
3. **상태 동기화**: `Howler` 엔진의 실제 볼륨과 UI 인디케이터가 항상 일치하는가?
