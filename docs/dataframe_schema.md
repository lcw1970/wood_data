# 논문 지압강도 DataFrame 구조

한 행은 **한 논문의 한 시험 조건에서, 한 하중 방향과 한 강도 정의에 대해 보고한 강도값**이다. 현재 파일은 시험군 평균값 228행이며 개별 시편의 원자료와 분리한다. 새 논문은 같은 컬럼에 행을 추가한다.

## 먼저 볼 핵심 열

| 구분 | 열 | 의미 |
| --- | --- | --- |
| 식별 | study_id, test_group_id, observation_id | 논문, 관련 시험 조건, 개별 보고값의 식별자 |
| 목재 | species_scientific, wood_group, product_form | 학명, 침엽수/활엽수, 원목/GLT/CLT |
| 파스너 | fastener_type, diameter_mm, diameter_basis | 스크류/다월, 직경 숫자, 공칭/실측 구분 |
| 방향 | load_direction, grain_angle_deg | 평행/직각/R/T 및 하중-섬유 각도 |
| 물성 | density_kg_m3, specific_gravity, moisture_content_pct | 밀도, 비중, 함수율을 독립적으로 기록 |
| 시험 | test_setup, test_standard, strength_basis | Full/Half-hole, 시험 표준, 항복/최대값 평가 정의 |
| 결과 | observation_level, value_statistic, strength_mpa | 시험군 요약/개별값, 평균/특성값 등, 강도 숫자 |
| 표본·산포 | n_specimens, strength_sd_mpa, n_status, sd_status | 해당 값에 대응하는 시편 수와 SD, 전사 상태 |
| 근거 | source_title, source_locator, source_url, test_notes | 논문명, 표·시험군·페이지, 원문, 추가 조건 |

CSV에는 결측 구분과 원문 추적을 위한 보조 열도 포함한다. 컬럼명에 단위를 넣고 셀에는 숫자만 저장한다. ID는 재정렬/추가 후에도 유지한다.

## 현재 데이터에서의 예

같은 Larix kaempferi STS 12T 조건의 평행 30.66, R 12.4, T 13.9 MPa는 3행으로 저장한다. R/T를 평균내지 않는다. 같은 test_group_id는 관련 설계 조건을 묶는 키이며 같은 물리적 시편을 반복 측정했다는 뜻이 아니다.

일반 직각 방향은 PERPENDICULAR, 방사는 RADIAL, 접선은 TANGENTIAL이다. R/T의 grain_angle_deg는 모두 90이지만 서로 구분한다. 향후 45도 등은 각도 열에 직접 기록하며 방향 분류도 명시한다.

## 수치·누락값 규칙

- density_kg_m3에 비중×1000을 채우지 않는다. 비중은 specific_gravity에 별도 기록한다.
- 공칭 직경과 유효직경을 덮어쓰지 않는다. diameter_basis와 effective_diameter_mm를 함께 보존한다.
- 기존 4편의 n_specimens와 strength_sd_mpa는 미전사이므로 비워 두고 NOT_EXTRACTED로 표시한다. paper-146과 2026-10-29 추가분의 시편 수는 원문과 대조해 REPORTED로 기록했다. 새 141개 행 중 SD가 직접 보고된 23개 행도 전사했다. NOT_EXTRACTED는 원문에 보고되지 않았다는 판정이 아니다.
- 숫자 0, 미기재(NOT_REPORTED), 아직 미전사(NOT_EXTRACTED), 정의 미확인(UNKNOWN)을 구분한다. 결측값은 0으로 바꾸지 않는다.
- 평균, 5% 특성값, 최대하중 기반값, 오프셋 항복값을 구분한다. 최대하중 기반 시험값도 여러 시편의 평균을 보고할 수 있으므로 value_statistic과 strength_basis는 서로 다른 열이다.
- 논문에 개별 시편 값이 있으면 specimen_id를 둔 별도 원자료 테이블로 관리한다. 시험군 평균과 개별 시편을 한 회귀 입력으로 섞지 않는다.
- 샘플 수나 표준편차를 모르는 그룹에 임의 가중치를 부여하지 않는다. 동일 논문의 여러 평균값도 서로 독립 표본이라고 자동 가정하지 않는다.

