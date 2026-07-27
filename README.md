# 중등 생기부 교사도우미

학생 작성 문서와 교사 메모를 근거로 **교과 특기사항**, **행동특성 및 발달상황**, **창의적 체험활동(자율·진로·봉사)**, **동아리활동** 초안을 생성하고, 여러 초안 중 선택·수정·확정하는 웹 앱입니다.

- 로그인 없음
- 데이터는 **브라우저 localStorage**에만 저장
- **JSON 내보내기/불러오기**로 PC·기기 간 이전
- AI: **Google Gemini / NVIDIA / OpenAI(ChatGPT) / Anthropic(Claude)**
- API 키 여러 개 등록·선택·오류 시 다른 키로 폴백

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

프로덕션 빌드:

```bash
npm run build
npm start
```

## 배포 (Vercel)

**프로덕션 URL:** [https://schoolspec.vercel.app](https://schoolspec.vercel.app)

### `main`에 push하면 자동 배포

`main` 브랜치에 커밋이 올라가면 GitHub Actions(`.github/workflows/vercel-production.yml`)가 Vercel 프로덕션에 배포합니다.

**최초 1회만** GitHub 저장소 시크릿을 등록해 주세요.

1. [Vercel → Account → Tokens](https://vercel.com/account/tokens)에서 토큰을 만듭니다.
2. 터미널에서 다음을 실행합니다 (`gh` CLI 필요).

```bash
gh secret set VERCEL_TOKEN -R jjiseok26/school_spec
```

저장소 변수 `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`는 이미 설정되어 있습니다.

수동으로 다시 배포하려면 GitHub **Actions → Vercel Production Deployment → Run workflow**를 사용할 수 있습니다.

### 참고

- 별도 서버 env 키는 **필수가 아닙니다**. 교사가 브라우저 설정에서 자신의 API 키를 등록합니다.
- 생성/추출 API는 서버가 프록시만 하고, 학생 원문·결과·키를 DB에 저장하지 않습니다.
- Vercel 대시보드에서 같은 GitHub 저장소를 **추가로** 연결하면 배포가 두 번 돌 수 있으니, Git 연동과 Actions 중 하나만 쓰는 것을 권장합니다.

> 참고: 브라우저에서 서버로 API 키를 요청마다 전달합니다. HTTPS 배포를 권장합니다.

## 사용 순서

1. **설정**에서 AI 제공자 API 키를 등록하고 기본 키를 지정합니다.
2. **학생·자료**에서 학급 학생을 등록합니다.
3. 역할별 화면에서 문서를 붙여넣거나 파일(txt, docx, pdf, hwpx, 이미지)을 올립니다.
4. **초안 생성** → 초안 선택 → 수정 → **확정** → 복사하여 나이스에 붙여넣습니다.
5. 필요 시 JSON으로 백업합니다. (API 키 포함 여부 선택 가능)

## 창체 일정 양식

창체 화면에서 CSV 양식을 내려받아 업로드합니다.

| 날짜 | 구분 | 활동명 | 비고 |
|------|------|--------|------|
| 2026-03-05 | 자율 | 학급회의 | 반장 선출 |

구분 값은 `자율` / `진로` / `봉사` (또는 autonomy / career / volunteer)를 사용합니다.  
학생별로 참여 활동을 체크하면 해당 내용이 생성 근거에 포함됩니다.

## 글자 수

항목별 글자 수 제한 칸이 있습니다. **비우면 무제한**으로 생성합니다.

## 문서 형식

| 형식 | 지원 |
|------|------|
| 텍스트 붙여넣기 | O |
| txt / docx / pdf / hwpx | O |
| 이미지 (png, jpg 등) | O (등록된 AI 키로 OCR) |
| 구형 hwp | X → hwpx 또는 PDF로 변환 |

## 문체 규칙 (프롬프트)

- 사실·관찰 중심
- 자료에 없는 내용 창작 금지
- 모호한 미사여구 최소화
- 명사형 종결(`~함`, `~임`)

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind CSS
- 클라이언트: localStorage
- 서버: `/api/generate`, `/api/extract`, `/api/test-key` 프록시만 제공
