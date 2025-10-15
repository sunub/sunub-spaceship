import * as THREE from "three/webgpu";
import {
  smoothstep,
  uv,
  uniform,
  abs,
  vec3,
  fract,
  float,
  mix,
  dFdx,
  vec2,
  length,
  clamp,
  dFdy,
  step,
  oneMinus,
  pow,
} from "three/tsl";
import type { ShaderNodeObject } from "three/tsl";
import type OperatorNode from "three/src/nodes/math/OperatorNode.js";

interface GridMaterialOptions {
  gridScale?: number;
  gridThickness?: number;
  gridDensity?: number;
}

export class GridMaterial extends THREE.NodeMaterial {
  private gridScaleUniform: ShaderNodeObject<THREE.UniformNode<number>>;
  private gridThicknessUniform: ShaderNodeObject<THREE.UniformNode<number>>;
  private gridDensityUniform: ShaderNodeObject<THREE.UniformNode<number>>;
  constructor({
    gridScale = 8.0,
    gridThickness = 0.01,
    gridDensity = 10.0,
  }: GridMaterialOptions = {}) {
    super();
    this.gridScaleUniform = uniform(float(gridScale));
    this.gridThicknessUniform = uniform(float(gridThickness));
    this.gridDensityUniform = uniform(float(gridDensity));
    // TSL의 uv() 노드는 현재 렌더링 중인 지오메트리(Geometry)에 내장된 uv 속성(attribute) 값을 가져오는 노드입니다.
    // 여기서는 Mesh의 UV 좌표를 가져와서 그리드 스케일링을 적용합니다.
    const uvGridScale = this.gridScaleUniform;
    const uvNode = uv().mul(uvGridScale);

    // 그리드 밀도 (원본의 N = 10.0)
    const N = this.gridDensityUniform;
    const lineWidth = vec2(
      this.gridThicknessUniform.div(N), // X축 선 두께
      this.gridThicknessUniform.div(N) // Y축 선 두께
    );

    const gridValue = this.pristineGrid(uvNode, lineWidth);
    const invertGrid = uniform(float(1.0)).sub(gridValue);
    const finalGrid = oneMinus(invertGrid);
    const gammaCorrected = pow(vec3(finalGrid), vec3(uniform(float(0.4545))));

    this.colorNode = gammaCorrected;
    this.side = THREE.DoubleSide;
    this.depthWrite = false;
  }

  setGridScale(value: number) {
    this.gridScaleUniform.value = value;
  }

  setGridThickness(value: number) {
    this.gridThicknessUniform.value = value;
  }

  setGridDensity(value: number) {
    this.gridDensityUniform.value = value;
  }

