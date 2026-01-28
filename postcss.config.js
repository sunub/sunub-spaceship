export default {
	plugins: {
		autoprefixer: {},
		...(process.env.NODE_ENV === "production"
			? {
					cssnano: {
						preset: [
							"default",
							{
								discardComments: {
									removeAll: true,
								},
								// 중복 규칙 병합 (default에 포함)
								// 선택자 최적화 (default에 포함)
								// 색상 최적화 (default에 포함)
								// 폰트 값 최적화 (default에 포함)
								// 공백 정규화 (default에 포함)
								// 중복 제거 (default에 포함)
							},
						],
					},
			  }
			: {}),
	},
}
