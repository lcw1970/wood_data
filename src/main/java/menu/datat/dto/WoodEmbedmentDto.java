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
}
