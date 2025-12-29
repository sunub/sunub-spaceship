uniform float time;
uniform float testing;
uniform float delta; 
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float freedomFactor;
uniform vec3 predator;
uniform float boundaryLimit;

const float width = resolution.x;
const float height = resolution.y;

const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;

const float SPEED_LIMIT = 9.0;

// 0.0 ~ 1.0 난수 생성
float rand( vec2 co ){
    return fract( sin( dot( co.xy, vec2(12.9898,78.233) ) ) * 43758.5453 );
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
    vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

    vec3 velocity = selfVelocity;

    // ------------------------------------------------------
    // [1] 완전 랜덤 비행 (Chaos Flight)
    // ------------------------------------------------------
    // 주변 친구를 신경 쓰는 로직(Flocking)을 제거하고,
    // 오직 나만의 고유한 랜덤 방향으로 꺾습니다.
    
    // uv(새의 고유 ID)와 time을 섞어서 예측 불가능한 노이즈 생성
    // 사인파를 여러 개 겹쳐서 자연스러운 난기류를 만듭니다.
    
    float noiseX = sin(uv.x * 100.0 + time * 0.5) + sin(uv.y * 50.0 + time * 1.3);
    float noiseY = cos(uv.x * 80.0 + time * 0.7) + sin(uv.y * 30.0 + time * 0.4);
    float noiseZ = sin(uv.x * 120.0 + time * 0.3) + cos(uv.y * 60.0 + time * 1.1);

    vec3 randomDir = normalize(vec3(noiseX, noiseY, noiseZ));

    // 현재 진행 방향을 랜덤하게 조금씩 비틉니다.
    // 10.0 숫자가 클수록 방향 전환이 급격해집니다.
    velocity += randomDir * delta * 15.0;


    // ------------------------------------------------------
    // [2] Invisible Fence (Rectangular Box Boundary)
    // ------------------------------------------------------
    // 원형(length) 대신 사각형(abs) 경계를 사용합니다.
    
    // Floor 크기가 100이므로, 경계는 -50 ~ +50 입니다.
    // 새들이 나가지 않게 여유를 두어 45 정도로 설정합니다.

    // 1. X축 경계 체크
    if (abs(selfPosition.x) > boundaryLimit) {
        // 경계를 넘은 만큼 반대 방향으로 힘을 가합니다.
        // selfPosition.x가 양수(오른쪽)면 음수(왼쪽) 힘을, 음수면 양수 힘을 줍니다.
        float pushDir = -sign(selfPosition.x); 
        float overflow = abs(selfPosition.x) - boundaryLimit;
        
        // 많이 벗어날수록 더 강하게 밉니다 (스프링 효과)
        velocity.x += pushDir * overflow * 10.0 * delta;
    }

    // 2. Z축 경계 체크
    if (abs(selfPosition.z) > boundaryLimit) {
        float pushDir = -sign(selfPosition.z);
        float overflow = abs(selfPosition.z) - boundaryLimit;
        
        velocity.z += pushDir * overflow * 10.0 * delta;
    }

    // ------------------------------------------------------
    // [3] 고도 제한 (Floor & Ceiling)
    // ------------------------------------------------------
    float hardDeck = 0.2; 
    float softCeiling = 3.0;

    if ( selfPosition.y < hardDeck ) {
        velocity.y += (hardDeck - selfPosition.y) * 10.0 * delta;
        // 바닥에 닿으면 살짝 튀어 오르는 랜덤성 추가
        velocity.y += rand(uv + time) * 0.5; 
    }
    
    if ( selfPosition.y > softCeiling ) {
        velocity.y -= (selfPosition.y - softCeiling) * 10.0 * delta;
    }
    
    // 수직 이동 억제 (너무 위아래로 널뛰지 않게)
    velocity.y *= 0.99; 


    // ------------------------------------------------------
    // [4] 속도 고정 (Constant Speed)
    // ------------------------------------------------------
    // ------------------------------------------------------
    // [4] Dynamic Speed (Gravity & Drag)
    // ------------------------------------------------------
    
    float speed = length(velocity);
    if (speed < 0.0001) {
        // Safe fallback if velocity matches 0
        velocity = vec3(0.0, 0.0, 1.0);
        speed = 0.5;
    }

    vec3 direction = velocity / speed;

    // 1. Gravity Acceleration
    // Diving (y < 0) -> Gain speed
    // Climbing (y > 0) -> Lose speed
    // Multiplier 0.5 * delta gives a gentle acceleration curve.
    float gravityEffect = -direction.y * 0.5 * delta;
    speed += gravityEffect;

    // 2. Air Resistance (Drag)
    // Always slightly reduce speed to prevent infinite acceleration
    speed *= 0.999;

    // 3. Speed Limits
    // Clamp to keep it flyable
    // [Adjustable] Lower these values to make birds slower
    // Min Speed: 0.2 (was 0.4), Max Speed: 0.6 (was 0.9)
    speed = clamp(speed, 0.2, 0.35);

    velocity = direction * speed;

    gl_FragColor = vec4( velocity, 1.0 );
}