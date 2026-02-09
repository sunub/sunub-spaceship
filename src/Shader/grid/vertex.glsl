varying vec2 vUv;

void main() {
  // 1. 모델 매트릭스를 적용하여 로컬 좌표(position)를 월드 좌표로 변환합니다.
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  
  // 2. 바닥은 xz 평면에 있으므로, 월드 좌표의 xz 값을 vUv로 fragment shader에 전달합니다.
  // 이제 vUv는 0~1 범위가 아닌, -무한대 ~ +무한대 범위의 월드 좌표가 됩니다.
  vUv = worldPosition.xz; 

  // 3. gl_Position 계산은 표준적인 방법을 그대로 사용합니다.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
