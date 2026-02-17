# FounderOS

창업 아이디어를 입력하면 **멀티 에이전트가 실제로 상호 토론하여 설계**를 만들고,
사용자가 구축 요청을 누르면 **실제 구축 계획과 산출물 파일**까지 생성하는 TypeScript 서비스입니다.

## 핵심 알고리즘

1. **사용자 입력 수집**
   - 스타트업 이름, 문제, 고객, 제약사항, 추가 맥락, 에이전트 수(2~6).
2. **1차 설계 라운드 (역할별 독립 분석)**
   - 역할별 에이전트가 각자 입장/우선순위/우려사항을 JSON으로 생성.
3. **2차 토론 라운드 (상호 의논)**
   - 각 에이전트가 다른 에이전트 의견을 읽고 반박/수정 우선순위를 생성.
4. **퍼실리테이터 합의 라운드**
   - 다중 의견/토론 결과를 통합해 최종 합의 아키텍처와 2주 MVP 실행안 도출.
5. **구축 라운드**
   - 합의 결과 기반으로 구현 계획 생성 + 산출물 파일(`generated/<designId>`) 실제 작성.

## 기술 스택
- TypeScript
- Node.js + Express
- OpenAI SDK (`openai`)

## 실행 방법

```bash
npm install
cp .env.example .env
# .env 에 OPENAI_API_KEY 설정 (필수)
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경 변수
- `OPENAI_API_KEY` (필수)
- `OPENAI_MODEL` (기본: `gpt-4o-mini`)
- `PORT` (기본: `3000`)

## API
- `GET /api/health`: OpenAI 설정 상태 확인
- `POST /api/design`: 멀티 에이전트 설계 + 상호토론 + 합의
- `POST /api/build/:designId`: 구축 계획/산출물 생성
- `GET /api/design/:designId`, `GET /api/build/:designId`: 결과 조회
