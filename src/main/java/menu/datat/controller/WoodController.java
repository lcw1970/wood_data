package menu.datat.controller;

import menu.datat.dto.WoodEmbedmentDto;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
public class WoodController {

    // 1. 메인 목록 페이지
    @GetMapping("/")
    public String getWoodDataList(Model model) {
        List<WoodEmbedmentDto> list = new ArrayList<>();

        try {
            ClassPathResource resource = new ClassPathResource("wood_data.csv");
            BufferedReader br = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)
            );

            String line;
            boolean isHeader = true;

            while ((line = br.readLine()) != null) {
                if (isHeader) {
                    isHeader = false;
                    continue;
                }

                String[] tokens = line.split(",");

                if (tokens.length >= 8) {
                    list.add(new WoodEmbedmentDto(
                            tokens[0].trim(),
                            tokens[1].trim(),
                            tokens[2].trim(),
                            tokens[3].trim(),
                            tokens[4].trim(),
                            tokens[5].trim(),
                            tokens[6].trim(),
                            tokens[7].trim()
                    ));
                }
            }
            br.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        model.addAttribute("woodList", list);
        return "index";
    }

    // 2. 예측 계산기 전용 페이지 이동 (GET)
    @GetMapping("/calculator")
    public String showCalculator() {
        return "calculator";
    }

    // 3. 지압강도 및 5톤 UTM 실험 가능 여부 계산 처리 (POST)
    @PostMapping("/calculator")
    public String calculate(@RequestParam("density") double density,
                            @RequestParam("diameter") double diameter,
                            @RequestParam(value = "thickness", required = false) Double thickness,
                            Model model) {

        // ① Eurocode 5 기준 지압강도 (MPa)
        double fhEc5 = 0.082 * (1 - 0.01 * diameter) * density;

        // ② NDS 기준 지압강도 (MPa) - 전건비중 G = density / 1000
        double specGravity = density / 1000.0;
        double fhNds = 77.2 * specGravity;

        // ③ 두 기준의 평균 지압강도 (MPa)
        double fhAvg = (fhEc5 + fhNds) / 2.0;

        Map<String, Object> result = new HashMap<>();
        // 입력 조건도 결과 카드에 표기하기 위해 포함
        result.put("density", density);
        result.put("diameter", diameter);
        result.put("thickness", thickness);

        result.put("fhEc5", Math.round(fhEc5 * 100.0) / 100.0);
        result.put("fhNds", Math.round(fhNds * 100.0) / 100.0);
        result.put("fhAvg", Math.round(fhAvg * 100.0) / 100.0);

        // ④ thickness 값이 전달된 경우에만 (UTM 모드) 하중 및 실험 가능 여부 계산
        if (thickness != null && thickness > 0) {
            double maxLoadKn = (fhAvg * diameter * thickness) / 1000.0;
            boolean isPossible = maxLoadKn <= 50.0;

            result.put("maxLoadKn", Math.round(maxLoadKn * 100.0) / 100.0);
            result.put("isPossible", isPossible);
        } else {
            result.put("maxLoadKn", null);
            result.put("isPossible", null);
        }

        model.addAttribute("result", result);
        return "calculator";
    }
}