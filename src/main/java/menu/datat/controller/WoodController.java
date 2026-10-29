package menu.datat.controller;

import menu.datat.dto.WoodEmbedmentDto;
import menu.datat.service.LiteratureComparisonService;
import menu.datat.service.EmbedmentPredictionService;
import menu.datat.service.LiteratureDatasetService;
import menu.datat.service.EmbedmentPredictionService.FastenerType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.*;
import java.io.IOException;

@Controller
public class WoodController {

    private final LiteratureComparisonService literature;

    private final EmbedmentPredictionService predictions;
    private final LiteratureDatasetService dataset;

    public WoodController(LiteratureComparisonService literature, EmbedmentPredictionService predictions,
                          LiteratureDatasetService dataset) {
        this.literature = literature;
        this.predictions = predictions;
        this.dataset = dataset;
    }

    @GetMapping("/")
    public String getWoodDataList(Model model) {
        List<WoodEmbedmentDto> list = readWoodData();
        model.addAttribute("woodList", list);
        model.addAttribute("verifiedCount", list.stream().filter(r -> !r.getSourceId().isBlank()).count());
        return "index";
    }

    @GetMapping("/calculator")
    public String showCalculator() {
        return "calculator";
    }

    @GetMapping("/explorer")
    public String exploreLiterature(Model model) {
        model.addAttribute("explorerData", literature.explorerData(readWoodData()));
        return "explorer";
    }

    @GetMapping(value = "/literature.csv", produces = "text/csv;charset=UTF-8")
    @ResponseBody
    public ResponseEntity<byte[]> downloadLiterature() throws IOException {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"literature_strength_long.csv\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store").body(dataset.download());
    }

    @PostMapping("/calculator")
    public String calculate(@RequestParam("density") double density,
                            @RequestParam("diameter") double diameter,
                            @RequestParam(value = "thickness", required = false) Double thickness,
                            @RequestParam(value = "woodType", defaultValue = "SOFTWOOD") String woodType,
                            @RequestParam(value = "calcMode", defaultValue = "STRENGTH") String calcMode,
                            @RequestParam(value = "fastenerType", defaultValue = "SCREW") FastenerType fastenerType,
                            Model model) {

        model.addAttribute("inputDensity", density);
        model.addAttribute("inputDiameter", diameter);
        model.addAttribute("inputThickness", thickness);
        model.addAttribute("inputWoodType", woodType);
        model.addAttribute("inputCalcMode", calcMode);
        model.addAttribute("inputFastenerType", fastenerType);
        if (!Double.isFinite(density) || density <= 0 || !Double.isFinite(diameter)
                || diameter <= 0 || diameter > 30 || (thickness != null && (!Double.isFinite(thickness) || thickness <= 0))) {
            model.addAttribute("inputError", "밀도는 0보다 크게, 직경은 0 초과 30 mm 이하으로 입력해 주세요. 두께를 입력하는 경우 0보다 커야 합니다.");
            return "calculator";
        }

        var values = predictions.predict(density, diameter, woodType, fastenerType);
        model.addAttribute("predictionModels", values);
        if (fastenerType == FastenerType.SCREW) {
            model.addAttribute("literaturePrediction", predictions.screwLiteraturePrediction(density, diameter));
        }

        // 2. 목재 압축강도 추정 계산 (f_c,0 & f_c,90)
        double fc0 = 0.05 * density;
        double fc90 = 0.005 * density;
        if ("HARDWOOD".equals(woodType)) {
            fc0 *= 1.15; fc90 *= 1.30;
        } else if ("CLT".equals(woodType) || "GLULAM".equals(woodType) || "GLT".equals(woodType)) {
            fc0 *= 1.05;
        }

        // 3. 연산 결과 Map 바인딩 (화면 전달용)
        Map<String, Object> result = new HashMap<>();
        result.put("density", Math.round(density * 100.0) / 100.0);
        result.put("diameter", Math.round(diameter * 100.0) / 100.0);
        result.put("thickness", thickness);
        result.put("woodType", woodType);
        result.put("fastenerType", fastenerType.name());
        result.put("fastenerLabel", fastenerType.getLabel());

        // 목재 압축강도 (f_c)
        result.put("fc0", Math.round(fc0 * 100.0) / 100.0);
        result.put("fc90", Math.round(fc90 * 100.0) / 100.0);

        model.addAttribute("result", result);

        var comparison = literature.compare(readWoodData(), density, diameter, woodType, fastenerType);
        var chartData = new LinkedHashMap<>(predictions.chartData(density, diameter, woodType, fastenerType));
        chartData.put("measurements", literature.chartPoints(comparison));
        model.addAttribute("chartData", chartData);
        model.addAttribute("closeMatches", comparison.closeMatches());
        model.addAttribute("referencePapers", comparison.references());
        model.addAttribute("sameMaterialCount", comparison.sameMaterialCount());
        model.addAttribute("densityTolerance", LiteratureComparisonService.DENSITY_TOLERANCE_PERCENT);
        model.addAttribute("diameterTolerance", LiteratureComparisonService.DIAMETER_TOLERANCE_MM);
        return "calculator";
    }

    private List<WoodEmbedmentDto> readWoodData() {
        return dataset.readAll();
    }
}
