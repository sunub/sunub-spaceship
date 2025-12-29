precision highp float;

uniform float uTime;
uniform vec2 uColorStop1;
uniform vec2 uColorStop2;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uEmissionColor;
uniform float uEmissionStrength;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

// 노이즈 함수 추가
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  // 노이즈 효과 생성
  vec2 noiseUv = vUv * 3.0;
  float noise = random(noiseUv + uTime * 0.1) * 0.05;
  
  // 확장된 베이스 그라디언트
  float baseGradient = smoothstep(uColorStop1.x - 0.9, uColorStop1.y + 0.2, vUv.y + noise);
  vec3 baseColor = mix(uColor1, uColor2, baseGradient);
  
  // 전체적인 발광 효과
  float emissionGradient = smoothstep(uColorStop2.x, uColorStop2.y, vUv.y + noise);
  
  // 하단 발광 효과 추가
  float bottomEmission = smoothstep(0.3, 0.0, vUv.y) * 0.8;
  
  // 발광 효과 결합
  vec3 emission = uEmissionColor * (emissionGradient + bottomEmission) * uEmissionStrength;
  
  // 시간 기반 펄스 효과
  float pulse = 1.0 + 0.2 * sin(uTime * .0);
  emission *= pulse;
  
  // 프레넬 효과 추가
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 3.0);
  
  // 최종 색상 계산
  vec3 finalColor = baseColor + emission + (fresnel * uEmissionColor * 0.3);
  
  gl_FragColor = vec4(finalColor, 1.0);
}