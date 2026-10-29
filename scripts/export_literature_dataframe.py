"""Convert the app's verified paper tables to one numeric, long-format DataFrame.

This adapter expands reported group summaries; it never creates individual specimens.
Run from the project root: python scripts/export_literature_dataframe.py
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "src/main/resources/wood_data.csv"
DEFAULT_OUTPUT = ROOT / "exports/literature_strength_long.csv"

SCHEMA = {
    "observation_id": ("string", "강도값 식별자. 논문·시험군·방향·강도정의·통계종류 조합"),
    "test_group_id": ("string", "논문 내 관련 시험 조건 식별자. 같은 시편 또는 반복측정을 의미하지 않음"),
    "study_id": ("string", "논문 식별자. 논문이 추가되어도 기존 값을 유지"),
    "species_scientific": ("string", "수종 학명"),
    "wood_group": ("string", "SOFTWOOD / HARDWOOD"),
    "product_form": ("string", "SOLID / GLT / CLT"),
    "fastener_type": ("string", "SCREW / DOWEL. DOWEL에는 볼트 평활부 포함"),
    "load_direction": ("string", "PARALLEL / PERPENDICULAR / RADIAL / TANGENTIAL"),
    "grain_angle_deg": ("Float64", "하중과 섬유 사이 각도. R/T는 모두 90°이며 서로 별도 값"),
    "diameter_mm": ("Float64", "논문 비교에 표시한 직경. 아래 diameter_basis와 함께 해석"),
    "diameter_basis": ("string", "NOMINAL / MEASURED / UNKNOWN. 현재 대조한 논문 조건을 보존"),
    "effective_diameter_mm": ("Float64", "조건에 명시된 유효직경만 전사. 미확인은 빈칸"),
    "density_kg_m3": ("Float64", "논문이 보고한 밀도. 비중에서 환산하지 않음"),
    "density_status": ("string", "REPORTED / NOT_REPORTED / NOT_STRUCTURED"),
    "density_basis": ("string", "현재 AS_REPORTED. 함수율·질량/체적 기준은 원문 확인 후 구분"),
    "specific_gravity": ("Float64", "조건에 보고된 G만 전사. density/1000 추정값을 넣지 않음"),
    "moisture_content_pct": ("Float64", "기존 시험 조건에 수치로 명시된 함수율만 전사"),
    "thickness_mm": ("Float64", "기존 시험 조건에 수치로 명시된 시편 두께만 전사"),
    "test_setup": ("string", "FULL_HOLE / HALF_HOLE / UNKNOWN"),
    "test_standard": ("string", "논문에서 사용한 시험 표준과 판본"),
    "strength_basis": ("string", "OFFSET_5_PERCENT / EN383_MAX_5MM / UNKNOWN. 항복·최대 정의"),
    "observation_level": ("string", "현재 GROUP_SUMMARY. 개별 시편 원자료와 별도로 관리"),
    "value_statistic": ("string", "현재 MEAN. 향후 개별값·특성값은 별도 종류/행으로 구분"),
    "strength_mpa": ("Float64", "보고된 지압강도 숫자. 단위 문자열이나 범위를 넣지 않음"),
    "strength_sd_mpa": ("Float64", "원문 표준편차. 현재 미전사이며 임의 생성하지 않음"),
    "n_specimens": ("Int64", "이 방향·이 강도 통계값에 대응하는 시편 수. 현재 미전사"),
    "n_status": ("string", "현재 NOT_EXTRACTED. 원문에 없다는 뜻과 구분"),
    "sd_status": ("string", "현재 NOT_EXTRACTED. 표준편차 0이라는 뜻과 구분"),
    "source_title": ("string", "논문 제목"),
    "source_locator": ("string", "원문 표 번호·시험군·페이지"),
    "source_url": ("string", "논문 DOI/원문 주소"),
    "reported_group_label": ("string", "STS 12T, 시편 두께 등 기존 시험군 표기를 보존"),
    "raw_strength_text": ("string", "전사 전 강도 문자열. R/T 분리와 숫자 추적에 사용"),
    "test_notes": ("string", "선공·파스너 형상·유효면적 등 아직 별도 열로 분리하지 않은 원문 조건"),
}


def scalar(text):
    value = str(text or "").strip()
    return float(value) if re.fullmatch(r"\d+(?:\.\d+)?", value) else None


def noted_number(notes, pattern):
    match = re.search(pattern, notes)
    return float(match.group(1)) if match else None


def build_dataframe(input_path=DEFAULT_INPUT):
    records = []
    with Path(input_path).open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if not all(row.get(k, "").strip() for k in ("sourceId", "sourceTitle", "sourceLocation", "testConditions")):
                continue
            if not row.get("paperUrl", "").startswith("https://doi.org/"):
                continue
            diameter = scalar(row.get("screwRange"))
            if diameter is None:
                continue
            notes, category = row["testConditions"], row["category"]
            product = "CLT" if re.search(r"직교|CLT", category) else "GLT" if re.search(r"집성재|GLT|Glulam", category) else "SOLID"
            species = re.sub(r"\s*\(.*$", "", row["scientificName"])
            identity = json.dumps([row["sourceId"], row["scientificName"], row["screwRange"], row["sourceLocation"]], ensure_ascii=False)
            group_id = row.get("testGroupId") or row["sourceId"] + "_" + hashlib.sha256(identity.encode()).hexdigest()[:16]
            basis = row.get("strengthBasis") or "UNKNOWN"
            # Current imports are verified table means. New sources must declare their statistic.
            statistic = row.get("valueStatistic") or ("MEAN" if row["sourceId"] in
                        {"paper-9", "paper-30", "paper-34", "paper-72"} else "UNKNOWN")
            density = scalar(row.get("densityRange"))
            common = dict(
                test_group_id=group_id, study_id=row["sourceId"], species_scientific=species,
                wood_group="SOFTWOOD" if "침엽수" in category else "HARDWOOD" if "활엽수" in category else "UNKNOWN",
                product_form=product, fastener_type=row.get("fastenerType") or "UNKNOWN",
                diameter_mm=diameter,
                diameter_basis="MEASURED" if re.search(r"실측\s*직경", notes) else "NOMINAL" if re.search(r"공칭|볼트\s*\d", notes) else "UNKNOWN",
                effective_diameter_mm=noted_number(notes, r"유효\s*(?:직경\s*)?(\d+(?:\.\d+)?)\s*mm"),
                density_kg_m3=density,
                density_status="REPORTED" if density is not None else "NOT_REPORTED" if "밀도 미기재" in notes else "NOT_STRUCTURED",
                density_basis="AS_REPORTED" if density is not None else None,
                specific_gravity=noted_number(notes, r"비중\s*G\s*=\s*(\d+(?:\.\d+)?)"),
                moisture_content_pct=noted_number(notes, r"함수율\s*(\d+(?:\.\d+)?)\s*%"),
                thickness_mm=noted_number(notes, r"시편\s*두께\s*(\d+(?:\.\d+)?)\s*mm"),
                test_setup=row.get("testSetup") or "UNKNOWN", test_standard=row["standard"],
                strength_basis=basis, observation_level="GROUP_SUMMARY", value_statistic=statistic,
                strength_sd_mpa=None, n_specimens=None, n_status="NOT_EXTRACTED", sd_status="NOT_EXTRACTED",
                source_title=row["sourceTitle"], source_locator=row["sourceLocation"], source_url=row["paperUrl"],
                reported_group_label=row["scientificName"], test_notes=notes,
            )
            observations = []
            parallel, perpendicular = scalar(row["parallelStrength"]), scalar(row["perpStrength"])
            if parallel is not None:
                observations.append(("PARALLEL", 0, parallel, row["parallelStrength"]))
            if perpendicular is not None:
                observations.append(("PERPENDICULAR", 90, perpendicular, row["perpStrength"]))
            else:
                rt = re.fullmatch(r"R\s+(\d+(?:\.\d+)?);\s*T\s+(\d+(?:\.\d+)?)", row["perpStrength"].strip())
                if rt:
                    observations.extend((direction, 90, float(rt.group(i)), row["perpStrength"])
                                        for direction, i in (("RADIAL", 1), ("TANGENTIAL", 2)))
            for direction, angle, value, raw in observations:
                records.append(dict(common, observation_id=f"{group_id}_{direction}_{basis}_{statistic}",
                                    load_direction=direction, grain_angle_deg=angle, strength_mpa=value, raw_strength_text=raw))
    df = pd.DataFrame(records, columns=SCHEMA)
    for column, (dtype, _) in SCHEMA.items():
        df[column] = df[column].astype(dtype)
    if df["observation_id"].duplicated().any():
        raise ValueError("동일 관측 ID가 중복됩니다. 별개의 시험군은 명시적으로 구분한 후 다시 내보내세요.")
    if not (df["strength_mpa"].gt(0).all() and df["diameter_mm"].gt(0).all()):
        raise ValueError("직경과 강도는 양수여야 합니다.")
    return df


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--json-intermediate", type=Path)
    parser.add_argument("--replace", action="store_true", help="기존 마스터를 초기 자료로 교체 (추가 논문이 삭제될 수 있음)")
    args = parser.parse_args()
    df = build_dataframe(args.input)
    if args.json_intermediate:
        payload = {"columns": list(SCHEMA), "rows": df.astype(object).where(df.notna(), None).values.tolist()}
        args.json_intermediate.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    else:
        if args.output.exists() and not args.replace:
            parser.error("기존 마스터를 덮어쓰지 않습니다. 새 논문은 manage_literature.py --append로 추가하세요.")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"{df.study_id.nunique()} papers; {df.test_group_id.nunique()} groups; {len(df)} reported values")


if __name__ == "__main__":
    main()
