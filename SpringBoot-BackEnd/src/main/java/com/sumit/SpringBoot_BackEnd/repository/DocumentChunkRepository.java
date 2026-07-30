package com.sumit.SpringBoot_BackEnd.repository;

import com.sumit.SpringBoot_BackEnd.model.entity.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, String> {
    List<DocumentChunk> findBySessionIdAndUserId(String sessionId, Long userId);
    void deleteBySessionIdAndUserId(String sessionId, Long userId);
}
