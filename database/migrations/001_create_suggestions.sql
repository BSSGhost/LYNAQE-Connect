-- ===========================================================================
--  LYNAQE Connect — migration 001
--  Table principale : suggestions
--
--  Regle metier : le code secret n'est JAMAIS stocke en clair.
--  Il est conserve uniquement sous forme de hash scrypt (secret_code_hash).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS suggestions (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Identifiants confidentiels ------------------------------------------------
  tracking_code     VARCHAR(32)     NOT NULL COMMENT 'Numero de suivi commun a l''auteur, jamais public',
  secret_code_hash  VARCHAR(255)    NOT NULL COMMENT 'Hash scrypt du code secret, jamais renvoye par l''API',

  -- Contenu ------------------------------------------------------------------
  title             VARCHAR(180)    NOT NULL,
  description       TEXT            NOT NULL,
  category          ENUM(
                      'Vie scolaire',
                      'Infrastructures et matériel',
                      'Propreté et hygiène',
                      'Restauration et cadre de vie',
                      'Activités culturelles et sportives',
                      'Enseignement et apprentissage',
                      'Environnement',
                      'Autres'
                    )               NOT NULL DEFAULT 'Autres',
  location          VARCHAR(180)    NULL COMMENT 'Emplacement concerne (cour, salle, cantine...)',
  extra_info        TEXT            NULL COMMENT 'Informations complementaires facultatives',

  -- Modération et suivi -------------------------------------------------------
  status            ENUM(
                      'En attente',
                      'Reçue',
                      'À l’étude',
                      'En cours',
                      'Réalisée',
                      'Non retenue',
                      'Archivée'
                    )               NOT NULL DEFAULT 'En attente',
  visibility        ENUM('privee', 'publique')
                                    NOT NULL DEFAULT 'privee'
                                    COMMENT 'Rien n''est public avant validation par l''administration',
  is_anonymous      TINYINT(1)      NOT NULL DEFAULT 0,
  author_name       VARCHAR(120)    NULL COMMENT 'Renseigne uniquement si la suggestion n''est pas anonyme',
  author_contact    VARCHAR(120)    NULL COMMENT 'Contact facultatif pour joindre l''auteur',
  moderation_note   TEXT            NULL COMMENT 'Note interne, jamais exposee publiquement',

  -- Compteurs ----------------------------------------------------------------
  support_count     INT UNSIGNED    NOT NULL DEFAULT 0,

  -- Horodatage ---------------------------------------------------------------
  published_at      DATETIME        NULL COMMENT 'Date de publication publique',
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Un numero de suivi = une suggestion
  UNIQUE KEY uq_suggestions_tracking_code (tracking_code),

  -- Filtres de l'espace public
  KEY idx_suggestions_visibility_status (visibility, status),
  KEY idx_suggestions_visibility_published (visibility, published_at),
  KEY idx_suggestions_visibility_support (visibility, support_count),

  -- Filtres de l'administration et statistiques
  KEY idx_suggestions_status (status),
  KEY idx_suggestions_category (category),
  KEY idx_suggestions_status_category (status, category),
  KEY idx_suggestions_created_at (created_at),

  -- Integrite : une suggestion anonyme ne conserve pas de nom d'auteur
  CONSTRAINT chk_suggestions_anonymous_no_name
    CHECK (is_anonymous = 0 OR author_name IS NULL),

  -- Integrite : un compteur de soutien ne peut pas etre negatif
  CONSTRAINT chk_suggestions_support_count CHECK (support_count >= 0)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Suggestions et signalements envoyes par les eleves du LYNAQE de Sedhiou';
