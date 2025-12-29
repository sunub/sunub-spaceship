
uniform vec3 uLightPosition;
uniform vec3 uDarkColor;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uLightRadius;
uniform float uTime;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  // 빛의 중심으로부터의 거리 계산
  float distance = length(uLightPosition - vWorldPosition);
  
  // 거리에 따른 빛의 감쇠
  float attenuation = 1.0 - smoothstep(0.0, uLightRadius, distance);
  
  // 시간에 따른 미세한 변동
  float timeVariation = sin(uTime * 0.5) * 0.1 + 0.9;
  attenuation *= timeVariation;
  
  // 최종 색상 계산
  vec3 finalColor = mix(uDarkColor, uLightColor, attenuation * uLightIntensity);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
