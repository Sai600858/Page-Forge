package com.sumit.SpringBoot_BackEnd.repository;

import com.sumit.SpringBoot_BackEnd.model.entity.PdfHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PdfHistoryRepository extends JpaRepository<PdfHistory, String> {
    List<PdfHistory> findTop100ByUserIdOrderByCreatedAtDesc(Long userId);
    void deleteByUserId(Long userId);
}
