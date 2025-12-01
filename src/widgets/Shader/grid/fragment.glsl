varying vec2 vUv;

uniform float u_gridDensity;
uniform float u_gridThickness;

  // TSL의 pristineGrid 함수를 GLSL로 변환
float pristineGrid(vec2 uvInput, vec2 lineWidthInput) {
  vec2 ddx = vec2(dFdx(uvInput.x), dFdx(uvInput.y));
  vec2 ddy = vec2(dFdy(uvInput.x), dFdy(uvInput.y));

  vec2 uvDeriv = vec2(
      length(vec2(ddx.x, ddy.x)),
      length(vec2(ddx.y, ddy.y))
  );

  float invertLineX = step(0.5, lineWidthInput.x);
  float invertLineY = step(0.5, lineWidthInput.y);

  float targetWidthX = mix(
      lineWidthInput.x,
      1.0 - lineWidthInput.x,
      invertLineX
  );
  float targetWidthY = mix(
      lineWidthInput.y,
      1.0 - lineWidthInput.y,
      invertLineY
  );
  vec2 targetWidth = vec2(targetWidthX, targetWidthY);

  vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
  vec2 lineAA = uvDeriv * 1.5;

  vec2 gridUVBase = abs(fract(uvInput) * 2.0 - 1.0);
  float gridUV_x = mix(
      1.0 - gridUVBase.x,
      gridUVBase.x,
      invertLineX
  );
  float gridUV_y = mix(
      1.0 - gridUVBase.y,
      gridUVBase.y,
      invertLineY
  );
  vec2 gridUV = vec2(gridUV_x, gridUV_y);

  vec2 grid2Initial = smoothstep(
      drawWidth + lineAA,
      drawWidth - lineAA,
      gridUV
  );

  vec2 intensityCorrection = clamp(
      targetWidth / drawWidth,
      vec2(0.0),
      vec2(1.0)
  );
  vec2 grid2Corrected = grid2Initial * intensityCorrection;

  vec2 distanceFactor = clamp(
      uvDeriv * 2.0 - 1.0,
      vec2(0.0),
      vec2(1.0)
  );
  vec2 grid2Distance = mix(grid2Corrected, targetWidth, distanceFactor);

  float grid2X = mix(
      grid2Distance.x,
      1.0 - grid2Distance.x,
      invertLineX
  );
  float grid2Y = mix(
      grid2Distance.y,
      1.0 - grid2Distance.y,
      invertLineY
  );

  return mix(grid2X, 1.0, grid2Y);
}

void main() {
  vec2 uvNode = vUv * u_gridDensity;
  float N = 1.0; // This is not used anymore, but we keep it to avoid breaking the pristineGrid function
  vec2 lineWidth = vec2(u_gridThickness / N, u_gridThickness / N);
  float gridValue = pristineGrid(uvNode, lineWidth);

  // gridValue를 사용하여 검은색(0,0,0)과 흰색(1,1,1) 사이를 보간합니다.
  vec3 finalColor = mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), gridValue);

  // 감마 보정 적용
  finalColor = pow(finalColor, vec3(0.4545));

  gl_FragColor = vec4(finalColor, 1.0); // 완전히 불투명하게 설정
}