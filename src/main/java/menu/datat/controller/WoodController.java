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
import java.util.*;
import java.util.stream.Collectors;

@Controller
public class WoodController {

    @GetMapping("/")
    public String getWoodDataList(Model model) {
        List<WoodEmbedmentDto> list = new ArrayList<>();
        try {
            ClassPathResource resource = new ClassPathResource("wood_data.csv");
            BufferedReader br = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8));
            String line;
            boolean isHeader = true;
            while ((line = br.readLine()) != null) {
                if (isHeader) { isHeader = false; continue; }
                String[] tokens = line.split(",", -1);
                if (tokens.length >= 8) {
                    list.add(new WoodEmbedmentDto(
                            safe(tokens,0),
                            safe(tokens,1),
                            safe(tokens,2),
                            safe(tokens,3),
                            safe(tokens,4),
                            safe(tokens,5),
                            safe(tokens,6),
                            safe(tokens,7)
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

    @GetMapping("/calculator")
    public String showCalculator() {
        return "calculator";
    }

    @PostMapping("/calculator")
    public String calculate(@RequestParam("density") double density,
                            @RequestParam("diameter") double diameter,
                            @RequestParam(value = "thickness", required = false) Double thickness,
                            @RequestParam(value = "woodType", defaultValue = "SOFTWOOD") String woodType,
                            @RequestParam(value = "calcMode", defaultValue = "STRENGTH") String calcMode,
                            Model model) {

        // 1. 지압강도 계산 - 섬유 평행방향 (α = 0°)
        double fhEc5_0 = 0.082 * (1 - 0.01 * diameter) * density;
        double fhNds_0 = 77.2 * (density / 1000.0);
        double fhAvg_0 = (fhEc5_0 + fhNds_0) / 2.0;

        // 1-2. 지압강도 계산 - 섬유 직각방향 (α = 90°, k90 보정 적용)
        double k90 = 1.35 + 0.015 * diameter;
        double fhEc5_90 = fhEc5_0 / k90;
        double fhNds_90 = fhNds_0 / k90;
        double fhAvg_90 = (fhEc5_90 + fhNds_90) / 2.0;

        // 2. 목재 압축강도 추정 계산 (fc,0 & fc,90)
        double fc0 = 0.05 * density;
        double fc90 = 0.005 * density;
        if ("HARDWOOD".equals(woodType)) {
            fc0 *= 1.15;
            fc90 *= 1.30;
        } else if ("CLT".equals(woodType) || "GLULAM".equals(woodType) || "GLT".equals(woodType)) {
            fc0 *= 1.05;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("density", Math.round(density * 100.0) / 100.0);
        result.put("diameter", Math.round(diameter * 100.0) / 100.0);
        result.put("thickness", thickness);
        result.put("woodType", woodType);

        // 평행방향 지압강도 (f_h,0)
        result.put("fhEc5_0", Math.round(fhEc5_0 * 100.0) / 100.0);
        result.put("fhNds_0", Math.round(fhNds_0 * 100.0) / 100.0);
        result.put("fhAvg_0", Math.round(fhAvg_0 * 100.0) / 100.0);

        // 직각방향 지압강도 (f_h,90)
        result.put("fhEc5_90", Math.round(fhEc5_90 * 100.0) / 100.0);
        result.put("fhNds_90", Math.round(fhNds_90 * 100.0) / 100.0);
        result.put("fhAvg_90", Math.round(fhAvg_90 * 100.0) / 100.0);

        // 기존 변수명 호환용 (기본 평행값)
        result.put("fhEc5", Math.round(fhEc5_0 * 100.0) / 100.0);
        result.put("fhNds", Math.round(fhNds_0 * 100.0) / 100.0);
        result.put("fhAvg", Math.round(fhAvg_0 * 100.0) / 100.0);

        // 압축강도 (f_c)
        result.put("fc0", Math.round(fc0 * 100.0) / 100.0);
        result.put("fc90", Math.round(fc90 * 100.0) / 100.0);

        // 3. 시편 두께 전달 시 UTM 하중 계산 (fhAvg_0 평행방향 강도 기준 적용)
        if (thickness != null && thickness > 0) {
            double maxLoadKn = (fhAvg_0 * diameter * thickness) / 1000.0;
            result.put("maxLoadKn", Math.round(maxLoadKn * 100.0) / 100.0);
            result.put("isPossible", maxLoadKn <= 50.0);
        } else {
            result.put("maxLoadKn", null);
            result.put("isPossible", null);
        }

        model.addAttribute("result", result);

        // 유사도 계산 설정 (목재종류, 밀도, 파스너)
        final double W_WOODTYPE = 0.5;
        final double W_DENSITY = 0.35;
        final double W_DIAMETER = 0.15;
        final double MAX_DENSITY_DIFF = 400.0;
        final double MAX_DIAMETER_DIFF = 30.0;

        List<Map<String, Object>> rows = new ArrayList<>();
        try {
            ClassPathResource resource = new ClassPathResource("wood_data.csv");
            BufferedReader br = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8));
            String line;
            boolean isHeader = true;
            while ((line = br.readLine()) != null) {
                if (isHeader) { isHeader = false; continue; }
                String[] tokens = line.split(",", -1);
                if (tokens.length >= 8) {
                    String name = safe(tokens,0);
                    String category = safe(tokens,1);
                    String densityRange = safe(tokens,2);
                    String screwRange = safe(tokens,3);
                    String parallelStrength = safe(tokens,4);

                    Double midDensity = parseDensityMidpoint(densityRange);
                    Double midDiameter = parseDiameterMidpoint(screwRange);

                    Map<String,Object> r = new HashMap<>();
                    r.put("name", name);
                    r.put("category", category);
                    r.put("densityRange", densityRange);
                    r.put("screwRange", screwRange);
                    r.put("parallelStrength", parallelStrength);
                    r.put("midDensity", midDensity);
                    r.put("midDiameter", midDiameter);
                    rows.add(r);
                }
            }
            br.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        List<Map<String,Object>> scored = new ArrayList<>();
        for (Map<String,Object> r : rows) {
            Double midDens = (Double) r.get("midDensity");
            Double midDia = (Double) r.get("midDiameter");
            String rowCategory = (String) r.get("category");

            double woodTypeSim = 0.5; // 기본값
            if (rowCategory != null) {
                if ("SOFTWOOD".equals(woodType) && rowCategory.contains("침")) woodTypeSim = 1.0;
                else if ("HARDWOOD".equals(woodType) && rowCategory.contains("활")) woodTypeSim = 1.0;
                else if ("CLT".equals(woodType) || "GLULAM".equals(woodType) || "GLT".equals(woodType)) woodTypeSim = 0.8;
            }

            double densityNorm = 1.0;
            if (midDens != null) densityNorm = Math.min(1.0, Math.abs(density - midDens) / MAX_DENSITY_DIFF);

            double diameterNorm = 1.0;
            if (midDia != null) diameterNorm = Math.min(1.0, Math.abs(diameter - midDia) / MAX_DIAMETER_DIFF);

            double distance = W_WOODTYPE * (1.0 - woodTypeSim) + W_DENSITY * densityNorm + W_DIAMETER * diameterNorm;
            distance = Math.max(0.0, Math.min(1.0, distance));
            double similarityPercent = Math.round((1.0 - distance) * 10000.0) / 100.0;

            Map<String,Object> out = new HashMap<>(r);
            out.put("similarity", similarityPercent);
            scored.add(out);
        }

        List<Map<String,Object>> top = scored.stream()
                .sorted(Comparator.comparingDouble((Map<String, Object> m) -> (Double) m.get("similarity")).reversed())
                .limit(8)
                .collect(Collectors.toList());

        List<String> matchLabels = new ArrayList<>();
        List<Double> matchValues = new ArrayList<>();
        List<Map<String,Object>> matchDetails = new ArrayList<>();
        for (Map<String,Object> t : top) {
            String label = String.format("%s | %s | %s", safeObj(t.get("name")), safeObj(t.get("densityRange")), safeObj(t.get("screwRange")));
            matchLabels.add(label);
            matchValues.add((Double) t.get("similarity"));
            Map<String,Object> d = new HashMap<>();
            d.put("name", t.get("name"));
            d.put("category", t.get("category"));
            d.put("densityRange", t.get("densityRange"));
            d.put("screwRange", t.get("screwRange"));
            d.put("parallelStrength", t.get("parallelStrength"));
            d.put("similarity", t.get("similarity"));
            matchDetails.add(d);
        }

        model.addAttribute("matchLabels", matchLabels);
        model.addAttribute("matchValues", matchValues);
        model.addAttribute("matchDetails", matchDetails);

        return "calculator";
    }

    private static String safe(String[] tokens, int idx) {
        if (tokens == null || idx < 0 || idx >= tokens.length) return "";
        return tokens[idx] == null ? "" : tokens[idx].trim();
    }
    private static String safeObj(Object o) { return o==null ? "" : o.toString(); }

    private Double parseDensityMidpoint(String s) {
        if (s == null || s.isEmpty() || s.equals("-")) return null;
        try {
            if (s.contains("-")) {
                String[] parts = s.split("-");
                if (parts.length >= 2) {
                    String a = parts[0].replaceAll("[^0-9\\.]", "").trim();
                    String b = parts[1].replaceAll("[^0-9\\.]", "").trim();
                    if (!a.isEmpty() && !b.isEmpty()) return (Double.parseDouble(a) + Double.parseDouble(b)) / 2.0;
                }
            }
            String num = s.replaceAll("[^0-9\\.]", "");
            if (!num.isEmpty()) return Double.parseDouble(num);
        } catch (Exception ignored) {}
        return null;
    }

    private Double parseDiameterMidpoint(String s) {
        if (s == null || s.isEmpty() || s.equals("-")) return null;
        try {
            if (s.contains("-")) {
                String[] parts = s.split("-");
                if (parts.length >= 2) {
                    String a = parts[0].replaceAll("[^0-9\\.]", "").trim();
                    String b = parts[1].replaceAll("[^0-9\\.]", "").trim();
                    if (!a.isEmpty() && !b.isEmpty()) return (Double.parseDouble(a) + Double.parseDouble(b)) / 2.0;
                }
            }
            String num = s.replaceAll("[^0-9\\.]", "");
            if (!num.isEmpty()) return Double.parseDouble(num);
        } catch (Exception ignored) {}
        return null;
    }
}