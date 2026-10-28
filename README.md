# 목재 지압강도 데이터베이스 및 예측 계산기

수종별 지압강도 조회, 시험 조건 검색, 지압강도·압축강도 예측 계산과 출처를 확인한 논문 실측값 별도 비교를 제공하는 Spring Boot 웹앱이다.

- Java 21 / Gradle / Spring Boot / Thymeleaf / Chart.js
- 데이터: `src/main/resources/wood_data.csv` (66개 시험 조건; 이 중 41개는 소장 논문 4편과 원문 대조)
- 출처 및 값의 정의: [논문 데이터 추가 기록](docs/data_import.md), [원문 목록](docs/paper_sources.json)
- 스크류/다월만 선택하며 추가 형상 입력은 받지 않는다. 스크류·다월 모두 EC5/NDS/KDS 기준별 예측값을 표시한다. 스크류는 평활부·선공 가정을 명시하고 문헌식 예측값을 별도로 표시하며, 화면 아래에 원문 링크와 조항을 제공한다. [단순화한 계산 모델](docs/simplified_fastener_model.md)을 참조한다.
- 예측 그래프와 논문 실측값을 분리한다. 같은 파스너 종류·목재 분류·제품 형태에서 밀도 차이 10% 이내·직경 차이 1 mm 이내인 후보를 찾고 실제 시험 조건·출처를 표시한다. 밀도 미기재 항목은 별도 참고 자료로 구분한다.
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
