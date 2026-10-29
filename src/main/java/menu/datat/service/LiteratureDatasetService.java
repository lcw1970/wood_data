package menu.datat.service;

import menu.datat.dto.WoodEmbedmentDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** The reviewed long-format CSV is shared by pandas, the explorer and calculator comparisons. */
@Service
public class LiteratureDatasetService {
    private final Path externalFile;
    private final boolean defaultLocation;
    private static final String DEFAULT_FILE = "exports/literature_strength_long.csv";
    private static final List<String> SHARED = List.of("study_id", "species_scientific", "wood_group",
            "product_form", "fastener_type", "diameter_mm", "diameter_basis", "effective_diameter_mm",
            "density_kg_m3", "density_status", "density_basis", "specific_gravity", "moisture_content_pct",
            "thickness_mm", "test_setup", "test_standard",
            "strength_basis", "source_title", "source_locator", "source_url", "reported_group_label", "test_notes");

    public LiteratureDatasetService(@Value("${app.literature-data:exports/literature_strength_long.csv}") String file) {
        this.externalFile = Path.of(file);
        this.defaultLocation = DEFAULT_FILE.equals(file);
    }

    public List<WoodEmbedmentDto> readAll() {
        try {
            List<WoodEmbedmentDto> result = new ArrayList<>();
            // Keep historical unreviewed entries, but replace reviewed wide rows with the master dataset.
            try (var reader = new InputStreamReader(new ClassPathResource("wood_data.csv").getInputStream(), StandardCharsets.UTF_8)) {
                for (var row : CsvTable.read(reader)) {
                    if (!row.getOrDefault("sourceId", "").isBlank()) continue;
                    result.add(new WoodEmbedmentDto(row.get("scientificName"), row.get("category"), row.get("densityRange"),
                            row.get("screwRange"), row.get("parallelStrength"), row.get("perpStrength"), row.get("standard"),
                            row.get("paperUrl"), "", "", "", "", "", "UNKNOWN", "UNKNOWN"));
                }
            }
            result.addAll(parseMaster(new StringReader(new String(masterBytes(), StandardCharsets.UTF_8))));
            return List.copyOf(result);
        } catch (IOException e) { throw new UncheckedIOException("논문 데이터를 읽을 수 없습니다.", e); }
    }

    public byte[] download() throws IOException {
        byte[] bytes = masterBytes();
        // A malformed external update must fail explicitly instead of serving a partial dataset.
        parseMaster(new StringReader(new String(bytes, StandardCharsets.UTF_8)));
        return bytes;
    }

    private byte[] masterBytes() throws IOException {
        byte[] bytes;
        if (Files.exists(externalFile)) bytes = Files.readAllBytes(externalFile);
        else if (defaultLocation) {
            try (var input = new ClassPathResource("literature_strength_long.csv").getInputStream()) { bytes = input.readAllBytes(); }
        } else throw new FileNotFoundException("설정한 논문 CSV를 찾을 수 없습니다: " + externalFile);
        return bytes;
    }

