-- Photos privees associees aux suggestions. Les fichiers restent hors du
-- repertoire public ; seule leur reference opaque est conservee en base.
CREATE TABLE IF NOT EXISTS suggestion_photos (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  suggestion_id  BIGINT UNSIGNED NOT NULL,
  stored_name    CHAR(36)         NOT NULL,
  file_size      INT UNSIGNED    NOT NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_suggestion_photos_stored_name (stored_name),
  KEY idx_suggestion_photos_suggestion (suggestion_id, id),

  CONSTRAINT fk_suggestion_photos_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'References vers les images privees des suggestions';
