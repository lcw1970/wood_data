package menu.datat.service;

import menu.datat.dto.WoodEmbedmentDto;
import menu.datat.service.EmbedmentPredictionService.FastenerType;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service
public class LiteratureComparisonService {
    // Retrieval tolerances only: these do not express statistical confidence or strength accuracy.
    public static final double DENSITY_TOLERANCE_PERCENT = 10.0;
    public static final double DIAMETER_TOLERANCE_MM = 1.0;

    public record Candidate(WoodEmbedmentDto wood, Double density, double diameter,
                            Double densityDifference, Double densityDifferencePercent,
                            double diameterDifference, boolean close, String conditionLabel) {
        public String cardId() {
            if (wood.getTestGroupId() != null && !wood.getTestGroupId().isBlank()) return "trial-" + wood.getTestGroupId();
            return "paper-" + Integer.toUnsignedString(Objects.hash(wood.getSourceId(), wood.getScientificName(),
                    wood.getSourceLocation(), wood.getTestConditions(), wood.getDensityRange(), wood.getScrewRange()), 36);
        }
    }

    public record MeasuredPoint(double x, double y, String scientificName, Double density, boolean close,
                                String conditionLabel, String measurement, String standard, String sourceTitle,
                                String sourceLocation, String sourceUrl, String cardId, String sourceId,
                                String category, String fastenerType, String testSetup, String testSetupLabel,
                                String strengthBasis, String strengthBasisLabel, String testConditions, String direction) { }

    public record Comparison(List<Candidate> closeMatches, List<Candidate> references,
                             int sameMaterialCount) { }

    public Map<String, Object> explorerData(List<WoodEmbedmentDto> rows) {
        var trials = rows.stream().filter(this::hasVerifiedSource)
                .filter(row -> scalar(row.getScrewRange()) != null)
                .map(row -> new Candidate(row, scalar(row.getDensityRange()), scalar(row.getScrewRange()),
                        null, null, 0, false, "논문 원문 실측값"))
                .toList();
        var values = chartPoints(new Comparison(trials, List.of(), trials.size()));
        var points = Stream.concat(values.get("parallel").stream(), values.get("perpendicular").stream()).toList();
        return Map.of("points", points, "trialCount", trials.size(), "pointCount", points.size(),
                "sourceCount", trials.stream().map(c -> c.wood().getSourceId()).distinct().count(),
                "excludedCount", rows.size() - trials.size());
    }

    /** Plot only the trials also displayed as cards, at their original diameter and reported strength. */
    public Map<String, List<MeasuredPoint>> chartPoints(Comparison comparison) {
        List<MeasuredPoint> parallel = new ArrayList<>();
        List<MeasuredPoint> perpendicular = new ArrayList<>();
        Stream.concat(comparison.closeMatches().stream(), comparison.references().stream()).forEach(c -> {
            Double value = scalar(c.wood().getParallelStrength());
            if (value != null) parallel.add(point(c, value, "섬유 평행"));
            value = scalar(c.wood().getPerpStrength());
            if (value != null) {
                perpendicular.add(point(c, value, "섬유 직각"));
            } else {
                // R/T are separately measured directions; never average them or parse ranges as points.
                var matcher = Pattern.compile("(?:^|;\\s*)(R|T)\\s+([0-9]+(?:\\.[0-9]+)?)(?=;|$)")
                        .matcher(c.wood().getPerpStrength().trim());
                while (matcher.find()) {
                    Double measured = scalar(matcher.group(2));
                    if (measured != null) perpendicular.add(point(c, measured,
                            matcher.group(1).equals("R") ? "섬유 직각 · R(방사)" : "섬유 직각 · T(접선)"));
                }
            }
        });
        return Map.of("parallel", List.copyOf(parallel), "perpendicular", List.copyOf(perpendicular));
    }

