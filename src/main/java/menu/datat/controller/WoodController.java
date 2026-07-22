package menu.datat.controller;

import menu.datat.dto.WoodEmbedmentDto;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

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

    // 2. 예측 계산기 전용 페이지 이동
    @GetMapping("/calculator")
    public String showCalculator() {
        return "calculator";
    }
}