    static List<WoodEmbedmentDto> parseMaster(Reader reader) throws IOException {
        var rows = CsvTable.read(reader);
        if (rows.isEmpty()) throw new IOException("논문 데이터가 비어 있습니다.");
        Set<String> ids = new HashSet<>(), directions = new HashSet<>();
        Map<String, Map<String, String>> groups = new LinkedHashMap<>();
        for (var row : rows) {
            if (!row.keySet().containsAll(SHARED)) throw new IOException("논문 조건 열이 누락되었습니다.");
            for (var key : List.of("observation_id", "test_group_id", "study_id", "species_scientific", "source_title",
                    "source_locator", "source_url", "test_notes", "test_standard", "reported_group_label"))
                if (row.getOrDefault(key, "").isBlank()) throw new IOException("필수 논문 항목 누락: " + key);
            for (var key : List.of("observation_id", "test_group_id", "study_id"))
                if (!row.get(key).matches("[A-Za-z0-9][A-Za-z0-9_.:-]*")) throw new IOException("잘못된 논문 ID: " + key);
            if (!ids.add(row.get("observation_id"))) throw new IOException("중복 관측 ID: " + row.get("observation_id"));
            checkEnum(row, "wood_group", "SOFTWOOD", "HARDWOOD");
            checkEnum(row, "product_form", "SOLID", "GLT", "CLT");
            checkEnum(row, "fastener_type", "SCREW", "DOWEL");
            checkEnum(row, "test_setup", "FULL_HOLE", "HALF_HOLE", "UNKNOWN");
            checkEnum(row, "strength_basis", "OFFSET_5_PERCENT", "EN383_MAX_5MM", "UNKNOWN");
            checkEnum(row, "observation_level", "GROUP_SUMMARY");
            checkEnum(row, "value_statistic", "MEAN");
            checkEnum(row, "load_direction", "PARALLEL", "PERPENDICULAR", "RADIAL", "TANGENTIAL");
            number(row, "diameter_mm", false); number(row, "strength_mpa", false); number(row, "density_kg_m3", true);
            number(row, "specific_gravity", true);
            for (var field : List.of("n_specimens", "strength_sd_mpa")) {
                String value = row.getOrDefault(field, "");
                String status = row.getOrDefault(field.equals("n_specimens") ? "n_status" : "sd_status", "");
                if (!List.of("REPORTED", "NOT_EXTRACTED", "NOT_REPORTED").contains(status)
                        || value.isBlank() == status.equals("REPORTED")) throw new IOException("값과 전사 상태가 다릅니다: " + field);
                if (!value.isBlank()) {
                    try {
                        double n = Double.parseDouble(value);
                        if (!Double.isFinite(n) || n < 0 || !value.matches("[0-9]+(?:\\.[0-9]+)?")
                                || (field.equals("n_specimens") && (!value.matches("[1-9][0-9]*"))))
                            throw new NumberFormatException(value);
                    } catch (NumberFormatException e) { throw new IOException("잘못된 표본 정보입니다: " + field, e); }
                }
            }
            if (!validSourceUrl(row.get("source_url"))) throw new IOException("유효한 논문 DOI가 필요합니다.");
            double expectedAngle = row.get("load_direction").equals("PARALLEL") ? 0 : 90;
            try {
                if (Double.parseDouble(row.getOrDefault("grain_angle_deg", "")) != expectedAngle)
                    throw new IOException("하중 방향과 섬유 각도가 다릅니다.");
            } catch (NumberFormatException e) { throw new IOException("잘못된 섬유 각도입니다.", e); }
            String key = row.get("study_id") + "/" + row.get("test_group_id") + "/" + row.get("strength_basis");
            if (!directions.add(key + "/" + row.get("load_direction"))) throw new IOException("같은 시험군의 방향이 중복됩니다.");
            var group = groups.get(key);
            if (group == null) { group = new LinkedHashMap<>(row); groups.put(key, group); }
            else for (var field : SHARED)
                if (!Objects.equals(group.get(field), row.get(field))) throw new IOException("시험군 조건이 서로 다릅니다: " + field);
            group.put("value_" + row.get("load_direction"), row.get("strength_mpa"));
        }
        List<WoodEmbedmentDto> result = new ArrayList<>();
        for (var row : groups.values()) {
            String perp = row.getOrDefault("value_PERPENDICULAR", "-");
            List<String> rt = new ArrayList<>();
            if (row.containsKey("value_RADIAL")) rt.add("R " + row.get("value_RADIAL"));
            if (row.containsKey("value_TANGENTIAL")) rt.add("T " + row.get("value_TANGENTIAL"));
            if (!rt.isEmpty()) {
                if (!perp.equals("-")) throw new IOException("일반 직각값과 R/T는 별도 시험군으로 구분해 주세요.");
                perp = String.join("; ", rt);
            }
            String category = row.get("wood_group").equals("SOFTWOOD") ? "침엽수" : "활엽수";
            if (row.get("product_form").equals("GLT")) category += " 집성재";
            if (row.get("product_form").equals("CLT")) category += " 직교집성재 CLT";
            var dto = new WoodEmbedmentDto(row.get("reported_group_label"), category, blankAsDash(row.get("density_kg_m3")),
                    row.get("diameter_mm"), row.getOrDefault("value_PARALLEL", "-"), perp, row.get("test_standard"),
                    row.get("source_url"), row.get("study_id"), row.get("source_title"), row.get("source_locator"),
                    row.get("fastener_type"), row.get("test_notes"), row.get("test_setup"), row.get("strength_basis"));
            dto.setTestGroupId(row.get("study_id") + "/" + row.get("test_group_id") + "/" + row.get("strength_basis"));
            dto.setSpecificGravity(row.get("specific_gravity").isBlank() ? null : Double.valueOf(row.get("specific_gravity")));
            result.add(dto);
        }
        return List.copyOf(result);
    }

    static boolean validSourceUrl(String value) {
        try {
            var uri = URI.create(value);
            return "https".equals(uri.getScheme()) && "doi.org".equals(uri.getHost())
                    && uri.getUserInfo() == null && uri.getPath() != null && uri.getPath().length() > 1;
        } catch (IllegalArgumentException | NullPointerException e) { return false; }
    }

    private static String blankAsDash(String value) { return value == null || value.isBlank() ? "-" : value; }
    private static void checkEnum(Map<String, String> row, String key, String... allowed) throws IOException {
        if (!Arrays.asList(allowed).contains(row.get(key))) throw new IOException("지원하지 않는 논문 분류: " + key + "=" + row.get(key));
    }
    private static void number(Map<String, String> row, String key, boolean optional) throws IOException {
        String text = row.getOrDefault(key, "");
        if (optional && text.isBlank()) return;
        try {
            double n = Double.parseDouble(text);
            if (!Double.isFinite(n) || n <= 0 || !text.matches("[0-9]+(?:\\.[0-9]+)?")) throw new NumberFormatException(text);
        } catch (NumberFormatException e) { throw new IOException("논문 수치는 양수여야 합니다: " + key, e); }
    }
}
