package menu.datat.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class LiteratureDatasetServiceTests {
    @TempDir Path temporary;

    private Map<String, String> observation() throws IOException {
        try (var reader = Files.newBufferedReader(Path.of("exports/literature_strength_long.csv"), StandardCharsets.UTF_8)) {
            return new LinkedHashMap<>(CsvTable.read(reader).getFirst());
        }
    }

    @SafeVarargs
    private final String csv(Map<String, String>... rows) {
        var columns = rows[0].keySet();
        StringBuilder result = new StringBuilder("\ufeff" + String.join(",", columns) + "\r\n");
        for (var row : rows) result.append(String.join(",", columns.stream()
                .map(c -> "\"" + row.get(c).replace("\"", "\"\"") + "\"").toList())).append("\r\n");
        return result.toString();
    }

    @Test
    void newPaperNeedsNoJavaWhitelistAndExternalEditsAppearOnNextRead() throws IOException {
        var first = observation();
        first.put("study_id", "paper-new"); first.put("test_group_id", "condition-1");
        first.put("observation_id", "new-observation-1");
        first.put("source_title", "A new paper, with \"quoted\" title");
        first.put("test_notes", "Reviewed table\nTwo lines of notes");
        var file = temporary.resolve("master.csv");
        Files.writeString(file, csv(first));
        var service = new LiteratureDatasetService(file.toString());
        assertEquals(26, service.readAll().size());
        var row = service.readAll().getLast();
        assertEquals("paper-new", row.getSourceId());
        assertEquals(first.get("source_title"), row.getSourceTitle());
        assertEquals(first.get("test_notes"), row.getTestConditions());
        var second = new LinkedHashMap<>(first);
        second.put("observation_id", "new-observation-2"); second.put("test_group_id", "condition-2");
        Files.writeString(file, csv(first, second));
        assertEquals(27, service.readAll().size());
        assertArrayEquals(Files.readAllBytes(file), service.download());
    }

    @Test
    void duplicateIdsAmbiguousGroupsInvalidMeasurementsAndStatisticsCannotSilentlyEnterGraphs() throws IOException {
        var first = observation();
        assertThrows(IOException.class, () -> LiteratureDatasetService.parseMaster(new StringReader(csv(first, first))));
        for (var entry : Map.of("strength_mpa", "NaN", "density_kg_m3", "0", "value_statistic", "CHARACTERISTIC",
                "observation_level", "SPECIMEN", "source_url", "https://doi.org.evil.example/id",
                "grain_angle_deg", "45", "n_specimens", "6", "specific_gravity", "NaN").entrySet()) {
            var invalid = new LinkedHashMap<>(first); invalid.put(entry.getKey(), entry.getValue());
            assertThrows(IOException.class, () -> LiteratureDatasetService.parseMaster(new StringReader(csv(invalid))), entry.getKey());
        }
        var second = new LinkedHashMap<>(first);
        second.put("observation_id", "different-id"); second.put("load_direction", "PERPENDICULAR");
        second.put("grain_angle_deg", "90"); second.put("diameter_mm", "17");
        assertThrows(IOException.class, () -> LiteratureDatasetService.parseMaster(new StringReader(csv(first, second))));
        assertThrows(IOException.class, () -> CsvTable.read(new StringReader("a,b\n\"unclosed,b")));
        assertThrows(IOException.class, () -> new LiteratureDatasetService(temporary.resolve("missing.csv").toString()).download());
    }

    @Test
    void aSingleRadialDirectionStaysOneMeasuredPointAndItsStableTrialIdSurvivesNotesChanges() throws IOException {
        var row = observation();
        row.put("load_direction", "RADIAL"); row.put("grain_angle_deg", "90");
        var parsed = LiteratureDatasetService.parseMaster(new StringReader(csv(row)));
        var service = new LiteratureComparisonService();
        var data = service.explorerData(parsed);
        assertEquals(1, data.get("pointCount"));
        var candidate = new LiteratureComparisonService.Candidate(parsed.getFirst(), null, 9, null, null, 0, false, "");
        String id = candidate.cardId(); parsed.getFirst().setTestConditions("Updated notes");
        assertEquals(id, candidate.cardId());
        var points = service.chartPoints(new LiteratureComparisonService.Comparison(List.of(candidate), List.of(), 1));
        assertEquals("R", points.get("perpendicular").getFirst().direction());
        assertTrue(points.get("parallel").isEmpty());
    }

    @Test
    void newlyReviewedPaperKeepsItsOriginalDowelValuesAndOnlyFourIndependentGroups() throws IOException {
        var data = CsvTable.read(Files.newBufferedReader(Path.of("exports/literature_strength_long.csv")));
        var added = data.stream().filter(r -> r.get("study_id").equals("paper-146")).toList();
        assertEquals(List.of("44.11", "39.72", "26.15", "29.52"), added.stream().map(r -> r.get("strength_mpa")).toList());
        assertEquals(23, added.stream().mapToInt(r -> Integer.parseInt(r.get("n_specimens"))).sum());
        assertTrue(added.stream().allMatch(r -> r.get("fastener_type").equals("DOWEL") && r.get("test_setup").equals("HALF_HOLE")));
    }

    @Test
    @SuppressWarnings("unchecked")
    void reportedGravityReachesCardsAndEveryChartPointWithoutBecomingDensity() {
        var rows = new LiteratureDatasetService("src/test/resources/literature_baseline_87.csv").readAll();
        var expected = Map.of("Cryptomeria japonica (STS 12T)", 0.36,
                "Larix kaempferi (STS 12T)", 0.51, "Pinus koraiensis (STS 12T)", 0.45);
        var cards = new LiteratureComparisonService().compare(rows, 560, 12, "SOFTWOOD",
                EmbedmentPredictionService.FastenerType.SCREW);
        assertEquals(3, cards.references().size());
        for (var card : cards.references()) {
            assertEquals(expected.get(card.wood().getScientificName()), card.wood().getSpecificGravity());
            assertEquals("직경 유사 · 비중 기재", card.conditionLabel());
            assertNull(card.density());
            assertFalse(card.close());
        }
        var data = new LiteratureComparisonService().explorerData(rows);
        var points = (List<LiteratureComparisonService.MeasuredPoint>) data.get("points");
        assertEquals(87, points.size());
        assertEquals(65, points.stream().filter(p -> p.specificGravity() != null && p.density() == null).count());
        assertEquals(22, points.stream().filter(p -> p.density() != null).count());
        for (var point : points) {
            if (expected.containsKey(point.scientificName()))
                assertEquals(expected.get(point.scientificName()), point.specificGravity());
        }
    }
}
