// fragmentShader.glsl

// --- 1. Three.js / Vertex Shader에서 변수 받기 ---
uniform float iTime;
uniform vec2 iResolution;

// GLSL 1.0에서는 'varying'을 사용합니다.
varying vec2 vUv;


// --- 2. 제공된 원본 셰이더 코드 ---

// procedural noise from IQ
vec2 hash( vec2 p )
{
	p = vec2( dot(p,vec2(127.1,311.7)),
			 dot(p,vec2(269.5,183.3)) );
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float noise( in vec2 p )
{
	const float K1 = 0.366025404; // (sqrt(3)-1)/2;
	const float K2 = 0.211324865; // (3-sqrt(3))/6;
	
	vec2 i = floor( p + (p.x+p.y)*K1 );
	
	vec2 a = p - i + (i.x+i.y)*K2;
	vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
	vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;
	
	vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
	
	vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
	
	return dot( n, vec3(70.0) );
}

float fbm(vec2 uv)
{
	float f;
	mat2 m = mat2( 1.6, 1.2, -1.2, 1.6 );
	f  = 0.5000*noise( uv ); uv = m*uv;
	f += 0.2500*noise( uv ); uv = m*uv;
	f += 0.1250*noise( uv ); uv = m*uv;
	f += 0.0625*noise( uv ); uv = m*uv;
	f = 0.5 + 0.5*f;
	return f;
}

// 불꽃 색상 옵션 (원하는 색상 주석 해제)
// #define BLUE_FLAME
// #define GREEN_FLAME

// 원본 'mainImage' 함수
void mainImage( out vec4 o, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 q = uv;
	q.x *= 5.;
	q.y *= 2.;
	float strength = floor(q.x+1.);
	float T3 = max(3.,1.25*strength)*iTime;
	q.x = mod(q.x,1.)-0.5;
	q.y -= 0.25;
	float n = fbm(strength*q - vec2(0,T3));
	float c = 1. - 16. * pow( max( 0., length(q*vec2(1.8+q.y*1.5,.75) ) - n * max( 0., q.y+.25 ) ),1.2 );
	float c1 = n * c * (1.5-pow(2.50*uv.y,4.));
	c1=clamp(c1,0.,1.);

	vec3 col = vec3(1.5*c1, 1.5*c1*c1*c1, c1*c1*c1*c1*c1*c1);
	
#ifdef BLUE_FLAME
	col = col.zyx;
#endif
#ifdef GREEN_FLAME
	col = 0.85*col.yxz;
#endif
	
	float a = c * (1.-pow(uv.y,3.));
	o = vec4( mix(vec3(0.),col,a), 1.0);
	// 투명도를 적용하려면: o = vec4( col, a );
}


// --- 3. Three.js를 위한 표준 'main' 함수 ---

void main() {
	// vUv (0~1)를 픽셀 좌표(fragCoord)로 변환
	vec2 fragCoord = vUv * iResolution.xy;
	
	// 원본 mainImage 함수를 호출하여 gl_FragColor에 색상을 계산
	mainImage(gl_FragColor, fragCoord);
}
