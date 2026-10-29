package menu.datat.service;

import menu.datat.controller.WoodController;
import menu.datat.dto.WoodEmbedmentDto;
import org.junit.jupiter.api.Test;
import org.springframework.ui.ExtendedModelMap;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class LiteratureExplorerTests {
    @Test
    @SuppressWarnings("unchecked")
    void explorerUsesAllVerifiedTrialsAndKeepsSetupDefinitionsAndOriginalValues() {
        var controller = new WoodController(new LiteratureComparisonService(), new EmbedmentPredictionService(), new LiteratureDatasetService("exports/literature_strength_long.csv"));
        var model = new ExtendedModelMap();
        assertEquals("explorer", controller.exploreLiterature(model));
        var data = (Map<String, Object>) model.get("explorerData");
        var points = (List<LiteratureComparisonService.MeasuredPoint>) data.get("points");
        assertEquals(45, data.get("trialCount"));
        assertEquals(87, data.get("pointCount"));
        assertEquals(5L, data.get("sourceCount"));
        assertEquals(25, data.get("excludedCount"));
        assertEquals(45, points.stream().map(LiteratureComparisonService.MeasuredPoint::cardId).distinct().count());
        assertEquals(41, points.stream().filter(p -> p.direction().equals("PARALLEL")).count());
        assertEquals(8, points.stream().filter(p -> p.category().contains("활엽수")).count());
        assertEquals(18, points.stream().filter(p -> p.testSetup().equals("FULL_HOLE")).count());
        assertEquals(69, points.stream().filter(p -> p.testSetup().equals("HALF_HOLE")).count());
        assertTrue(points.stream().filter(p -> p.sourceId().equals("paper-9"))
                .allMatch(p -> p.strengthBasis().equals("EN383_MAX_5MM") && p.testSetup().equals("FULL_HOLE")));
        assertTrue(points.stream().filter(p -> p.sourceId().equals("paper-30"))
                .allMatch(p -> p.strengthBasis().equals("OFFSET_5_PERCENT") && p.testSetup().equals("FULL_HOLE")));
        assertTrue(points.stream().filter(p -> p.sourceId().equals("paper-34") || p.sourceId().equals("paper-72"))
                .allMatch(p -> p.density() == null && p.testSetup().equals("HALF_HOLE")));
        assertEquals(15, points.stream().filter(p -> p.direction().equals("R")).count());
        assertEquals(15, points.stream().filter(p -> p.direction().equals("T")).count());
        assertTrue(points.stream().anyMatch(p -> p.sourceId().equals("paper-34") && p.x() == 12.2 && p.y() == 34.23));
        assertTrue(points.stream().allMatch(p -> p.x() > 0 && p.y() > 0 && !p.sourceLocation().isBlank()
                && !p.testConditions().isBlank() && p.sourceUrl().startsWith("https://doi.org/")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void unverifiedLegacyRowsRemainUnknownAndNeverBecomeMeasuredPoints() {
        var controller = new WoodController(new LiteratureComparisonService(), new EmbedmentPredictionService(), new LiteratureDatasetService("exports/literature_strength_long.csv"));
        var model = new ExtendedModelMap();
        controller.getWoodDataList(model);
        var rows = (List<WoodEmbedmentDto>) model.get("woodList");
        assertEquals(70, rows.size());
        assertEquals(25, rows.stream().filter(r -> r.getTestSetup().equals("UNKNOWN") && r.getStrengthBasis().equals("UNKNOWN")).count());
        assertEquals("시험 형상 미확인", rows.getFirst().getTestSetupLabel());
    }
}