## pandas로 읽기

```python
from pathlib import Path
import pandas as pd

data_file = Path('exports/literature_strength_long.csv')
df = pd.read_csv(data_file, encoding='utf-8-sig', dtype={
    'observation_id': 'string', 'test_group_id': 'string', 'study_id': 'string',
    'n_specimens': 'Int64',
})

# 같은 방향·시험 형상·강도 정의의 자료 선택
selected = df.loc[
    (df['load_direction'] == 'PARALLEL') &
    (df['test_setup'] == 'HALF_HOLE') &
    (df['strength_basis'] == 'OFFSET_5_PERCENT') &
    (df['observation_level'] == 'GROUP_SUMMARY') &
    (df['value_statistic'] == 'MEAN')
].copy()

print(df.shape)
print(selected[['study_id', 'species_scientific', 'diameter_mm', 'strength_mpa']])
```

## 새 논문 추가와 중복 관리

1. 처음에는 이 긴 형식 CSV 하나를 마스터로 사용한다. 침엽수/활엽수·논문별로 별도 컬럼이나 파일을 계속 만들지 않는다.
2. 논문에 study_id를 하나 부여하고 DOI 및 표·시험군 위치를 기록한다. 새 시험 조건에 test_group_id를 부여하고 기존 ID는 유지한다.
3. 평행/R/T·서로 다른 강도 정의는 별도 observation_id로 행을 추가한다. 동일 시험을 다른 논문이 재인용했으면 새 실험으로 중복 등록하지 않는다.
4. 합칠 때 컬럼·단위를 통일하고 observation_id 중복은 삭제하기 전에 원인을 확인한다. 값이 우연히 같다는 이유로 행을 지우지 않는다.

```python
frames = [pd.read_csv(path, encoding='utf-8-sig') for path in paths]
combined = pd.concat(frames, ignore_index=True)
duplicates = combined[combined.duplicated('observation_id', keep=False)]
if not duplicates.empty:
    raise ValueError('같은 관측 ID가 중복됩니다. 재인용/재추출/별도 시험 여부를 확인하세요.')
```

논문 정보가 커지면 papers 테이블(study_id 1행/논문)과 observations 테이블(강도값 1행)을 분리하고 study_id로 결합할 수 있다. 반복 비교의 독립성은 시편/배치/시험군 정보를 원문에서 추가 확인한다.

## 사이트 연동과 추가 절차

`exports/literature_strength_long.csv`가 pandas와 사이트의 공통 원본이다. 사이트는 매 요청마다 같은 CSV를 읽는다. `/explorer`는 전체 분포를, 계산기는 입력 조건에 가까운 논문 시험군을 표시한다. `/literature.csv`에서 원본을 내려받을 수 있다. 현재 17편·186개 시험군 ID·228개 평균값이다. 2026-10-29 추가 기록은 `literature_expansion_20261029.md`에 정리했다.

검토한 새 논문의 DOI·표 위치·로컬 PDF 해시는 `docs/paper_sources.json`에 기록한다. 추가 데이터는 같은 34개 열의 CSV로 준비하고 아래 명령을 실행한다. 중복 ID나 잘못된 값은 기존 마스터를 변경하기 전에 거부한다.

```sh
python3 scripts/manage_literature.py --check
python3 scripts/manage_literature.py --append /path/to/reviewed_paper.csv
```

현재 웹앱은 GROUP_SUMMARY/MEAN 및 0°·90°·R/T를 지원한다. 다른 각도·특성값·개별 시편 데이터는 별도 확장 전까지 혼합하지 않는다. 새 자료를 추가해도 예측식 계수를 자동 보정하지 않는다.

