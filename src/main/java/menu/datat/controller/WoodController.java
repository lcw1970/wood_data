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

    @GetMapping("/")
    public String getWoodDataList(Model model) {
        List<WoodEmbedmentDto> list = new ArrayList<>();

        try {
            // src/main/resources/wood_data.csv 파일 읽기
            ClassPathResource resource = new ClassPathResource("wood_data.csv");
            BufferedReader br = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)
            );

            String line;
            boolean isHeader = true;

            while ((line = br.readLine()) != null) {
                // 첫 줄(헤더 제목)은 데이터로 추가하지 않고 넘어감
                if (isHeader) {
                    isHeader = false;
                    continue;
                }

                // 쉼표(,)를 기준으로 컬럼 분리
                String[] tokens = line.split(",");

                if (tokens.length >= 8) {
                    list.add(new WoodEmbedmentDto(
                            tokens[0].trim(), // 학명
                            tokens[1].trim(), // 분류
                            tokens[2].trim(), // 밀도 범위
                            tokens[3].trim(), // 스크류 범위
                            tokens[4].trim(), // 섬유평행 지압강도
                            tokens[5].trim(), // 섬유직각 지압강도
                            tokens[6].trim(), // 적용 표준
                            tokens[7].trim()  // 원문 URL
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
}