# 구현 계획 - TreeLights 베이크드 재질 최적화 (Baked Material Optimization)

## 목표 설명 (Goal Description)
`TreeLights` 모델에 베이크드 텍스처(`baked_tree_light.ktx2`)를 적용하여 런타임 조명 연산 비용을 줄이면서도 발광 효과(Emission)를 극대화합니다. `MeshDefaultMaterial`을 활용하여 성능과 시각적 품질의 균형을 맞춥니다.

## 기술 구성 (Tech Stack)
- **Baked Texture**: `baked_tree_light.ktx2` (KTX2 압축 텍스처)
- **Material**: `MeshDefaultMaterial` 기반 (TSL 활용)

## 제안된 변경 사항 (Proposed Changes)

### [src/widgets/Models/TreeLights/TreeLights.ts]
- **컬러 노드 설정**: `colorNode`를 `color(0x000000)`(검은색)으로 설정하여 동적 디퓨즈 조명을 무시합니다.
- **이미시브 노드 설정**: `emissionNode`를 `texture(treeLightTexture)`로 연결하여 베이크드 텍스처 자체가 빛나도록 구현합니다.
- **최적화 옵션**:
    - `hasCoreShadows: false`
    - `hasDropShadows: false`
    - `hasLightBounce: false`
    - 자가 발광 물체이므로 불필요한 그림자 및 반사 연산을 비활성화하여 GPU 부하를 경감합니다.

## 검증 계획 (Verification Plan)
1. **시각적 정합성**: 트리 라이트가 텍스처에 정의된 대로 밝게 빛나고 있는가?
2. **성능 확인**: 많은 수의 나무가 배치된 상황에서도 안정적인 프레임이 유지되는가?
3. **효과 확인**: 리빌(Reveal) 효과 등이 재질과 충돌 없이 정상 작동하는가?
