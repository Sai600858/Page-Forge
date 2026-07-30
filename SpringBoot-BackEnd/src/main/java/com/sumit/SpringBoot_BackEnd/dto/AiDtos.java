package com.sumit.SpringBoot_BackEnd.dto;

import java.util.List;

public class AiDtos {

    public static class SummaryResponse {
        private String summary;
        private List<String> keyPoints;
        private List<String> importantDates;
        private List<String> actionItems;
        private List<FaqItem> faqs;

        public SummaryResponse() {}
        public SummaryResponse(String summary, List<String> keyPoints, List<String> importantDates, List<String> actionItems, List<FaqItem> faqs) {
            this.summary = summary;
            this.keyPoints = keyPoints;
            this.importantDates = importantDates;
            this.actionItems = actionItems;
            this.faqs = faqs;
        }

        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }

        public List<String> getKeyPoints() { return keyPoints; }
        public void setKeyPoints(List<String> keyPoints) { this.keyPoints = keyPoints; }

        public List<String> getImportantDates() { return importantDates; }
        public void setImportantDates(List<String> importantDates) { this.importantDates = importantDates; }

        public List<String> getActionItems() { return actionItems; }
        public void setActionItems(List<String> actionItems) { this.actionItems = actionItems; }

        public List<FaqItem> getFaqs() { return faqs; }
        public void setFaqs(List<FaqItem> faqs) { this.faqs = faqs; }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private String summary;
            private List<String> keyPoints;
            private List<String> importantDates;
            private List<String> actionItems;
            private List<FaqItem> faqs;

            public Builder summary(String summary) { this.summary = summary; return this; }
            public Builder keyPoints(List<String> keyPoints) { this.keyPoints = keyPoints; return this; }
            public Builder importantDates(List<String> importantDates) { this.importantDates = importantDates; return this; }
            public Builder actionItems(List<String> actionItems) { this.actionItems = actionItems; return this; }
            public Builder faqs(List<FaqItem> faqs) { this.faqs = faqs; return this; }

            public SummaryResponse build() {
                return new SummaryResponse(summary, keyPoints, importantDates, actionItems, faqs);
            }
        }

        public static class FaqItem {
            private String q;
            private String a;

            public FaqItem() {}
            public FaqItem(String q, String a) {
                this.q = q;
                this.a = a;
            }

            public String getQ() { return q; }
            public void setQ(String q) { this.q = q; }

            public String getA() { return a; }
            public void setA(String a) { this.a = a; }
        }
    }

    public static class ChatUploadResponse {
        private String message;
        private String sessionId;
        private String docName;
        private List<String> suggestions;

        public ChatUploadResponse() {}
        public ChatUploadResponse(String message, String sessionId, String docName, List<String> suggestions) {
            this.message = message;
            this.sessionId = sessionId;
            this.docName = docName;
            this.suggestions = suggestions;
        }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }

        public String getDocName() { return docName; }
        public void setDocName(String docName) { this.docName = docName; }

        public List<String> getSuggestions() { return suggestions; }
        public void setSuggestions(List<String> suggestions) { this.suggestions = suggestions; }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private String message;
            private String sessionId;
            private String docName;
            private List<String> suggestions;

            public Builder message(String message) { this.message = message; return this; }
            public Builder sessionId(String sessionId) { this.sessionId = sessionId; return this; }
            public Builder docName(String docName) { this.docName = docName; return this; }
            public Builder suggestions(List<String> suggestions) { this.suggestions = suggestions; return this; }

            public ChatUploadResponse build() {
                return new ChatUploadResponse(message, sessionId, docName, suggestions);
            }
        }
    }

    public static class ChatMessageRequest {
        private String sessionId;
        private String question;

        public ChatMessageRequest() {}
        public ChatMessageRequest(String sessionId, String question) {
            this.sessionId = sessionId;
            this.question = question;
        }

        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }

        public String getQuestion() { return question; }
        public void setQuestion(String question) { this.question = question; }
    }
}
