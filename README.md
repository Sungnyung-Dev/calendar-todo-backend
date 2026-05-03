# Calendar Todo Backend

NestJS 기반 캘린더 중심 개인 일정/투두 관리 API입니다.

## Stack

- NestJS
- TypeScript
- MySQL
- Prisma
- REST API
- JWT Bearer 인증
- Swagger/OpenAPI

## Local Setup

`.env` 파일에 아래 변수를 준비합니다. 실제 값은 커밋하지 않습니다.

```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
PORT=
```

의존성 설치:

```bash
npm install
```

Prisma client 생성:

```bash
npx prisma generate
```

MySQL 서버를 실행한 뒤 migration 적용:

```bash
npx prisma migrate dev
```

개발 서버 실행:

```bash
npm run start:dev
```

Swagger UI:

```text
http://localhost:3000/api-docs
```

`PORT`를 변경한 경우 해당 포트로 접속합니다.

## Verification

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

`npm run test:e2e`는 Supertest가 임시 HTTP 서버를 열기 때문에 실행 환경에 따라 로컬 포트 바인딩 권한이 필요할 수 있습니다.

## Swagger Test Flow

1. `POST /auth/signup`으로 사용자 생성
2. `POST /auth/login`으로 `accessToken` 발급
3. Swagger 우측 상단 `Authorize` 클릭
4. Bearer token 입력
   - 입력 예: `Bearer eyJ...`
5. `POST /categories`로 카테고리 생성
6. `POST /events` 또는 `POST /tasks`로 일정/투두 생성
7. `PATCH /events/:id/status` 또는 `PATCH /tasks/:id/status`로 원본 상태 변경
8. 반복 항목은 `PATCH /events/:id/occurrences/status` 또는 `PATCH /tasks/:id/occurrences/status`로 특정 발생 날짜 상태 변경
9. `GET /calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`로 통합 캘린더 결과 확인
10. `GET /search?q=keyword`로 일정/투두 통합 검색 확인

## Domain Rules

- 삭제는 hard delete입니다.
- 모든 도메인 데이터는 JWT의 `userId` 기준으로 격리됩니다.
- 다른 사용자의 category, event, task, occurrence에는 접근할 수 없습니다.
- 상태값은 아래 네 가지입니다.
  - `pending`
  - `completed`
  - `cancelled`
  - `skipped`
- 우선순위는 아래 세 가지입니다.
  - `low`
  - `medium`
  - `high`
- 일정과 투두는 DB에서 분리됩니다.
- 캘린더 조회 API는 일정과 투두를 하나의 `items` 배열로 합쳐 반환합니다.

## Recurrence

반복 일정/반복 투두는 원본 row와 특정 발생 회차 상태를 분리합니다.

- `Event.recurrenceRule`, `Task.recurrenceRule`은 반복 규칙 JSON입니다.
- `EventOccurrence`, `TaskOccurrence`는 특정 날짜 발생분의 상태 override만 저장합니다.
- occurrence row가 없으면 해당 발생분은 원본 `status`를 따릅니다.
- occurrence row가 있으면 해당 발생분은 occurrence의 `status`를 우선합니다.
- 반복 회차는 DB에 미리 모두 생성하지 않고, calendar 조회 기간 안에서 서버가 계산합니다.

반복 규칙 예시:

```json
{
  "frequency": "weekly",
  "interval": 1,
  "daysOfWeek": ["MON", "WED", "FRI"],
  "endDate": "2026-12-31"
}
```

현재 지원 범위:

- `frequency`: `daily`, `weekly`, `monthly`
- `interval`: 1 이상의 정수
- `daysOfWeek`: weekly 반복에서 사용
- `endDate`: 선택값, 없으면 조회 기간 안에서만 확장

반복 투두는 발생 기준일이 필요하므로 `recurrenceRule`을 사용할 때 `dueDate`가 필요합니다.

## Calendar Response

```json
{
  "items": [
    {
      "type": "event",
      "id": "eventId",
      "occurrenceDate": "2026-05-04",
      "title": "Workout",
      "description": "Gym session",
      "startAt": "2026-05-04T09:00:00.000Z",
      "endAt": "2026-05-04T10:00:00.000Z",
      "status": "pending",
      "priority": "medium",
      "category": {
        "id": "categoryId",
        "name": "Health",
        "color": "#22c55e"
      },
      "isRecurring": true
    },
    {
      "type": "task",
      "id": "taskId",
      "occurrenceDate": "2026-05-04",
      "title": "Buy milk",
      "description": null,
      "dueDate": "2026-05-04",
      "status": "completed",
      "priority": "low",
      "category": null,
      "isRecurring": false
    }
  ]
}
```

## Main API Groups

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `DELETE /categories/:id`
- `GET /events`
- `GET /events/:id`
- `POST /events`
- `PATCH /events/:id`
- `DELETE /events/:id`
- `PATCH /events/:id/status`
- `PATCH /events/:id/occurrences/status`
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `PATCH /tasks/:id/status`
- `PATCH /tasks/:id/occurrences/status`
- `GET /calendar`
- `GET /search`
