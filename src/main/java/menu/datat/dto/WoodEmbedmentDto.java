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
}