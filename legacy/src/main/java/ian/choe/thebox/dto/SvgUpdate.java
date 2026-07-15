package ian.choe.thebox.dto;

import java.util.List;
import java.util.Map;

public class SvgUpdate {
    private List<Update> updates;
    public List<Update> getUpdates() { return updates; }
    public void setUpdates(List<Update> updates) { this.updates = updates; }

    public static class Update {
        private String selector;
        private Map<String, String> attributes;
        private String newElement;

        public String getSelector() { return selector; }
        public void setSelector(String selector) { this.selector = selector; }
        public Map<String, String> getAttributes() { return attributes; }
        public void setAttributes(Map<String, String> attributes) { this.attributes = attributes; }
        public String getNewElement() { return newElement; }
        public void setNewElement(String newElement) { this.newElement = newElement; }
    }
}