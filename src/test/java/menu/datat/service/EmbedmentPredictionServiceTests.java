package menu.datat.service;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static menu.datat.service.EmbedmentPredictionService.FastenerType.*;

class EmbedmentPredictionServiceTests {
    private final EmbedmentPredictionService service = new EmbedmentPredictionService();

    @Test
    void screwShowsThreeStandardsAndKeepsLiteratureModelSeparate() {
        var values = service.predict(560, 12, "SOFTWOOD", SCREW);
        assertEquals(List.of("ec5", "nds", "kds"), values.stream().map(EmbedmentPredictionService.Value::id).toList());
        assertEquals(40.41, values.getFirst().parallel());
        assertEquals(26.41, values.getFirst().perpendicular());
        assertEquals(43.23, values.get(1).parallel());
        assertEquals(44.24, values.get(2).parallel());
        assertTrue(values.getFirst().sourceNote().contains("§8.7.1"));
        assertTrue(values.get(1).sourceNote().contains("§12.3.7"));
        assertTrue(values.get(2).sourceNote().contains("§4.7.3.1"));
        assertTrue(values.getFirst().sourceUrl().contains("hope-erasmusproject.eu"));
        var literature = service.screwLiteraturePrediction(560, 12);
        assertEquals(23.05, literature.parallel());
        assertEquals(literature.parallel(), literature.perpendicular());
        assertTrue(literature.commonDirection());
        assertEquals("https://doi.org/10.3390/f13081154", literature.sourceUrl());
    }

    @Test
    void ec5ScrewRoutesAtSixMillimetresAndNdsAtSixPointThreeFive() {
        var small = service.predict(560, 6, "SOFTWOOD", SCREW);
        assertEquals(43.16, small.getFirst().parallel());
        assertEquals(small.getFirst().parallel(), small.getFirst().perpendicular());
        assertNotEquals(small.getFirst().perpendicular(), service.predict(560, 6, "SOFTWOOD", DOWEL).getFirst().perpendicular());
        var aboveSix = service.predict(560, 6.01, "SOFTWOOD", SCREW);
        assertNotEquals(aboveSix.getFirst().parallel(), aboveSix.getFirst().perpendicular());
        assertEquals(aboveSix.get(1).parallel(), aboveSix.get(1).perpendicular());
        var atNdsBoundary = service.predict(560, 6.35, "SOFTWOOD", SCREW).get(1);
        assertNotEquals(atNdsBoundary.parallel(), atNdsBoundary.perpendicular());
    }

    @Test
    void dowelKeepsDistinctDirectionsAndCorrectsKdsCoefficients() {
        var values = service.predict(560, 12, "SOFTWOOD", DOWEL);
        assertEquals(3, values.size());
        assertEquals(40.41, values.get(0).parallel());
        assertEquals(26.41, values.get(0).perpendicular());
        assertEquals(43.23, values.get(1).parallel());
        assertEquals(26.4, values.get(1).perpendicular());
        assertEquals(44.24, values.get(2).parallel());
        assertEquals(26.9, values.get(2).perpendicular());
        assertEquals(37.42, service.predict(560, 12, "HARDWOOD", DOWEL).getFirst().perpendicular());
    }

    @Test
    void ndsSmallDiameterBranchIsNotTheLargeDiameterFormula() {
        var small = service.predict(560, 6, "SOFTWOOD", DOWEL).get(1);
        assertEquals(small.parallel(), small.perpendicular());
        assertNotEquals(43.23, small.parallel());
        var large = service.predict(560, 6.35, "SOFTWOOD", DOWEL).get(1);
        assertEquals(43.23, large.parallel());
        assertNotEquals(large.parallel(), large.perpendicular());
    }

    @Test
    @SuppressWarnings("unchecked")
    void graphAndCardsUseExactlyTheSameNumbersIncludingDecimalDiameters() {
        for (var type : List.of(SCREW, DOWEL)) {
            var graph = service.chartData(560, 12.5, "SOFTWOOD", type);
            assertEquals(false, graph.get("commonDirection"));
            var models = (List<Map<String,Object>>) graph.get("models");
            var cards = service.predict(560, 12.5, "SOFTWOOD", type);
            assertEquals(cards.size(), models.size());
            for (int i = 0; i < cards.size(); i++) {
                for (String direction : List.of("parallel", "perpendicular")) {
                    var points = (List<Map<String,Double>>) models.get(i).get(direction);
                    double selected = points.stream().filter(p -> p.get("x") == 12.5).findFirst().orElseThrow().get("y");
                    assertEquals(direction.equals("parallel") ? cards.get(i).parallel() : cards.get(i).perpendicular(), selected);
                }
            }
        }
        assertThrows(IllegalArgumentException.class, () -> service.predict(560, 31, "SOFTWOOD", DOWEL));
    }
}
