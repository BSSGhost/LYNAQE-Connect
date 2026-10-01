-- ===========================================================================
--  LYNAQE Connect — migration 002
--  Historique de suivi : suggestion_updates
--
--  Chaque evolution d'une suggestion est tracee afin de construire la
--  timeline affichee au proprietaire via son numero de suivi.
--  ON DELETE CASCADE : si la suggestion est supprimee, son historique part
--  avec elle (aucune ligne orpheline).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS suggestion_updates (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  suggestion_id  BIGINT UNSIGNED NOT NULL,
  event_type     ENUM('creation', 'statut', 'message', 'publication', 'modification')
                                 NOT NULL DEFAULT 'statut',
  old_status     ENUM(
                   'En attente',
                   'Reçue',
                   'À l’étude',
                   'En cours',
                   'Réalisée',
                   'Non retenue',
                   'Archivée'
                 )                 NULL,
  new_status     ENUM(
                   'En attente',
                   'Reçue',
                   'À l’étude',
                   'En cours',
                   'Réalisée',
                   'Non retenue',
                   'Archivée'
                 )                 NULL,
  public_message TEXT            NULL COMMENT 'Message publie par l''administration, lisible par l''auteur',
  author_type    ENUM('system', 'admin')
                                 NOT NULL DEFAULT 'system',
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Timeline : lecture chronologique des evenements d'une suggestion
  KEY idx_updates_suggestion_created (suggestion_id, created_at, id),

  -- Purge / analyse globale
  KEY idx_updates_created_at (created_at),
  KEY idx_updates_event_type (event_type),

  CONSTRAINT fk_updates_suggestion
    FOREIGN KEY (suggestion_id) REFERENCES suggestions (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Historique d''evolution des suggestions (timeline de suivi)';
