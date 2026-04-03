# 구현 계획 - 터미널 오버레이 모바일 반응형 개선 (Mobile Responsive Optimization)

## 목표 설명 (Goal Description)
`TerminalOverlay`가 모바일 디스플레이 환경(<425px)에서 정상적으로 표시되지 않는 문제를 해결합니다. CSS의 컨테이너 쿼리(Container Query)와 클램프(`clamp()`) 함수를 조화롭게 사용하여 반응형 레이아웃을 최적화합니다.

## 기술 구성 (Tech Stack)
- **CSS 기능**: Container Query (`cqw`, `cqh`), `clamp()`, `sticky position`.
- **레이아웃**: Flexbox를 활용한 상단 고정 헤더와 스크롤 가능한 컨텐츠 영역 분리.

## 제안된 변경 사항 (Proposed Changes)

### [src/terminalOverlay.css] / [src/widgets/UI/TerminalOverlay.ts]
- **레이아웃 재정의**:
    - `.container`를 수직 플렉스박스로 설정하여 로고/타이틀 영역은 상단에 고정, 상세 설명 영역만 스크롤 되도록 분리.
- **반응형 타이포그래피**:
    - `h1`: `clamp(1.5rem, 8cqw, 3rem)` 등으로 컨테이너 너비에 맞춰 폰트 크기 조절.
- **버튼 접근성 강화**:
    - 최소 터치 타겟(44x44px) 확보.
    - "Back to Flight" 버튼을 하단에 항상 고정하거나 헤더 영역에 노출하여 조작 용이성 증대.

## 검증 계획 (Verification Plan)
1. **디바이스 시뮬레이션**: iPhone SE, iPhone 12 Pro 등 다양한 모바일 크기에서 레이아웃 깨짐이 없는지 확인.
2. **스크롤 확인**: 상세 내용이 길어도 정상적으로 스크롤되며 상단 로고가 가려지지 않는가?
3. **상호작용**: 모바일 기기에서 버튼 클릭 조작이 원활한가?
