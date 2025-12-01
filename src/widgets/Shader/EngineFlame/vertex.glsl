// vertexShader.glsl

// 프래그먼트 셰이더로 vUv 변수(0.0 ~ 1.0)를 넘깁니다.
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
