import * as THREE from "three/webgpu";
import Grid from "./Grid";

interface GridMaterialOptions {
  gridDensity?: number;
  gridThickness?: number;
}

export class GridMaterial extends THREE.ShaderMaterial {
  constructor({
    gridDensity = 1.0,
    gridThickness = 0.01,
  }: GridMaterialOptions = {}) {
    super({
      // --- 4. Uniforms 정의 ---
      uniforms: {
        u_gridDensity: { value: gridDensity },
        u_gridThickness: { value: gridThickness },
      },
      vertexShader: Grid.vertexShader,
      fragmentShader: Grid.fragmentShader,

      // --- 5. 원본 속성 유지 ---
      side: THREE.DoubleSide,
      depthWrite: true, // 불투명 재질이므로 깊이 버퍼에 기록
      transparent: false, // 불투명 재질이므로 투명도 비활성화
      // blending: THREE.NoBlending, // 불투명 재질의 기본값이므로 명시적으로 설정할 필요 없음,
    });
  }

  setGridDensity(value: number) {
    this.uniforms.u_gridDensity.value = value;
  }

  setGridThickness(value: number) {
    this.uniforms.u_gridThickness.value = value;
  }

  // (선택 사항) TweakPane이 값을 '읽을' 수 있도록 getter/setter를 만들면
  // TweakPane 바인딩 시 .on('change') 대신 gridMaterial 자체를 바인딩할 수 있습니다.
  // 예: f.addBinding(this.gridMaterial, "gridDensity", ...)
  get gridDensity(): number {
    return this.uniforms.u_gridDensity.value;
  }
  set gridDensity(value: number) {
    this.setGridDensity(value);
  }

  get gridThickness(): number {
    return this.uniforms.u_gridThickness.value;
  }
  set gridThickness(value: number) {
    this.setGridThickness(value);
  }
}