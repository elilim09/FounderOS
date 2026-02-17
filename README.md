# FounderOS

창업 아이디어를 입력하면 **멀티 에이전트가 서로 논의해 설계**를 만들고,
사용자가 구축 버튼을 누르면 **멀티 에이전트가 구축 산출물**까지 생성하는 TypeScript 서비스입니다.

## 구현 알고리즘 (요약)

1. **사용자 입력 수집**
   - 스타트업 이름, 문제, 고객, 제약사항, 추가 맥락, 에이전트 수(2~6)를 입력받습니다.
2. **멀티 에이전트 설계 단계**
   - 선택된 역할(예: MarketAnalyst, TechArchitect 등)별로 OpenAI 모델 호출.
   - 각 역할 의견을 병렬 수집한 뒤, 퍼실리테이터 에이전트가 합의안 도출.
   - 합의안을 기반으로 시스템 블루프린트(아키텍처/토폴로지/흐름/리스크) 생성.
3. **사용자 구축 요청 단계**
   - 사용자가 설계 결과를 보고 구축 요청을 명시적으로 실행.
4. **멀티 에이전트 구축 단계**
   - 구현 협의 에이전트가 빌드 계획 + 파일 산출물 + 운영 체크리스트 생성.

## 기술 스택
- TypeScript
- Node.js + Express
- OpenAI SDK (`openai`)

## 빠른 시작

```bash
npm install
cp .env.example .env
# .env에 OPENAI_API_KEY 설정
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경변수

- `OPENAI_API_KEY`: OpenAI API Key (없으면 mock mode로 동작)
- `OPENAI_MODEL`: 기본 `gpt-4o-mini`
- `PORT`: 기본 `3000`
