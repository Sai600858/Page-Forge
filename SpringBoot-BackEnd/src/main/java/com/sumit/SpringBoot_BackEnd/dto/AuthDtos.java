package com.sumit.SpringBoot_BackEnd.dto;

import java.time.LocalDateTime;

public class AuthDtos {

    public static class RegisterRequest {
        private String email;
        private String password;
        private String name;

        public RegisterRequest() {}
        public RegisterRequest(String email, String password, String name) {
            this.email = email;
            this.password = password;
            this.name = name;
        }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

    public static class LoginRequest {
        private String email;
        private String password;

        public LoginRequest() {}
        public LoginRequest(String email, String password) {
            this.email = email;
            this.password = password;
        }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class UserDto {
        private Long id;
        private String email;
        private String name;
        private String avatar;
        private LocalDateTime createdAt;

        public UserDto() {}
        public UserDto(Long id, String email, String name, String avatar, LocalDateTime createdAt) {
            this.id = id;
            this.email = email;
            this.name = name;
            this.avatar = avatar;
            this.createdAt = createdAt;
        }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getAvatar() { return avatar; }
        public void setAvatar(String avatar) { this.avatar = avatar; }

        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private Long id;
            private String email;
            private String name;
            private String avatar;
            private LocalDateTime createdAt;

            public Builder id(Long id) { this.id = id; return this; }
            public Builder email(String email) { this.email = email; return this; }
            public Builder name(String name) { this.name = name; return this; }
            public Builder avatar(String avatar) { this.avatar = avatar; return this; }
            public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

            public UserDto build() {
                return new UserDto(id, email, name, avatar, createdAt);
            }
        }
    }

    public static class AuthResponse {
        private String message;
        private UserDto user;
        private String accessToken;

        public AuthResponse() {}
        public AuthResponse(String message, UserDto user, String accessToken) {
            this.message = message;
            this.user = user;
            this.accessToken = accessToken;
        }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public UserDto getUser() { return user; }
        public void setUser(UserDto user) { this.user = user; }

        public String getAccessToken() { return accessToken; }
        public void setAccessToken(String accessToken) { this.accessToken = accessToken; }

        public static Builder builder() { return new Builder(); }

        public static class Builder {
            private String message;
            private UserDto user;
            private String accessToken;

            public Builder message(String message) { this.message = message; return this; }
            public Builder user(UserDto user) { this.user = user; return this; }
            public Builder accessToken(String accessToken) { this.accessToken = accessToken; return this; }

            public AuthResponse build() {
                return new AuthResponse(message, user, accessToken);
            }
        }
    }
}
