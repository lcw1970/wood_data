package menu.datat.service;

import menu.datat.controller.WoodController;
import menu.datat.service.EmbedmentPredictionService.FastenerType;
import menu.datat.dto.WoodEmbedmentDto;
import org.junit.jupiter.api.Test;
import org.springframework.ui.ExtendedModelMap;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LiteratureComparisonServiceTests {
    private final LiteratureComparisonService service = new LiteratureComparisonService();

    @Test
    @SuppressWarnings("unchecked")
    void realChartPointsKeepMissingDensityAndSeparateRadialTangentialMeasurements() {
        var controller = new WoodController(service, new EmbedmentPredictionService(), new LiteratureDatasetService("exports/literature_strength_long.csv"));
        var model = new ExtendedModelMap();
        controller.calculate(560, 12, null, "SOFTWOOD", "STRENGTH", FastenerType.SCREW, model);
        var chart = (Map<String, Object>) model.get("chartData");
        var points = (Map<String, List<LiteratureComparisonService.MeasuredPoint>>) chart.get("measurements");
        assertEquals(List.of(24.1, 30.66, 26.3), points.get("parallel").stream().map(LiteratureComparisonService.MeasuredPoint::y).toList());
        assertEquals(List.of(9.6, 10.7, 12.4, 13.9, 11.5, 10.8), points.get("perpendicular").stream().map(LiteratureComparisonService.MeasuredPoint::y).toList());
        assertTrue(points.get("parallel").stream().allMatch(p -> p.x() == 12 && p.density() == null && !p.close()));
        var cards = (List<LiteratureComparisonService.Candidate>) model.get("referencePapers");
        assertTrue(points.get("perpendicular").stream().allMatch(p -> cards.stream().anyMatch(c -> c.cardId().equals(p.cardId()))));
        assertTrue(points.get("perpendicular").stream().anyMatch(p -> p.measurement().contains("R(방사)")));
        assertTrue(points.get("perpendicular").stream().anyMatch(p -> p.measurement().contains("T(접선)")));

        var glulam = new ExtendedModelMap();
        controller.calculate(466, 12, null, "GLT", "STRENGTH", FastenerType.DOWEL, glulam);
        chart = (Map<String, Object>) glulam.get("chartData");
        points = (Map<String, List<LiteratureComparisonService.MeasuredPoint>>) chart.get("measurements");
        assertEquals(4, points.get("parallel").size());
        assertEquals(List.of(21.8), points.get("perpendicular").stream().map(LiteratureComparisonService.MeasuredPoint::y).toList());
        assertTrue(points.get("parallel").stream().allMatch(p -> p.close() && Math.abs(p.density() - 466) / 466 <= 0.1));
        assertEquals(4, points.get("parallel").stream().map(LiteratureComparisonService.MeasuredPoint::cardId).distinct().count());
    }

    @Test
    void rangesAndMissingStrengthsNeverTurnIntoGraphMeasurements() {
        var unknown = row("침엽수", "560", "12", "paper-34");
        unknown.setParallelStrength("35 - 40");
        unknown.setPerpStrength("-");
        var points = service.chartPoints(service.compare(List.of(unknown), 560, 12, "SOFTWOOD", FastenerType.DOWEL));
        assertTrue(points.get("parallel").isEmpty());
        assertTrue(points.get("perpendicular").isEmpty());
    }

    private WoodEmbedmentDto row(String category, String density, String diameter, String source) {
        return new WoodEmbedmentDto("Test species", category, density, diameter, "35.9", "21.8",
                "ASTM D5764", "https://doi.org/example", source, "Test paper", "Table 3", source.equals("paper-72") ? "SCREW" : "DOWEL", "평균 항복값");
    }

    @Test
    void missingDensityIsOnlyAReferenceAndNeverSilentlyConvertedFromSpecificGravity() {
        var row = row("침엽수", "-", "12", "paper-72");
        row.setTestConditions("비중 G=0.51; 밀도 미기재");
        var result = service.compare(List.of(row), 510, 12, "SOFTWOOD", FastenerType.SCREW);
        assertTrue(result.closeMatches().isEmpty());
        assertEquals(1, result.references().size());
        assertNull(result.references().getFirst().density());
        assertNull(result.references().getFirst().densityDifferencePercent());
    }

    @Test
    void materialFormAndVerifiedProvenanceAreRequired() {
        var result = service.compare(List.of(
                row("침엽수 집성재", "560", "12", "paper-30"),
                row("활엽수", "560", "12", "paper-9"),
                row("침엽수", "560", "12", "")), 560, 12, "SOFTWOOD", FastenerType.DOWEL);
        assertTrue(result.closeMatches().isEmpty());
        assertTrue(result.references().isEmpty());
        assertEquals(0, result.sameMaterialCount());
    }

    @Test
    void bothDensityAndDiameterMustPassWithoutRoundingIntoTheTolerance() {
        var result = service.compare(List.of(
                row("침엽수", "504", "13", "paper-34"), // exactly 10% and 1 mm
                row("침엽수", "503.99", "12", "paper-34"),
                row("침엽수", "560", "13.001", "paper-34")), 560, 12, "SOFTWOOD", FastenerType.DOWEL);
        assertEquals(1, result.closeMatches().size());
        assertEquals(504.0, result.closeMatches().getFirst().density());
        assertEquals(1, result.references().size());
        assertEquals(503.99, result.references().getFirst().density());
    }

    @Test
    void rangesDoNotBecomeFabricatedSingleMeasurements() {
        var result = service.compare(List.of(row("침엽수", "500 - 600", "8 - 16", "paper-34")), 560, 12, "SOFTWOOD", FastenerType.DOWEL);
        assertTrue(result.closeMatches().isEmpty());
        assertTrue(result.references().isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void realDatasetShowsNoFalse560SoftwoodMeasurementAndFinds466GlulamExperiments() {
        var controller = new WoodController(service, new EmbedmentPredictionService(), new LiteratureDatasetService("exports/literature_strength_long.csv"));
        var model = new ExtendedModelMap();
        controller.getWoodDataList(model);
        var rows = (List<WoodEmbedmentDto>) model.get("woodList");
        var softwood = service.compare(rows, 560, 12, "SOFTWOOD", FastenerType.SCREW);
        assertTrue(softwood.closeMatches().isEmpty());
        assertFalse(softwood.references().isEmpty());
        assertTrue(softwood.references().stream().allMatch(c -> c.density() == null));
        var glulam = service.compare(rows, 466, 12, "GLT", FastenerType.DOWEL);
        assertEquals(4, glulam.closeMatches().size());
        assertEquals(3, glulam.closeMatches().stream().filter(c -> c.wood().getSourceId().equals("paper-30")).count());
        assertTrue(glulam.closeMatches().stream().anyMatch(c -> c.wood().getSourceId().equals("paper-146") && c.wood().getParallelStrength().equals("39.72")));
        assertTrue(glulam.closeMatches().stream().anyMatch(c -> c.wood().getParallelStrength().equals("35.9")
                && c.wood().getPerpStrength().equals("21.8")));
        assertTrue(service.compare(rows, 466, 12, "CLT", FastenerType.DOWEL).closeMatches().isEmpty());
    }

    @Test
    void calculatorRetainsSubmittedConditionsAndRejectsNonFiniteOrOutOfDomainInputs() {
        var controller = new WoodController(service, new EmbedmentPredictionService(), new LiteratureDatasetService("exports/literature_strength_long.csv"));
        var valid = new ExtendedModelMap();
        assertEquals("calculator", controller.calculate(560, 12.5, null, "SOFTWOOD", "STRENGTH", FastenerType.SCREW, valid));
        assertEquals(560.0, valid.get("inputDensity"));
        assertEquals(12.5, valid.get("inputDiameter"));
        assertNotNull(valid.get("result"));
        for (double d : new double[]{0, -12, 100, Double.NaN, Double.POSITIVE_INFINITY}) {
            var invalid = new ExtendedModelMap();
            controller.calculate(560, d, null, "SOFTWOOD", "STRENGTH", FastenerType.SCREW, invalid);
            assertNotNull(invalid.get("inputError"));
            assertFalse(invalid.containsKey("result"));
        }
    }
    @Test
    @SuppressWarnings("unchecked")
    void screwAndDowelPapersNeverMix() {
        var controller = new WoodController(service, new EmbedmentPredictionService(), new LiteratureDatasetService("exports/literature_strength_long.csv"));
        var model = new ExtendedModelMap();
        controller.getWoodDataList(model);
        var rows = (List<WoodEmbedmentDto>) model.get("woodList");
        for (FastenerType type : FastenerType.values()) {
            var result = service.compare(rows, 560, 12, "SOFTWOOD", type);
            assertTrue(result.closeMatches().stream().allMatch(c -> c.wood().getFastenerType().equals(type.name())));
            assertTrue(result.references().stream().allMatch(c -> c.wood().getFastenerType().equals(type.name())));
        }
        assertTrue(service.compare(rows, 466, 12, "GLT", FastenerType.SCREW).closeMatches().isEmpty());
        assertEquals(4, service.compare(rows, 466, 12, "GLT", FastenerType.DOWEL).closeMatches().size());
    }

}
