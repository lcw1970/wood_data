package menu.datat.service;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class EmbedmentPredictionService {
    public enum FastenerType {
        SCREW("스크류"), DOWEL("다월");
        private final String label;
        FastenerType(String label) { this.label = label; }
        public String getLabel() { return label; }
    }

    public record Value(String id, String label, double parallel, double perpendicular,
                        boolean commonDirection, String formula, String sourceUrl, String sourceNote) { }

    public List<Value> predict(double density, double diameter, String woodType, FastenerType type) {
        validate(density, diameter);
        if (type == null) throw new IllegalArgumentException("파스너 종류를 선택해 주세요.");
        boolean screw = type == FastenerType.SCREW;
        // Fixed comparison assumption: entered d is the smooth bearing-shank diameter.
        // EC5 8.7.1 routes smooth-shank screws <=6 mm to the nail rules (pre-drilled here).
        // Larger screws use bolt rules. No arbitrary root-diameter ratio is invented.
        boolean ec5SmallScrew = screw && diameter <= 6;
        double ec5 = 0.082 * (1 - 0.01 * diameter) * density;
        double k90 = ("HARDWOOD".equals(woodType) ? 0.90 : 1.35) + 0.015 * diameter;
        // User requested no additional inputs. G is explicitly labelled as a proxy in the UI.
        double gravityProxy = density / 1000.0;
        double nds0 = diameter < 6.35 ? 114.453 * Math.pow(gravityProxy, 1.84) : 77.2 * gravityProxy;
        double nds90 = diameter < 6.35 ? nds0 : 212 * Math.pow(gravityProxy, 1.45) / Math.sqrt(diameter);
        return List.of(
                new Value("ec5", "EC5 참고 예측값", round(ec5), round(ec5SmallScrew ? ec5 : ec5 / k90), ec5SmallScrew,
                        "f_h,0,ref = 0.082 × (1 - 0.01d) × ρ; " + (ec5SmallScrew
                                ? "d ≤ 6 mm인 선공 스크류: f_h,90,ref = f_h,0,ref"
                                : "f_h,90,ref = f_h,0,ref / k90"),
                        "https://rk-hub.hope-erasmusproject.eu/index.php/ro/item/download/197_ac9b30e923d9e2a58ac15e37f6521aca",
                        "EN 1995-1-1:2004+A1:2008. " + (screw
                                ? "§8.7.1(2)·(4)·(5): 외경과 평활부 지름이 같고 평활부 관입이 4d 이상인 스크류를 가정. d > 6 mm는 §8.5.1.1 식(8.31)~(8.33), d ≤ 6 mm는 §8.3.1.1 식(8.16)의 선공 못 규정을 적용."
                                : "§8.6에서 §8.5.1.1 식(8.31)~(8.33)을 참조. 원문 다월 범위는 6 < d < 30 mm이며 범위 밖은 외삽 참고값.")
                                + " 원문 ρ_k 대신 입력 ρ를 대입. k90: 침엽수 1.35+0.015d, 활엽수 0.90+0.015d."),
                new Value("nds", "NDS 참고 예측값", round(nds0), round(nds90), diameter < 6.35,
                        "d ≥ 6.35 mm: f_e,0,ref = 77.2G; f_e,90,ref = 212G^1.45 / √d. d < 6.35 mm: f_e,0,ref = f_e,90,ref = 114.453G^1.84",
                        "https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-withCommentary_20210928_AWCWebsite_Chapter12.pdf",
                        "NDS 2018 §12.3.3, Table 12.3.3 및 주석의 지압강도 식을 MPa·mm로 환산(원문은 psi·inch). "
                                + "대직경 원식: F_e∥=11200G, F_e⊥=6100G^1.45/√D; 소직경 원식: F_e=16600G^1.84. "
                                + (screw ? "§12.3.7의 평활부 지름 사용 조건을 가정하며 나사산 지압 길이는 전체의 1/4 이하로 둠. " : "")
                                + "G는 규정 비중의 측정값 대신 ρ/1000을 가정. 표의 대직경 범위는 6.35~25.4 mm, 초과는 외삽 참고값."),
                new Value("kds", "KDS 참고 예측값", round(79 * gravityProxy), round(216 * Math.pow(gravityProxy, 1.45) / Math.sqrt(diameter)), false,
                        "f_e,0,ref = 79G; f_e,90,ref = 216G^1.45 / √d",
                        "https://standard.go.kr/KSCI/newSta/common/dbFileDown.do?atchmnflId=APOT2025011613323428&atchmnflSn=70",
                        "KDS 41 50 30:2022 " + (screw
                                ? "§4.7.3.1 래그나사못접합부의 F_e∥·F_e⊥ 정의. d는 나삿니 없는 못대 지름으로 가정. 표 4.7-1의 치수에 맞는 래그나사못용 규정이며 모든 셀프태핑 스크류의 제품식은 아님."
                                : "§4.5.2.1 볼트접합부의 F_e∥·F_e⊥ 정의를 강재 다월의 비교식으로 사용.")
                                + " G ≈ ρ/1000 가정. 여기서는 지압강도만 계산하며 접합부 전단내력 Z를 계산하지 않음."));
    }

    public Value screwLiteraturePrediction(double density, double diameter) {
        // Cabrera et al. (2022), Table 3: draft-EC5 comparison, NOT the adopted EC5 equation above.
        validate(density, diameter);
        double reference = round(0.019 * Math.pow(density, 1.24) * Math.pow(diameter, -0.3));
        return new Value("screw-literature", "스크류 문헌식 예측값", reference, reference, true,
                "f_h,ref = 0.019 × ρ^1.24 × d^-0.3 / (2.5cos²ε + sin²ε); ε = 90°",
                "https://doi.org/10.3390/f13081154",
                "Cabrera 외(2022), Forests 13, 1154, Table 3(PDF p.10)의 prEC5 비교 모델. "
                        + "스크류 축과 섬유 사이 각도 ε=90° 고정. 하중의 평행·직각 방향은 구분하지 않음. "
                        + "입력 d를 문헌식의 직경으로 사용하고 입력 ρ를 대입. 위 EC5 채택 규정과 구분한 문헌 기반 예측값.");
    }

    public Map<String, Object> chartData(double density, double diameter, String woodType, FastenerType type) {
        SortedSet<Double> diameters = new TreeSet<>(List.of(6d, 8d, 10d, 12d, 14d, 16d, 18d, 20d, 22d, 24d, diameter));
        diameters.addAll(List.of(6.0001, 6.3499, 6.35)); // show changes in the EC5/NDS rules
        List<Value> selected = predict(density, diameter, woodType, type);
        List<Map<String, Object>> curves = new ArrayList<>();
        String[] colors = {"#2563eb", "#dc2626", "#16a34a"};
        for (int index = 0; index < selected.size(); index++) {
            List<Map<String, Double>> parallel = new ArrayList<>();
            List<Map<String, Double>> perpendicular = new ArrayList<>();
            Double previous = null;
            String modelId = selected.get(index).id();
            for (double d : diameters) {
                if (previous != null) {
                    double gap = (previous + d) / 2;
                    if (modelId.equals("nds") && previous < 6.35 && d >= 6.35) {
                        // Distinct equations meet here; do not draw a fictitious vertical connector.
                        parallel.add(chartPoint(gap, null));
                        perpendicular.add(chartPoint(gap, null));
                    }
                    if (modelId.equals("ec5") && type == FastenerType.SCREW && previous <= 6 && d > 6) {
                        perpendicular.add(chartPoint(gap, null));
                    }
                }
                Value value = predict(density, d, woodType, type).get(index);
                parallel.add(Map.of("x", d, "y", value.parallel()));
                perpendicular.add(Map.of("x", d, "y", value.perpendicular()));
                previous = d;
            }
            curves.add(Map.of("label", selected.get(index).label(), "color", colors[index],
                    "parallel", parallel, "perpendicular", perpendicular));
        }
        return Map.of("density", density, "diameter", diameter, "commonDirection", false,
                "models", curves);
    }

    private double round(double value) { return Math.round(value * 100.0) / 100.0; }

    private Map<String, Double> chartPoint(double diameter, Double strength) {
        Map<String, Double> point = new LinkedHashMap<>();
        point.put("x", diameter);
        point.put("y", strength);
        return point;
    }

    private void validate(double density, double diameter) {
        if (!Double.isFinite(density) || density <= 0 || !Double.isFinite(diameter) || diameter <= 0 || diameter > 30) {
            throw new IllegalArgumentException("밀도는 0보다 크게, 직경은 0 초과 30 mm 이하로 입력해 주세요.");
        }
    }
}
