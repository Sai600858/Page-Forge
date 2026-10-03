package com.sumit.SpringBoot_BackEnd.service;

import com.sumit.SpringBoot_BackEnd.config.JwtUtils;
import com.sumit.SpringBoot_BackEnd.dto.AuthDtos.*;
import com.sumit.SpringBoot_BackEnd.model.entity.User;
import com.sumit.SpringBoot_BackEnd.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    public AuthResponse register(RegisterRequest request, HttpServletResponse response) {
        if (request.getEmail() == null || request.getPassword() == null || request.getName() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email, password, and name are required.");
        }
        if (request.getPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .provider("email")
                .build();

        user = userRepository.save(user);

        String accessToken = jwtUtils.generateAccessToken(user);
        String refreshToken = jwtUtils.generateRefreshToken(user);
        jwtUtils.setAuthCookies(response, accessToken, refreshToken);

        UserDto userDto = UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .createdAt(user.getCreatedAt())
                .build();

        return AuthResponse.builder()
                .message("Account created successfully.")
                .user(userDto)
                .accessToken(accessToken)
                .build();
    }

    public AuthResponse login(LoginRequest request, HttpServletResponse response) {
        if (request.getEmail() == null || request.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));

        if (user.getPassword() == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }

        String accessToken = jwtUtils.generateAccessToken(user);
        String refreshToken = jwtUtils.generateRefreshToken(user);
        jwtUtils.setAuthCookies(response, accessToken, refreshToken);

        UserDto userDto = UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .avatar(user.getAvatar())
                .createdAt(user.getCreatedAt())
                .build();

        return AuthResponse.builder()
                .message("Logged in successfully.")
                .user(userDto)
                .accessToken(accessToken)
                .build();
    }

    public void logout(HttpServletResponse response) {
        jwtUtils.clearAuthCookies(response);
    }

    public AuthResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        String token = jwtUtils.resolveRefreshToken(request);
        if (token == null || !jwtUtils.validateRefreshToken(token)) {
            jwtUtils.clearAuthCookies(response);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token.");
        }

        Long userId = jwtUtils.getUserIdFromRefreshToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found."));

        String newAccessToken = jwtUtils.generateAccessToken(user);
        String newRefreshToken = jwtUtils.generateRefreshToken(user);
        jwtUtils.setAuthCookies(response, newAccessToken, newRefreshToken);

        UserDto userDto = UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .avatar(user.getAvatar())
                .createdAt(user.getCreatedAt())
                .build();

        return AuthResponse.builder()
                .message("Token refreshed.")
                .user(userDto)
                .build();
    }

    public UserDto getMe(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .avatar(user.getAvatar())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
