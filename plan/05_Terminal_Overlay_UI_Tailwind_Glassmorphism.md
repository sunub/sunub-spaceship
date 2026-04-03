# 구현 계획 - 터미널 오버레이 UI 디자인 업데이트 (Tailwind & Glassmorphism)

## 목표 설명 (Goal Description)
`TerminalOverlay` 컴포넌트를 현대적이고 세련된 디자인으로 업데이트합니다. Tailwind CSS CDN을 활용하여 글래스모피즘(Glassmorphism), 네온 컬러 시스템, 그리고 다크/라이트 모드 지원을 포함한 시각적 스타일을 적용합니다.

## 제안된 변경 사항 (Proposed Changes)

### [src/widgets/UI/TerminalOverlay.ts]
- **Tailwind CSS 주입**: CDN 스크립트와 설정을 런타임에 삽입하는 로직 추가.
- **`show(project)` 메서드 고도화**:
    - 프로젝트 데이터(`id`, `title`, `description`, `tags`, `image`, `url`)를 새로운 HTML 구조에 매핑.
    - 배경 그라데이션 및 블롭(Blob) 애니메이션 요소 추가.
    - 스크롤바와 글래스 효과를 위한 커스텀 스타일 적용.
- **이벤트 리스너**:
    - "Back to Portfolio" 클릭 시 `hide()` 연동.
    - "Launch Project" 클릭 시 새 탭에서 프로젝트 URL 열기.

## 검증 계획 (Verification Plan)
1. **시각적 정합성**: 디자인 시안과 일치하는 글래스모피즘 효과와 네온 컬러가 적용되었는가?
2. **데이터 바인딩**: 각 프로젝트의 제목, 설명, 태그, 이미지가 정확하게 표시되는가?
3. **인터랙션**: 닫기 버튼과 프로젝트 실행 버튼이 의도대로 작동하는가?