    private MeasuredPoint point(Candidate c, double value, String measurement) {
        var wood = c.wood();
        return new MeasuredPoint(c.diameter(), value, wood.getScientificName(), c.density(), c.close(),
                c.conditionLabel(), measurement, wood.getStandard(), wood.getSourceTitle(),
                wood.getSourceLocation(), wood.getPaperUrl(), c.cardId(), wood.getSourceId(), wood.getCategory(),
                wood.getFastenerType(), wood.getTestSetup(), wood.getTestSetupLabel(), wood.getStrengthBasis(),
                wood.getStrengthBasisLabel(), wood.getTestConditions(), measurement.contains("평행") ? "PARALLEL"
                : measurement.contains("R(") ? "R" : measurement.contains("T(") ? "T" : "PERPENDICULAR");
    }

    public Comparison compare(List<WoodEmbedmentDto> rows, double density, double diameter, String woodType, FastenerType type) {
        List<WoodEmbedmentDto> materialRows = rows.stream()
                .filter(this::hasVerifiedSource)
                .filter(row -> type.name().equals(row.getFastenerType()))
                .filter(row -> sameMaterial(row.getCategory(), woodType))
                .toList();
        Comparator<Candidate> order = Comparator
                .comparingDouble((Candidate c) -> c.densityDifferencePercent() == null
                        ? Double.POSITIVE_INFINITY : c.densityDifferencePercent())
                .thenComparingDouble(Candidate::diameterDifference)
                .thenComparing(c -> c.wood().getScientificName())
                .thenComparing(c -> c.wood().getSourceLocation())
                .thenComparing(c -> c.wood().getTestConditions());

        List<Candidate> candidates = materialRows.stream()
                .map(row -> candidate(row, density, diameter))
                .filter(c -> c != null && c.diameterDifference() <= DIAMETER_TOLERANCE_MM + 1e-9)
                .sorted(order)
                .toList();
        return new Comparison(
                candidates.stream().filter(Candidate::close).limit(8).toList(),
                candidates.stream().filter(c -> !c.close()).limit(4).toList(),
                materialRows.size());
    }

    private boolean hasVerifiedSource(WoodEmbedmentDto row) {
        return !row.getSourceId().isBlank()
                && !row.getSourceTitle().isBlank() && !row.getSourceLocation().isBlank()
                && !row.getTestConditions().isBlank() && LiteratureDatasetService.validSourceUrl(row.getPaperUrl());
    }

    private boolean sameMaterial(String category, String woodType) {
        boolean clt = category.contains("직교") || category.contains("CLT");
        boolean glulam = !clt && (category.contains("집성재") || category.contains("GLT") || category.contains("Glulam"));
        return switch (woodType) {
            case "CLT" -> clt;
            case "GLT", "GLULAM" -> glulam;
            case "SOFTWOOD" -> !clt && !glulam && category.contains("침엽수");
            case "HARDWOOD" -> !clt && !glulam && category.contains("활엽수");
            default -> false;
        };
    }

    private Candidate candidate(WoodEmbedmentDto row, double inputDensity, double inputDiameter) {
        // Only single measured/nominal values qualify; never turn a range or a label into a number.
        Double actualDiameter = scalar(row.getScrewRange());
        if (actualDiameter == null) return null;
        Double actualDensity = scalar(row.getDensityRange());
        double diameterDifference = Math.abs(actualDiameter - inputDiameter);
        Double densityDifference = actualDensity == null ? null : Math.abs(actualDensity - inputDensity);
        Double percent = densityDifference == null ? null : densityDifference / inputDensity * 100.0;
        boolean close = percent != null && percent <= DENSITY_TOLERANCE_PERCENT + 1e-9
                && diameterDifference <= DIAMETER_TOLERANCE_MM + 1e-9;
        String label = actualDensity == null ? "직경 유사 · 밀도 미기재"
                : close ? "밀도·직경 근접" : "직경 유사 · 밀도 조건 다름";
        if (close && densityDifference < 1e-9 && diameterDifference < 1e-9) label = "밀도·직경 수치 일치";
        return new Candidate(row, actualDensity, actualDiameter, densityDifference, percent,
                diameterDifference, close, label);
    }

    private Double scalar(String text) {
        if (text == null || !text.trim().matches("[0-9]+(?:\\.[0-9]+)?")) return null;
        double value = Double.parseDouble(text.trim());
        return Double.isFinite(value) && value > 0 ? value : null;
    }
}
