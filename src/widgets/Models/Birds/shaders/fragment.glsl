			varying vec4 vColor;
			varying float z;

			uniform vec3 color;

			void main() {
				float depth = clamp( ( 1000. - z ) / 1000., 0.0, 1.0 );
				// Use vColor from geometry (includes gradients/shading)
				// Apply simple depth attenuation but keep it bright enough
				vec3 finalColor = vColor.rgb * ( 0.6 + 0.4 * depth );
				gl_FragColor = vec4( finalColor, 1.0 );
			}