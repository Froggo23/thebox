package ian.choe.thebox.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class TheBoxController {

    @GetMapping("/thebox")
    public String getTheBoxPage() {
        return "thebox";
    }
}