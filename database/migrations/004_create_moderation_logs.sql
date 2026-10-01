-- ===========================================================================
--  LYNAQE Connect — migration 004
--  Journal de moderation : moderation_logs
--
--  Trace les actions administratives importantes : publication, modification,
--  changement de statut, suppression, archivage, rejet, depublication.
--  ON DELETE SET NULL : le journal reste intact meme si la suggestion est
--  supprimee.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS moderation_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  suggestion_id   BIGINT UNSIGNED NULL,
  action          ENUM(
                    'creation',
                    'publication',
                    'depublication',
                    'modification',
                    'statut',
                    'rejet',
                    'archivage',
                    'suppression',
                    'consultation'
                  )                NOT NULL,

  old_status      ENUM(
                    'En attente',
                    'Reçue',
                    'À l’étude',
                    'En cours',
                    'Réalisée',
                    'Non retenue',
                    'Archivée'
                  )                NULL,
  new_status      ENUM(
                    'En attente',
                    'Reçue',
                    'À l’étude',
                    'En cours',
                    'Réalisée',
                    'Non retenue',
                    'Archivée'
                  )                NULL,
  old_visibility  ENUM('privee', 'publique') NULL,
  new_visibility  ENUM('privee', 'publique') NULL,

  actor           ENUM('admin', 'system') NOT NULL DEFAULT 'admin',
  note            TEXT            NULL COMMENT 'Detail de l''action, visible uniquement par l''administration',
  ip_address      VARCHAR(45)     NULL COMMENT 'IP de l''administrateur (tracabilite, non publique)',
  user_agent      VARCHAR(255)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_logs_suggestion (suggestion_id, created_at),
  KEY idx_logs_created_at (created_at),
  KEY idx_logs_action (action),
  KEY idx_logs_actor (actor),

  CONSTRAINT fk_logs_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Journal d''audit des actions de moderation';
