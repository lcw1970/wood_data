"""Validate the reviewed master CSV, or append a reviewed paper without overwriting existing observations.

python scripts/manage_literature.py --check
python scripts/manage_literature.py --append /path/to/reviewed_paper.csv
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import tempfile
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "exports/literature_strength_long.csv"
SOURCES = ROOT / "docs/paper_sources.json"
ENUMS = {
    "wood_group": {"SOFTWOOD", "HARDWOOD"}, "product_form": {"SOLID", "GLT", "CLT"},
    "fastener_type": {"SCREW", "DOWEL"}, "test_setup": {"FULL_HOLE", "HALF_HOLE", "UNKNOWN"},
    "strength_basis": {"OFFSET_5_PERCENT", "EN383_MAX_5MM", "UNKNOWN"},
    "load_direction": {"PARALLEL", "PERPENDICULAR", "RADIAL", "TANGENTIAL"},
    "observation_level": {"GROUP_SUMMARY"}, "value_statistic": {"MEAN"},
    "n_status": {"REPORTED", "NOT_EXTRACTED", "NOT_REPORTED"},
    "sd_status": {"REPORTED", "NOT_EXTRACTED", "NOT_REPORTED"},
}
SHARED = ["study_id", "species_scientific", "wood_group", "product_form", "fastener_type", "diameter_mm",
          "diameter_basis", "effective_diameter_mm", "density_kg_m3", "density_status", "density_basis",
          "specific_gravity", "moisture_content_pct", "thickness_mm", "test_setup", "test_standard", "strength_basis", "source_title", "source_locator",
          "source_url", "reported_group_label", "test_notes"]
REQUIRED = ["observation_id", "test_group_id", "study_id", "species_scientific", "source_title", "source_locator",
            "source_url", "test_notes", "test_standard", "reported_group_label"]


def read_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, strict=True)
        columns = reader.fieldnames or []
        if not columns or len(set(columns)) != len(columns):
            raise ValueError("CSV 열 이름이 없거나 중복됩니다.")
        rows = list(reader)
    if any(None in row or None in row.values() for row in rows):
        raise ValueError("CSV 열 개수가 헤더와 다릅니다.")
    return columns, rows


def numeric(value, key, positive=True):
    if not re.fullmatch(r"\d+(?:\.\d+)?", value or ""):
        raise ValueError(f"수치가 올바르지 않습니다: {key}={value}")
    number = float(value)
    if not math.isfinite(number) or (number <= 0 if positive else number < 0):
        raise ValueError(f"수치 범위를 확인하세요: {key}={value}")
    return number


def validate(columns, rows, sources):
    if not rows:
        raise ValueError("논문 데이터가 비어 있습니다.")
    required_columns = set(REQUIRED + SHARED + list(ENUMS) + ["grain_angle_deg", "diameter_mm", "strength_mpa",
                            "density_kg_m3", "n_specimens", "strength_sd_mpa"])
    if not required_columns.issubset(columns):
        raise ValueError(f"필수 열 누락: {sorted(required_columns - set(columns))}")
    registry = {source["sourceId"]: source for source in sources}
    if len(registry) != len(sources):
        raise ValueError("논문 목록의 sourceId가 중복됩니다.")
    ids, conditions, groups = set(), set(), {}
    for row in rows:
        for key in REQUIRED:
            if not row[key].strip():
                raise ValueError(f"필수 항목 누락: {key}")
        for key in ("observation_id", "test_group_id", "study_id"):
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]*", row[key]):
                raise ValueError(f"잘못된 논문 ID: {key}")
        if row["observation_id"] in ids:
            raise ValueError(f"중복 관측 ID: {row['observation_id']}")
        ids.add(row["observation_id"])
        for key, values in ENUMS.items():
            if row[key] not in values:
                raise ValueError(f"지원하지 않는 분류: {key}={row[key]}")
        for key in ("diameter_mm", "strength_mpa"):
            numeric(row[key], key)
        if row["density_kg_m3"]:
            numeric(row["density_kg_m3"], "density_kg_m3")
        if numeric(row["grain_angle_deg"], "grain_angle_deg", False) != (0 if row["load_direction"] == "PARALLEL" else 90):
            raise ValueError("하중 방향과 각도가 일치하지 않습니다.")
        for value_key, status_key in (("n_specimens", "n_status"), ("strength_sd_mpa", "sd_status")):
            if bool(row[value_key]) != (row[status_key] == "REPORTED"):
                raise ValueError(f"값과 전사 상태가 다릅니다: {value_key}")
            if row[value_key]:
                numeric(row[value_key], value_key, value_key == "n_specimens")
        if row["n_specimens"] and not row["n_specimens"].isdigit():
            raise ValueError("시편 수는 양의 정수여야 합니다.")
        url = urlparse(row["source_url"])
        if url.scheme != "https" or url.netloc != "doi.org" or len(url.path) <= 1:
            raise ValueError("원문 DOI 주소를 확인하세요.")
        source = registry.get(row["study_id"])
        if not source or source.get("url") != row["source_url"] or source.get("title") != row["source_title"]:
            raise ValueError(f"원문 목록과 일치하지 않는 논문: {row['study_id']}")
        if not re.fullmatch(r"[a-f0-9]{64}", source.get("sha256", "")):
            raise ValueError("원문 파일 SHA-256을 기록하세요.")
        key = (row["study_id"], row["test_group_id"], row["strength_basis"])
        condition = (*key, row["load_direction"])
        if condition in conditions:
            raise ValueError("같은 시험군의 방향이 중복됩니다.")
        conditions.add(condition)
        if key in groups and any(groups[key][field] != row[field] for field in SHARED):
            raise ValueError("같은 시험군 ID에 서로 다른 조건이 들어 있습니다.")
        groups[key] = row
    for key in groups:
        directions = {item[-1] for item in conditions if item[:3] == key}
        if "PERPENDICULAR" in directions and directions & {"RADIAL", "TANGENTIAL"}:
            raise ValueError("일반 직각값과 R/T는 별도 시험군으로 구분하세요.")
    return {"papers": len({r["study_id"] for r in rows}), "groups": len(groups), "values": len(rows),
            "by_paper": dict(Counter(r["study_id"] for r in rows))}


def append_reviewed(master, candidate, sources):
    columns, rows = read_csv(master)
    new_columns, added = read_csv(candidate)
    if columns != new_columns:
        raise ValueError("추가 CSV의 열과 순서는 마스터와 같아야 합니다.")
    summary = validate(columns, rows + added, sources)
    # Atomic replacement: requests see either the previous complete CSV or the new complete CSV.
    target = Path(master)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=target.parent, encoding="utf-8-sig", newline="", delete=False) as handle:
            temporary = Path(handle.name)
            writer = csv.DictWriter(handle, columns, lineterminator="\n")
            writer.writeheader(); writer.writerows(rows + added)
            handle.flush(); os.fsync(handle.fileno())
        os.replace(temporary, target)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    operation = parser.add_mutually_exclusive_group()
    operation.add_argument("--check", action="store_true")
    operation.add_argument("--append", type=Path)
    parser.add_argument("--master", type=Path, default=MASTER)
    parser.add_argument("--sources", type=Path, default=SOURCES)
    parser.add_argument("--verify-pdfs", action="store_true", help="소장 PDF의 SHA-256도 대조")
    args = parser.parse_args()
    try:
        sources = json.loads(args.sources.read_text(encoding="utf-8"))
        if args.verify_pdfs:
            for source in sources:
                if hashlib.sha256(Path(source["localFile"]).read_bytes()).hexdigest() != source["sha256"]:
                    raise ValueError(f"원문 파일 해시 불일치: {source['sourceId']}")
        summary = append_reviewed(args.master, args.append, sources) if args.append else validate(*read_csv(args.master), sources)
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(1, f"검증 실패: {error}\n")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