`scripts/export_literature_dataframe.py`는 최초 네 논문의 넓은 CSV를 변환한 초기 어댑터다. 기존 마스터는 기본으로 덮어쓰지 않으며, 이후 논문 추가는 위 명령으로 처리한다. 새 임시 출력으로 변환할 때만 `--output`을 지정한다. 이 초기 어댑터에는 pandas가 필요하고, `manage_literature.py` 검증·추가는 Python 표준 라이브러리만 사용한다.

## 전체 컬럼 사전

| 열 | pandas 자료형 | 의미 |
| --- | --- | --- |
| observation_id | string | 강도값 식별자. 논문·시험군·방향·강도정의·통계종류 조합 |
| test_group_id | string | 논문 내 관련 시험 조건 식별자. 같은 시편 또는 반복측정을 의미하지 않음 |
| study_id | string | 논문 식별자. 논문이 추가되어도 기존 값을 유지 |
| species_scientific | string | 수종 학명 |
| wood_group | string | SOFTWOOD / HARDWOOD |
| product_form | string | SOLID / GLT / CLT |
| fastener_type | string | SCREW / DOWEL. DOWEL에는 볼트 평활부 포함 |
| load_direction | string | PARALLEL / PERPENDICULAR / RADIAL / TANGENTIAL |
| grain_angle_deg | Float64 | 하중과 섬유 사이 각도. R/T는 모두 90°이며 서로 별도 값 |
| diameter_mm | Float64 | 논문 비교에 표시한 직경. 아래 diameter_basis와 함께 해석 |
| diameter_basis | string | NOMINAL / MEASURED / UNKNOWN. 현재 대조한 논문 조건을 보존 |
| effective_diameter_mm | Float64 | 조건에 명시된 유효직경만 전사. 미확인은 빈칸 |
| density_kg_m3 | Float64 | 논문이 보고한 밀도. 비중에서 환산하지 않음 |
| density_status | string | REPORTED / NOT_REPORTED / NOT_STRUCTURED |
| density_basis | string | AS_REPORTED. 조정 밀도/기준기후/재료 전체 평균의 범위는 test_notes에 기록 |
| specific_gravity | Float64 | 조건에 보고된 G만 전사. density/1000 추정값을 넣지 않음 |
| moisture_content_pct | Float64 | 기존 시험 조건에 수치로 명시된 함수율만 전사 |
| thickness_mm | Float64 | 기존 시험 조건에 수치로 명시된 시편 두께만 전사 |
| test_setup | string | FULL_HOLE / HALF_HOLE / UNKNOWN |
| test_standard | string | 논문에서 사용한 시험 표준과 판본 |
| strength_basis | string | OFFSET_5_PERCENT / EN383_MAX_5MM / UNKNOWN. 항복·최대 정의 |
| observation_level | string | 현재 GROUP_SUMMARY. 개별 시편 원자료와 별도로 관리 |
| value_statistic | string | 현재 MEAN. 향후 개별값·특성값은 별도 종류/행으로 구분 |
| strength_mpa | Float64 | 보고된 지압강도 숫자. 단위 문자열이나 범위를 넣지 않음 |
| strength_sd_mpa | Float64 | 원문 표준편차. 원문 SD가 확인된 행은 전사하고 미전사는 빈칸. CV에서 임의 생성하지 않음 |
| n_specimens | Int64 | 이 방향·이 강도 통계값에 대응하는 시편 수. 확인한 값만 기록 |
| n_status | string | REPORTED / NOT_EXTRACTED / NOT_REPORTED |
| sd_status | string | REPORTED / NOT_EXTRACTED / NOT_REPORTED. 빈칸을 표준편차 0으로 해석하지 않음 |
| source_title | string | 논문 제목 |
| source_locator | string | 원문 표 번호·시험군·페이지 |
| source_url | string | 논문 DOI/원문 주소 |
| reported_group_label | string | STS 12T, 시편 두께 등 기존 시험군 표기를 보존 |
| raw_strength_text | string | 전사 전 강도 문자열. R/T 분리와 숫자 추적에 사용 |
| test_notes | string | 선공·파스너 형상·유효면적 등 아직 별도 열로 분리하지 않은 원문 조건 |
