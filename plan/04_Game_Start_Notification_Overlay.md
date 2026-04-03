# 구현 계획 - 게임 시작 안내 시스템 (Notification Overlay)

## 목표 설명 (Goal Description)
새로운 사용자가 게임에 접속했을 때 수행해야 할 목표와 조작 방법을 직관적으로 제공하기 위해 "토스트(Toast)" 스타일의 안내 알림 시스템을 구현합니다. UI는 전체적인 네온/사이버펑크 미학을 유지하며 비동기적인 피드백을 제공합니다.

## 기술 구성 (Tech Stack)
- **UI 구조**: React나 복잡한 라이브러리 대신, 가벼운 **바닐라 DOM** 조작(Overlay) 방식 채택.
- **스타일**: CSS `fade-in`/`fade-out` 애니메이션을 통한 부드러운 전환 및 글래스모피즘(Glassmorphism) 효과 적용.

## 제안된 변경 사항 (Proposed Changes)

### [NEW] `src/widgets/UI/Notification.ts`
- `Notification` 클래스 정의:
    - 알림용 컨테이너 생성 및 `document.body`에 추가.
    - `show(message: string, duration: number)` 메서드: 메시지 설정, 페이드 인, 일정 시간 후 자동 페이드 아웃 로직 포함.

### [MODIFY] `src/style.css`
- `.notification-container` 및 관련 애니메이션 CSS 추가.
- 고정(fixed) 위치 설정으로 우주선 비행 중에도 시인성 확보.

### [MODIFY] `src/widgets/Game.ts`
- 게임 로드 후 `spawn()` 또는 `startGame()` 호출 시점에 안내 메시지 출력:
    - "조작키를 사용하여 우주선을 조작해 프로젝트 영역을 찾아주세요."

## 검증 계획 (Verification Plan)
1. **시각적 정렬**: 알림창이 화면 중앙 상단에 적절히 배치되며 디자인이 일관된가?
2. **동작 확인**: 5초 뒤에 알림창이 부드럽게 사라지는가?
3. **타이밍 확인**: 게임 시작 직후(카메라 전환 시점 등)에 적절하게 나타나는가?
