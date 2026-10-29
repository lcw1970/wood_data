package menu.datat.service;

import java.io.IOException;
import java.io.PushbackReader;
import java.io.Reader;
import java.util.*;

/** CSV records, including UTF-8 BOMs, quoted commas, escaped quotes and multiline notes. */
final class CsvTable {
    private CsvTable() { }

    static List<Map<String, String>> read(Reader input) throws IOException {
        var reader = new PushbackReader(input, 1);
        List<List<String>> records = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false, closed = false, first = true;
        int c;
        while ((c = reader.read()) != -1) {
            if (first && c == '\ufeff') { first = false; continue; }
            first = false;
            if (quoted) {
                if (c == '"') {
                    int next = reader.read();
                    if (next == '"') cell.append('"');
                    else { quoted = false; closed = true; if (next != -1) reader.unread(next); }
                } else cell.append((char)c);
            } else if (c == ',' || c == '\n' || c == '\r') {
                cells.add(cell.toString()); cell.setLength(0); closed = false;
                if (c != ',') {
                    if (c == '\r') { int next = reader.read(); if (next != '\n' && next != -1) reader.unread(next); }
                    if (!(cells.size() == 1 && cells.getFirst().isBlank())) records.add(List.copyOf(cells));
                    cells.clear();
                }
            } else if (c == '"' && cell.isEmpty() && !closed) quoted = true;
            else {
                if (closed || c == '"') throw new IOException("잘못된 CSV 따옴표입니다.");
                cell.append((char)c);
            }
        }
        if (quoted) throw new IOException("CSV 따옴표가 닫히지 않았습니다.");
        if (!cells.isEmpty() || !cell.isEmpty() || closed) { cells.add(cell.toString()); records.add(cells); }
        if (records.isEmpty()) throw new IOException("CSV 헤더가 없습니다.");
        var header = records.removeFirst();
        if (new HashSet<>(header).size() != header.size() || header.stream().anyMatch(String::isBlank))
            throw new IOException("CSV 열 이름이 비어 있거나 중복됩니다.");
        List<Map<String, String>> result = new ArrayList<>();
        for (var record : records) {
            if (record.size() != header.size()) throw new IOException("CSV 열 개수가 헤더와 다릅니다.");
            Map<String, String> row = new LinkedHashMap<>();
            for (int i = 0; i < header.size(); i++) row.put(header.get(i), record.get(i).trim());
            result.add(row);
        }
        return result;
    }
}
