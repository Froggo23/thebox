package ian.choe.thebox.controller;

import ian.choe.thebox.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final GeminiService geminiService;

    @Autowired
    public ApiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/transform")
    public ResponseEntity<String> transformTheBox(@RequestBody Map<String, String> payload) {
        try {
            String prompt = payload.get("prompt");
            String svgState = payload.get("svgState");

            if (prompt == null || svgState == null) {
                return ResponseEntity.badRequest().body("{\"error\": \"Prompt and svgState are required.\"}");
            }

            String jsonResponse = geminiService.getSvgUpdates(prompt, svgState);
            return ResponseEntity.ok(jsonResponse);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("{\"error\": \"Error processing your request.\"}");
        }
    }
}