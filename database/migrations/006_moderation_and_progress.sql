ALTER TABLE suggestions
  ADD COLUMN monthly_idea_at DATETIME NULL,
  ADD COLUMN progress_percent TINYINT UNSIGNED NULL,
  ADD COLUMN expected_completion_date DATE NULL,
  ADD KEY idx_suggestions_monthly_idea (monthly_idea_at),
  ADD CONSTRAINT chk_suggestions_progress_percent
    CHECK (progress_percent IS NULL OR progress_percent <= 100);

CREATE TABLE IF NOT EXISTS suggestion_reports (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  suggestion_id  BIGINT UNSIGNED NOT NULL,
  reporter_hash  CHAR(64)         NOT NULL,
  reason         ENUM(
                   'Contenu offensant',
                   'Spam',
                   'Informations personnelles',
                   'Fausse information',
                   'Contenu inapproprié',
                   'Autre'
                 )                 NOT NULL,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_suggestion_reports_reporter (suggestion_id, reporter_hash),
  KEY idx_suggestion_reports_suggestion (suggestion_id, created_at, id),

  CONSTRAINT fk_suggestion_reports_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Signalements des suggestions par appareils, sans identite nominative';
