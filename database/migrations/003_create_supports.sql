-- ===========================================================================
--  LYNAQE Connect — migration 003
--  Soutiens aux suggestions : supports
--
--  Anti-abus : supporter_hash = SHA-256(secret serveur + jeton appareil +
--  IP). Un meme personne / appareil / session ne peut donc pas soutenir deux
--  fois la meme suggestion (contrainte UNIQUE). Aucune IP en clair n'est
--  conservee.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS supports (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  suggestion_id   BIGINT UNSIGNED NOT NULL,
  supporter_hash  CHAR(64)        NOT NULL COMMENT 'Empreinte SHA-256 du soutien (non reversible)',
  supporter_token_hash CHAR(64)   NULL COMMENT 'Empreinte du jeton local, utile pour l''audit',
  ip_prefix       VARCHAR(45)     NULL COMMENT 'IP tronquee / masquee, jamais en clair',
  user_agent      VARCHAR(255)    NULL COMMENT 'UA tronque a 255 caracteres',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Regle metier principale : un soutien unique par suggestion et par personne
  UNIQUE KEY uq_supports_suggestion_supporter (suggestion_id, supporter_hash),

  KEY idx_supports_suggestion (suggestion_id, created_at),
  KEY idx_supports_created_at (created_at),

  CONSTRAINT fk_supports_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Soutiens anonymes apportes par les visiteurs aux suggestions';