  private pristineGrid(
    uvInput: ShaderNodeObject<OperatorNode>,
    lineWidthInput: ReturnType<typeof vec2>
  ) {
    // dFdx, dFdy는 glsl/tsl의 내장 함수로 미분을 계산하는 용도로 사용이 됩니다.
    // dFdx(p)는 p 라는 값이 현재 픽셀에서 오른쪽 옆 픽셀로 이동할때 얼마나 변화하는지, 변화율을 계산합니다.
    // dF/dx는 x에 대한 F(특정 값)의 미분을 의미합니다.
    // dFdy는 y에 대한 F(특정 값)의 미분을 의미합니다.

    // 이 값이 필요한 이유는 카메라가 3D 모델의 표면을 비출 때, 화면의 픽셀 하나가 텍스처의 어느 정도 영역을 덮고 있는지를 알아야 합니다.

    // 셰이더는 ddx와 ddy 벡터의 크기와 방향을 통해 "이 픽셀 하나가 텍스처 공간에서 얼마나 넓고 어떤 모양의 영역을 대표하는지"를 알 수 있습니다.

    // ddx = 화면에서 아래로 한 픽셀 움직였을 때 U 좌표의 변화량
    // ddy = 화면에서 오른쪽으로 한 픽셀 움직였을 때 V 좌드의 변화량
    const ddx = vec2(dFdx(uvInput.x), dFdx(uvInput.y));
    const ddy = vec2(dFdy(uvInput.x), dFdy(uvInput.y));

    // uvDeriv는 현재 픽셀이 텍스처에서 얼마나 넓은 영역을 대표하는지를 나타냅니다.
    const uvDeriv = vec2(
      length(vec2(ddx.x, ddy.x)),
      length(vec2(ddx.y, ddy.y))
    );

    // 선 반전 조건 (lineWidth > 0.5)
    // grid에서 선의 두께가 0.5보다 클 경우 선이 아니라 선 사이의 간격을 검은색 으로 채우는 효과를 주기 위해 사용합니다.
    const invertLineX = step(uniform(float(0.5)), lineWidthInput.x);
    const invertLineY = step(uniform(float(0.5)), lineWidthInput.y);

    // mix(x, y, a)
    // x는 시작 값으로 섞는 비율 a가 0일 때 결과값이 x가 됩니다.
    // y는 끝 값으로 섞는 비율 a가 1일 때 결과값이 y가 됩니다.
    // a는 섞는 비율을 의미하며 보통 0.0에서 1.0 사이의 값을 사용합니다. 이 값이 두 값을 얼마나 섞을지 결정합니다.

    // 이 경우 기본적으로는 lineWidthInput.x를 사용하고, invertLineX가 true일 경우 1.0에서 lineWidthInput.x를 뺀 값을 사용합니다.
    const targetWidthX = mix(
      lineWidthInput.x,
      uniform(float(1.0)).sub(lineWidthInput.x),
      invertLineX
    );
    const targetWidthY = mix(
      lineWidthInput.y,
      uniform(float(1.0)).sub(lineWidthInput.y),
      invertLineY
    );
    const targetWidth = vec2(targetWidthX, targetWidthY);

    // clamp(value, min, mx)
    // value를 min과 max 사이로 제한합니다.
    // value는 사용자가 원하는 값에 해당합니다. 이전 단게에서 계산한 lineWidth, invertLine을 기반으로 쉐이더가 그리고자 하는 선의 두께를 계산합니다.
    // min은 선의 두께가 최소한 이 값 이상이 되도록 제한합니다, 카메라가 멀어지거나 표면을 비스듬히 볼수록 이 값은 커집니다. 즉, "이 픽셀 하나가 텍스처의 넓은 영역을 덮고 있다"는 의미가 됩니다.
    // max는 선의 두께가 최대한 이 값 이하가 되도록 제한합니다
    const drawWidth = clamp(targetWidth, uvDeriv, vec2(uniform(float(0.5))));
    const lineAA = uvDeriv.mul(1.5); // 선의 안티 앨리어싱을 위한 값

    const gridUVBase = abs(fract(uvInput).mul(2.0).sub(1.0));
    const gridUV_x = mix(
      uniform(float(1.0)).sub(gridUVBase.x),
      gridUVBase.x,
      invertLineX
    );
    const gridUV_y = mix(
      uniform(float(1.0)).sub(gridUVBase.y),
      gridUVBase.y,
      invertLineY
    );
    const gridUV = vec2(gridUV_x, gridUV_y);

    const grid2Initial = smoothstep(
      drawWidth.add(lineAA),
      drawWidth.sub(lineAA),
      gridUV
    );

    const intensityCorrection = clamp(
      targetWidth.div(drawWidth),
      uniform(float(0.0)),
      uniform(float(1.0))
    );
    const grid2Corrected = grid2Initial.mul(intensityCorrection);

    const distanceFactor = clamp(
      uvDeriv.mul(2.0).sub(1.0),
      uniform(float(0.0)),
      uniform(float(1.0))
    );
    const grid2Distance = mix(grid2Corrected, targetWidth, distanceFactor);

    const grid2X = mix(
      grid2Distance.x,
      uniform(float(1.0)).sub(grid2Distance.x),
      invertLineX
    );
    const grid2Y = mix(
      grid2Distance.y,
      uniform(float(1.0)).sub(grid2Distance.y),
      invertLineY
    );

    return mix(grid2X, uniform(float(1.0)), grid2Y);
  }
}

// // 대각선 벡터 (X + Y)
// const xOffset = uniform(float(0.1));
// const adjustedX = positionWorld.x.add(xOffset);

// const diagonalUV = adjustedX.add(positionWorld.y);
// const diagonal2UV = adjustedX.sub(positionWorld.y);

// // 높이에 따른 동적 선 두께
// const baseLineWidth = uniform(float(0.05));
// const heightFactor = positionWorld.y; // 0 ~ 1
// const dynamicLineWidth = baseLineWidth.mul(
//   uniform(float(1.0)).sub(heightFactor.mul(0.7)) // 위로 갈수록 70%까지 얇아짐
// );

// // const lineAA = fwidth(diagonalUV);
// // const gridUV = uniform(float(1.0)).sub(
// //   abs(fract(diagonalUV.mul(4.0)).sub(1.0)) // 4개의 대각선
// // );

// // const grid2 = smoothstep(
// //   dynamicLineWidth.add(lineAA),
// //   dynamicLineWidth.sub(lineAA),
// //   gridUV
// // );
// // const grid = mix(grid2.x, uniform(float(1.0)), grid2.y);

// const lineAA1 = fwidth(diagonalUV);
// const gridUV1 = uniform(float(1.0)).sub(
//   abs(fract(diagonalUV.mul(1.0)).sub(1.0).mul(1.1))
// );
// const grid1 = smoothstep(
//   dynamicLineWidth.add(lineAA1),
//   dynamicLineWidth.sub(lineAA1),
//   gridUV1
// );

// const lineAA2 = fwidth(diagonal2UV);
// const gridUV2 = uniform(float(1.0)).sub(
//   abs(fract(diagonal2UV.mul(1.0)).sub(1.0).mul(1.1))
// );
// const grid2 = smoothstep(
//   dynamicLineWidth.add(lineAA2),
//   dynamicLineWidth.sub(lineAA2),
//   gridUV2
// );
// const grid = mix(grid1, uniform(float(1.0)), grid2);
