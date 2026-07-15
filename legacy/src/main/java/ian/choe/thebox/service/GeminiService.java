package ian.choe.thebox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
public class GeminiService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    public GeminiService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.baseUrl("https://generativelanguage.googleapis.com").build();
        this.objectMapper = objectMapper;
    }

    public String getSvgUpdates(String userPrompt, String currentSvgState) {
        String url = "/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
        String aiPrompt = buildPrompt(userPrompt, currentSvgState);

        String requestBody = String.format("""
                {
                  "contents": [{
                    "parts": [{"text": "%s"}]
                  }],
                  "generationConfig": {
                    "responseMimeType": "application/json"
                  }
                }
                """, aiPrompt.replace("\"", "\\\"").replace("\n", "\\n"));

        Mono<String> responseMono = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class);

        String rawResponse = responseMono.block();
        try {
            JsonNode rootNode = objectMapper.readTree(rawResponse);
            JsonNode textNode = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text");

            if (textNode != null && textNode.isTextual()) {
                String geminiContent = textNode.asText();
                if (geminiContent.startsWith("{") && geminiContent.endsWith("}")) {
                    return geminiContent;
                } else {
                    try {
                        JsonNode innerNode = objectMapper.readTree(geminiContent);
                        return objectMapper.writeValueAsString(innerNode);
                    } catch (Exception e) {
                        System.err.println("Could not parse inner Gemini response as JSON: " + e.getMessage());
                        System.err.println("Inner Content: " + geminiContent);
                        return "{\"error\":\"Failed to parse inner response from AI. Content: " + geminiContent.replace("\"", "\\\"") + "\"}";
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Could not parse Gemini Response: " + e.getMessage());
            System.err.println("Raw Response: " + rawResponse);
        }

        return "{\"error\":\"Failed to parse response from AI.\"}";
    }

    private String buildPrompt(String userPrompt, String svgState) {
        return String.format("""
    You are a master SVG artist and intelligent engine for a web game called "The Box". Your goal is to interpret a user's prompt and transform the provided SVG code in a logical, creative, and visually coherent way.

    CORE CONCEPTS & RULES:

    1.  The Box is a Unified Character: Treat the entire SVG content, including the main box and any accessories, as a single, unified character. When the user requests a broad transformation (e.g., "make it 3D"), apply this change holistically to the entire character and its parts. Accessories must stick to the box and transform with it.

    2.  Stylistic Adherence and Self-Correction: When you receive a stylistic prompt (e.g., 'anime', 'cartoon'), you must access your knowledge base to identify the style's core visual characteristics. Then, you must translate those characteristics into concrete SVG code. CRITICALLY, you must adhere strictly to the requested style's conventions. Do not introduce elements from other, unrelated styles. For an "anime face," this means you must focus on creating large, expressive eyes with highlights, a small nose, and a simple mouth. It explicitly means you should NOT create a mischievous smirk or sunglasses-like eyebrows if that is not part of the core "anime" look. Your interpretation must be faithful to the style's defining features.

    3.  Infer Reasonable Details: For simple, non-specific requests (e.g., "add a hat"), you must infer and add common, aesthetically pleasing details. A "hat" should have a shape beyond a simple rectangle; give it a brim, a curve, or a recognizable style that fits the game's aesthetic.

    4.  Logical Placement: All new or modified elements must be logically placed and centered relative to their parent element or the main "#the-box" rectangle, unless the user explicitly specifies a different position.

    5.  No Unsolicited Changes: ONLY add or modify elements that are directly requested or clearly implied by the user's prompt. Do not add random elements.

    6.  Strictly JSON Output: Your entire response MUST be a single, valid JSON object and nothing else. Do NOT include markdown formatting (like ```json), introductions, or any explanatory text.

    7.  Required JSON Structure: The JSON object must have a top-level key "updates" which contains an array of objects. Each object in the array represents a single modification and must contain:
        * "selector" (String): A valid CSS selector for the SVG element to modify.
        * "attributes" (Map<String, String>): An object of SVG attributes to change.
        * It MAY optionally contain "newElement" (String): A string for a new SVG element to add. If `newElement` is used, the `selector` should target the container for the new element, like "#game-canvas".

    ---
    CONTEXT:

    Current SVG State:
    <svg id="game-canvas">%s</svg>

    User Prompt:
    "%s"
    ---

    Generate the JSON object now.
    """, svgState, userPrompt);
    }
}