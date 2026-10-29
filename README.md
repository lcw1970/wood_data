# 목재 지압강도 데이터베이스 및 예측 계산기

수종별 지압강도 조회, 시험 조건 검색, 지압강도·압축강도 예측 계산과 출처를 확인한 논문 실측값 별도 비교를 제공하는 Spring Boot 웹앱이다.

- Java 21 / Gradle / Spring Boot / Thymeleaf / Chart.js
- 논문 마스터: `exports/literature_strength_long.csv` (소장 논문 17편·186개 시험군 ID·228개 보고값). `src/main/resources/wood_data.csv`의 기존 미대조 25개 항목은 목록에 별도 보존한다.
- 출처 및 값의 정의: [논문 데이터 추가 기록](docs/data_import.md), [원문 목록](docs/paper_sources.json), [2026-10-29 추가 검토](docs/literature_expansion_20261029.md)
- 스크류/다월만 선택하며 추가 형상 입력은 받지 않는다. 스크류·다월 모두 EC5/NDS/KDS 기준별 예측값을 표시한다. 스크류는 평활부·선공 가정을 명시하고 문헌식 예측값을 별도로 표시하며, 화면 아래에 원문 링크와 조항을 제공한다. [단순화한 계산 모델](docs/simplified_fastener_model.md)을 참조한다.
- 예측 그래프와 논문 실측값을 분리한다. 같은 파스너 종류·목재 분류·제품 형태에서 밀도 차이 10% 이내·직경 차이 1 mm 이내인 후보를 찾고 실제 시험 조건·출처를 표시한다. 밀도 미기재 항목은 별도 참고 자료로 구분한다.
- `/explorer`에서 원문 대조한 186개 시험군·228개 강도값을 산점도와 히스토그램으로 탐색한다. 상단에서 침엽수/활엽수를 먼저 고른 뒤 학명(한글명)으로 수종을 선택한다. 하중 방향, 파스너, Full-hole/Half-hole, 강도 평가 방식, 제품 필터도 제공한다. 개별 시편이 아닌 논문 시험군 평균의 분포다. `/literature.csv`에서 같은 원본을 내려받는다.
- AI 채팅 화면, 클라이언트 통신 코드, 프록시 컨트롤러 및 서버 연결 설정은 제거했다. 별도 AI 서버 없이 사용한다.

## 실행

```sh
./gradlew bootRun
```

기본 주소: `http://localhost:8080` — 데이터 목록 `/`, 예측 계산기 `/calculator`.

## 검증 및 배포 파일

```sh
./gradlew test bootJar
node --test src/test/js/calculator-chart.test.cjs
java -jar build/libs/datat-0.0.1-SNAPSHOT.jar
```

기존 README에 기재된 배포 주소: https://wood-data.onrender.com
이번 로컬 변경을 해당 배포 서버에 반영한 것은 아니다.

## 논문 추가

원문 표·방향·직경·시험 형상·강도 정의·시편 수를 대조하고 `docs/paper_sources.json`에 원문 DOI와 파일 해시를 기록한다. 마스터와 같은 34개 열로 검토한 논문의 CSV를 준비한다.

```sh
python3 scripts/manage_literature.py --check
python3 scripts/manage_literature.py --append /path/to/reviewed_paper.csv
```

원본을 검증한 뒤 중복 없이 원자적으로 추가한다. 실행 중인 로컬 사이트는 다음 페이지 요청에서 새 데이터를 읽는다. 마스터를 직접 편집한 경우에도 `--check`로 검증한다. 현재 웹앱은 시험군 평균·0°/90°/R/T를 지원하며, 개별 시편값·특성값·다른 각도는 별도 확장 전까지 마스터에 혼합하지 않는다.

`./gradlew bootJar`는 같은 CSV를 JAR에 포함한다. 배포 서버에서는 재빌드·재배포하거나 `--app.literature-data=/absolute/path/to/master.csv`로 갱신 가능한 외부 원본을 지정한다. 명시한 경로가 없거나 CSV가 잘못되면 오류를 표시하며 다른 데이터로 자동 대체하지 않는다. 기본 외부 경로가 없는 패키지 실행에서는 JAR의 원본을 사용한다. 데이터 추가는 비교·분포를 갱신하며 EC5/NDS/KDS 예측식을 자동 재학습하지 않는다.
