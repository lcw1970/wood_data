# 지압강도 CSV 추가 기록 — 2026-10-29

엑셀의 실험 요약을 후보 선별에 사용하고, 아래 12편의 소장 PDF 본문·표·각주 및 표 이미지를 대조해 141개 시험군 평균값을 추가했다. 엑셀 요약 숫자를 그대로 복사하지 않았다. 기존 최신 프로젝트 마스터의 87개 행은 ID·숫자·조건을 모두 보존했다.

**반영 결과: 17편 · 186개 시험군 ID · 228개 보고 평균값 · 34열.** 개별 시편 원자료 228개를 확보했다는 뜻이 아니다.

현재 작업 폴더의 이전 사본은 83개 행이었다. 연동 프로젝트에 이미 추가되어 있던 paper-146의 4개 행도 함께 동기화하여 두 CSV의 바이트가 동일하다.

## 추가한 논문과 근거

| 엑셀 번호 | 원문 ID | 논문 제목 | 추가 값 | 확인 위치 |
| --- | --- | --- | ---: | --- |
| 2 | paper-8 | [Half hole and full hole dowel embedment Strength: A review of international developments and recommendations for Australian softwoods](https://doi.org/10.1016/j.conbuildmat.2022.128130) | 8 | Table 1 p.3; Sections 2-2.1 pp.5-6; Table 3 p.8 |
| 19 | paper-42 | [Tension test setups for embedment testing of doweled timber connections loaded parallel and perpendicular to the grain](https://doi.org/10.1016/j.conbuildmat.2026.146063) | 4 | Table 1 p.4; Sections 3.2-3.6 pp.4-7; Table 2 p.10 |
| 32 | paper-55 | [Embedment Properties of Self-Tapping Screws Loaded at Different Angles to the Grain](https://doi.org/10.1061/JMCEE7.MTENG-18695) | 12 | Tables 1-2 pp.3-4; Table 4 p.5; Table 5 p.7; Eqs.13-14 p.4 |
| 39 | paper-62 | [Exploring the relationship between embedment behaviour in cross-laminated timber and its layers: An experimental study](https://doi.org/10.1016/j.engstruct.2024.118677) | 28 | Sections 2.1-2.4 pp.3-7; Fig.2 p.5; Table 1 p.10 |
| 41 | paper-64 | [Impact of Acetylation on the Behaviour of Single-Dowel Timber Connections](https://doi.org/10.3390/buildings14020405) | 2 | Sections 2.1-2.2/Fig.3 p.4; Table 3 p.9 |
| 43 | paper-66 | [Influence of test methodology on the characterization of the parallel-to-grain timber embedment strength and foundation modulus of dowels](https://doi.org/10.1080/17480272.2024.2328088) | 7 | Table 1/Figs.1-2 p.4; Section 2.2 pp.4-5; Table 4 p.12 |
| 55 | paper-78 | [EMBEDMENT STRENGTH OF RECOVERED SPRUCE AND OAK](https://doi.org/10.52202/069179-0119) | 18 | Section 2 pp.2-3; Table 1 p.3; Tables 3-4 p.4 |
| 61 | paper-84 | [INFLUENCE OF DENSITY AND PREDRILL IN THE EMBEDMENT STRENGTH OF TWO HARDWOOD SPECIES](https://doi.org/10.52202/069179-0183) | 8 | Table 1/Fig.3 p.3; effective diameter Eq.3 p.4; Table 2 p.5 |
| 64 | paper-87 | [MOISTURE AND ASSEMBLY HISTORY EFFECTS ON EMBEDMENT PROPERTIES OF STEEL DOWELS IN SPRUCE AND BIRCH LOADED IN GRAIN DIRECTION](https://doi.org/10.52202/069179-0157) | 12 | Table 1/Section 2.1-2.2 p.3; strength definition p.4; Table 2 p.5 |
| 74 | paper-99 | [Embedment Strength of Cross-Laminated Timber for Smooth Dowel-type Fasteners](https://doi.org/10.1051/matecconf/201927501020) | 30 | Section 2/Tables 1-2/Fig.1 p.2; Table 3 p.3 |
| 89 | paper-116 | [Embedment properties of thermally modified spruce timber with dowel-type fasteners](https://doi.org/10.1016/j.conbuildmat.2021.125517) | 8 | Sections 3.1-3.5 pp.3-5; Table 1 p.5; Table 2 and sample-size footnotes p.8 |
| 95 | paper-122 | [Embedment strength of steel dowel in wood specimens according to ABNT NBR 7190:1997 and ASTM D5764:2007 Standards](https://doi.org/10.4067/S0718-33052017000300492) | 4 | Fig.6/Methods p.5; test details p.6; Table 4 p.7 |

## 채택 및 해석 기준

- 새 행은 GROUP_SUMMARY / MEAN이며 0°/90°만 추가했다. 기존 R/T 30개 행은 그대로 보존했다. 30°/45°/60°, 특성값, 식으로 계산한 값, 범위의 중앙값, 접합부 최대하중 및 인발강도는 추가하지 않았다.
- 같은 시편의 항복·최대값 등 재평가는 하나만 선택했다. 다만 서로 다른 시험군은 해당 시험법에 맞는 정의를 보존했다. 논문 하나의 여러 평균이 통계적으로 독립이라는 뜻은 아니다.
- 새 행 141개 모두 해당 보고값의 n을 기록했다. SD를 직접 확인한 23개 행만 채웠다. CV는 SD로 환산하지 않았다. 모든 논문/형상의 n을 합친 수를 독립 시편 총수로 사용하면 안 된다.
- 밀도는 비중에서 만들지 않았다. paper-8/66은 함수율 12%로 조정된 밀도, paper-87은 20°C/65% RH 기준 밀도, paper-64/99/116은 재료 전체 평균이라는 범위를 test_notes에 명시했다. 이들을 모두 시험군별 시험시 밀도로 간주하면 안 된다.
- paper-55는 공칭직경 d와 root diameter dr, effective diameter def를 구분했다. 채택한 항복강도의 분모는 dr×t이다. paper-62는 원문처럼 공칭직경으로 계산된 값을 보존했다. paper-84는 5 mm 공칭/3.3 mm 유효직경이다.
- paper-42의 C0/T0 n은 Table 2 각주의 12개 시험이다. 물리적 시편 개수와 가력점에서 얻은 시험 개수를 구분했다.
- paper-116은 계획한 8개 대신 Table 2 각주의 실제 분석 n을 사용했다. 기본 n=7이며, 무처리 Half-hole 직각/RH65%는 n=5이다.
- paper-64는 Fig.3에 따라 Half-hole이다. ISO/FDIS 10984-2 시험이며 평가 정의가 파괴 또는 5 mm 이내 최대하중이므로 기존 EN383_MAX_5MM 평가 분류로 대응하고 시험 표준은 ISO로 유지했다.
- paper-78은 회수목이라는 이력을 보존했다. paper-87은 천공·조립·시험 함수율 이력을 별도 시험군으로 기록하고 균열군은 제외했다. 일반 시험과 일괄 회귀하기 전 이력과 보강 조건을 검토해야 한다.
- paper-99의 TRTL 0/100%는 원문 Table 2대로 GLT이며 나머지는 CLT이다. CLT 0°/90°는 바깥층 섬유 기준이다.
- 정확한 종이 원문에서 확인되지 않은 spruce/oak/birch는 속 수준으로 기록했다. SPF는 상업 수종군을 그대로 보존했다.

## 이번에 추가하지 않은 범위

전체 186개 문헌의 전수 정밀추출 완료본은 아니다. 엑셀 실험 요약이 있는 후보 중 위 12편의 표 추출을 완료했다. 나머지는 screening_register.csv에 요약 단계 보류 / 후속 정밀추출 / 제목만 확인 등을 구분했다. 미추출은 부적합 판정이 아니다.

- paper-10 소장본은 4페이지 본문에 숫자 표가 빠져 있어 조건별 값을 생성하지 않았다.
- LVL·합판·OSB·대나무·복합재, 목재 다월·네일·전산볼트, 처리·균열·접촉 보강 시험은 현재 SOLID/GLT/CLT와 SCREW/DOWEL 분류로 일괄 편입하지 않았다. 일부 논문에는 추가 가능한 대조군이 있을 수 있다.
- paper-8과 같은 DOI인 후속 목록 항목은 별도 논문/실험으로 중복 추가하지 않았다. paper-66과 회의 발표 paper-85도 함께 이중 수록하지 않았다.

## 검증 및 파일

- 기존 87개 행의 모든 필드 동일성, 34열 순서, 관측 ID/시험군 중복, 단위·숫자, 방향/각도, n/SD 상태, 원문 레지스트리/DOI를 검증했다.
- 소장 원문 17편의 SHA-256이 레지스트리와 일치한다. 새 PDF 표 이미지를 읽고, paper-55/62/99에서는 154개 숫자 필드를 추출 텍스트와 별도로 대조했다.
- 전체 마스터: ../../literature_strength_long.csv 및 /Users/sulas/Desktop/datat/exports/literature_strength_long.csv
- 이번 추가분만: reviewed_additions.csv
- 원문 메타데이터: reviewed_sources.json 및 프로젝트 docs/paper_sources.json
- 이전 원본 백업: before_import/ (프로젝트 87행, 작업폴더 83행, 기존 원문 목록)
- 원본 Excel과 PDF는 수정하지 않았다. 운영 서버 배포나 예측식 재학습은 수행하지 않았다.

paper-122의 엑셀 DOI 칸은 ISSN이어서, 식별정보만 [저널 SciELO 원문 페이지](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-33052017000300492)에서 DOI 10.4067/S0718-33052017000300492를 확인했다. 실험 숫자는 소장 PDF Table 4를 사용했다.

최종 실행 검증: 프로젝트 Python 추가/중복 거부 테스트 3개 통과. 실제 Java 데이터 로더가 228개 점·186개 시험군·17편과 기존 미대조 25개 항목을 정상 처리했다. Gradle Java 회귀 테스트 26개가 모두 통과했다. 기존 비교 동작 검증은 87행 기준 fixture로 고정하고, 전체 탐색 검증은 현재 228행을 검사하도록 갱신했다.
