package menu.datat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WoodEmbedmentDto {
    private String scientificName;   // 학명
    private String category;         // 분류 (침엽수/활엽수)
    private String densityRange;     // 밀도 범위 (kg/m³)
    private String screwRange;       // 스크류/파스너 범위 (mm)
    private String parallelStrength; // 섬유평행 지압강도 범위 (MPa)
    private String perpStrength;     // 섬유직각 지압강도 범위 (MPa)
    private String standard;         // 적용 시험 표준
    private String paperUrl;         // 원문 링크 URL
    private String sourceId;         // 원문 대조한 논문 식별자
    private String sourceTitle;
    private String sourceLocation;   // 표 번호 및 PDF 페이지
    private String fastenerType;     // SCREW / DOWEL (볼트 평활부 포함); 미확인 값은 비움
    private String testConditions;   // 값의 정의와 시험 조건
    private String testSetup;        // FULL_HOLE / HALF_HOLE / UNKNOWN; 원문 시험 형상
    private String strengthBasis;    // EN383_MAX_5MM / OFFSET_5_PERCENT / UNKNOWN
    private String testGroupId;

    public WoodEmbedmentDto(String scientificName, String category, String densityRange, String screwRange,
                            String parallelStrength, String perpStrength, String standard, String paperUrl,
                            String sourceId, String sourceTitle, String sourceLocation, String fastenerType,
                            String testConditions, String testSetup, String strengthBasis) {
        this(scientificName, category, densityRange, screwRange, parallelStrength, perpStrength, standard, paperUrl,
                sourceId, sourceTitle, sourceLocation, fastenerType, testConditions, testSetup, strengthBasis, "");
    }

    public WoodEmbedmentDto(String scientificName, String category, String densityRange, String screwRange,
                            String parallelStrength, String perpStrength, String standard, String paperUrl,
                            String sourceId, String sourceTitle, String sourceLocation, String fastenerType,
                            String testConditions) {
        this(scientificName, category, densityRange, screwRange, parallelStrength, perpStrength, standard,
                paperUrl, sourceId, sourceTitle, sourceLocation, fastenerType, testConditions, "UNKNOWN", "UNKNOWN");
    }

    public String getTestSetupLabel() {
        return switch (testSetup == null ? "" : testSetup) {
            case "FULL_HOLE" -> "Full-hole · 전공법";
            case "HALF_HOLE" -> "Half-hole · 반공법";
            default -> "시험 형상 미확인";
        };
    }

    public String getStrengthBasisLabel() {
        return switch (strengthBasis == null ? "" : strengthBasis) {
            case "EN383_MAX_5MM" -> "EN 383 최대값 · 변위 5 mm 이내";
            case "OFFSET_5_PERCENT" -> "5% 직경 오프셋 항복값";
            default -> "강도 평가 방식 미확인";
        };
    }
}
