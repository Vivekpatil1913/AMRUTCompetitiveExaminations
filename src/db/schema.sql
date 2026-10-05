-- =====================================================================
-- विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम – AMRUT Study Portal
-- PostgreSQL schema (manage with pgAdmin)
--
-- Conventions
--   * *_en / *_mr  : bilingual content (Marathi + English ready)
--   * is_active / is_published : admin-controlled visibility
--   * Items marked "HOLD" are structural placeholders only – business
--     rules are NOT implemented until management confirmation.
-- =====================================================================

-- ---------- Website configuration ----------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value_en    TEXT,
  value_mr    TEXT,
  group_name  TEXT NOT NULL DEFAULT 'general',
  label       TEXT,
  input_type  TEXT NOT NULL DEFAULT 'text',   -- text | textarea | url | image
  sort_order  INT  NOT NULL DEFAULT 0
);

-- Editable text blocks (hero, programme introduction, about, accommodation info ...)
CREATE TABLE IF NOT EXISTS site_content (
  id          SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  title_en    TEXT, title_mr TEXT,
  body_en     TEXT, body_mr  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Administrators (roles & permissions: HOLD) ----------
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'administrator', -- final role hierarchy HOLD
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Candidates (registered & verified through Mahaamrut) ----------
-- candidate_uid : unique ID issued after verification – FORMAT HOLD
-- mahaamrut_ref : reference to the Mahaamrut registration – integration HOLD
-- password_hash : PROTOTYPE login only – final authentication method HOLD
CREATE TABLE IF NOT EXISTS candidates (
  id                        SERIAL PRIMARY KEY,
  candidate_uid             TEXT UNIQUE,
  mahaamrut_ref             TEXT,
  name                      TEXT NOT NULL,
  mobile                    TEXT,
  email                     TEXT,
  category                  TEXT NOT NULL CHECK (category IN ('lakshit','non_lakshit')),
  registration_status       TEXT NOT NULL DEFAULT 'registered' CHECK (registration_status IN ('registered','incomplete')),
  verification_status       TEXT NOT NULL DEFAULT 'pending'  CHECK (verification_status IN ('pending','verified','rejected')),
  verification_remarks      TEXT,
  study_material_permitted  BOOLEAN NOT NULL DEFAULT FALSE,   -- "specially permitted by admin"
  password_hash             TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Examinations & configurable hierarchy ----------
CREATE TABLE IF NOT EXISTS examinations (
  id              SERIAL PRIMARY KEY,
  name_en         TEXT NOT NULL,
  name_mr         TEXT,
  short_name      TEXT,
  description_en  TEXT,
  description_mr  TEXT,
  syllabus_url    TEXT,   -- official external link, configured by admin
  timetable_url   TEXT,   -- official external link, configured by admin
  website_url     TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Prelims / Mains / Post etc. – optional, per examination
CREATE TABLE IF NOT EXISTS exam_stages (
  id              SERIAL PRIMARY KEY,
  examination_id  INT NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  name_en         TEXT NOT NULL,
  name_mr         TEXT,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS course_categories (
  id              SERIAL PRIMARY KEY,
  name_en         TEXT NOT NULL,
  name_mr         TEXT,
  description_en  TEXT,
  description_mr  TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS courses (
  id              SERIAL PRIMARY KEY,
  category_id     INT REFERENCES course_categories(id) ON DELETE SET NULL,
  examination_id  INT REFERENCES examinations(id) ON DELETE SET NULL,
  title_en        TEXT NOT NULL,
  title_mr        TEXT,
  description_en  TEXT,
  description_mr  TEXT,
  mode            TEXT NOT NULL DEFAULT 'online' CHECK (mode IN ('online','offline','both')),
  duration_days   INT,      -- configurable (requirement mentions both 75-day and 15-day)
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS subjects (
  id              SERIAL PRIMARY KEY,
  examination_id  INT REFERENCES examinations(id) ON DELETE CASCADE,
  stage_id        INT REFERENCES exam_stages(id) ON DELETE SET NULL,
  name_en         TEXT NOT NULL,
  name_mr         TEXT,
  description_en  TEXT,
  description_mr  TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Course ↔ Subject (a subject may belong to many courses)
CREATE TABLE IF NOT EXISTS course_subjects (
  course_id   INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  subject_id  INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, subject_id)
);

-- Topics / sub-parts; parent_id allows any depth (hierarchy is configurable)
CREATE TABLE IF NOT EXISTS topics (
  id          SERIAL PRIMARY KEY,
  subject_id  INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id   INT REFERENCES topics(id) ON DELETE CASCADE,
  name_en     TEXT NOT NULL,
  name_mr     TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Offline: centres & batches (centre structure HOLD) ----------
CREATE TABLE IF NOT EXISTS centres (
  id          SERIAL PRIMARY KEY,
  centre_no   TEXT,
  name_en     TEXT NOT NULL,
  name_mr     TEXT,
  location    TEXT,
  address     TEXT,
  map_url     TEXT,
  contact     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- deposit_applicability: configurable per batch because applicability is HOLD
CREATE TABLE IF NOT EXISTS batches (
  id                        SERIAL PRIMARY KEY,
  course_id                 INT REFERENCES courses(id) ON DELETE CASCADE,
  centre_id                 INT REFERENCES centres(id) ON DELETE SET NULL,
  name                      TEXT NOT NULL,
  start_date                DATE,
  end_date                  DATE,
  seats                     INT,
  booking_open              BOOLEAN NOT NULL DEFAULT FALSE,
  accommodation_available   BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_applicability     TEXT NOT NULL DEFAULT 'hold'
                              CHECK (deposit_applicability IN ('hold','not_applicable','accommodation_only','all_participants')),
  deposit_amount            NUMERIC(10,2),   -- "₹500 or amount decided from time to time"
  remarks                   TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- People: speakers / resource persons / advisory ----------
CREATE TABLE IF NOT EXISTS speakers (
  id              SERIAL PRIMARY KEY,
  name_en         TEXT NOT NULL,
  name_mr         TEXT,
  designation_en  TEXT,
  designation_mr  TEXT,
  bio_en          TEXT,
  bio_mr          TEXT,
  photo           TEXT,
  is_advisory     BOOLEAN NOT NULL DEFAULT FALSE,   -- shown as "proposed advisory/resource person"
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Lectures (also the source of the Training Timetable) ----------
CREATE TABLE IF NOT EXISTS lectures (
  id              SERIAL PRIMARY KEY,
  title_en        TEXT NOT NULL,
  title_mr        TEXT,
  lecture_type    TEXT NOT NULL DEFAULT 'regular' CHECK (lecture_type IN ('regular','guest','guidance','special')),
  speaker_id      INT REFERENCES speakers(id) ON DELETE SET NULL,
  examination_id  INT REFERENCES examinations(id) ON DELETE SET NULL,
  course_id       INT REFERENCES courses(id) ON DELETE SET NULL,
  subject_id      INT REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id        INT REFERENCES topics(id) ON DELETE SET NULL,
  batch_id        INT REFERENCES batches(id) ON DELETE SET NULL,
  lecture_date    DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  mode            TEXT NOT NULL DEFAULT 'online' CHECK (mode IN ('online','offline')),
  centre_id       INT REFERENCES centres(id) ON DELETE SET NULL,
  venue           TEXT,
  online_link     TEXT,
  youtube_url     TEXT,
  description_en  TEXT,
  description_mr  TEXT,
  remarks         TEXT,
  is_highlighted  BOOLEAN NOT NULL DEFAULT FALSE,   -- landing page marquee/highlight
  visibility      TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','registered','verified')),
  is_published    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- स्पर्धा परीक्षा यात्रा (lecturer travel schedule) ----------
-- Display logic (which entries are "current/upcoming") is HOLD – see docs.
CREATE TABLE IF NOT EXISTS travel_schedules (
  id             SERIAL PRIMARY KEY,
  speaker_id     INT REFERENCES speakers(id) ON DELETE SET NULL,
  person_name    TEXT NOT NULL,
  schedule_date  DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  place          TEXT NOT NULL,
  remarks        TEXT,
  is_published   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Learning resources ----------
-- resource_type : question_bank | video | youtube | guest_lecture | study_material | pdf
-- access_level  : public | registered | verified | lakshit_or_permitted
CREATE TABLE IF NOT EXISTS resources (
  id              SERIAL PRIMARY KEY,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('question_bank','video','youtube','guest_lecture','study_material','pdf')),
  title_en        TEXT NOT NULL,
  title_mr        TEXT,
  description_en  TEXT,
  description_mr  TEXT,
  examination_id  INT REFERENCES examinations(id) ON DELETE SET NULL,
  course_id       INT REFERENCES courses(id) ON DELETE SET NULL,
  subject_id      INT REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id        INT REFERENCES topics(id) ON DELETE SET NULL,
  url             TEXT,
  file_path       TEXT,
  access_level    TEXT NOT NULL DEFAULT 'public' CHECK (access_level IN ('public','registered','verified','lakshit_or_permitted')),
  sort_order      INT NOT NULL DEFAULT 0,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-candidate grants ("Manage permitted resources")
CREATE TABLE IF NOT EXISTS resource_grants (
  candidate_id  INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  resource_id   INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, resource_id)
);

-- ---------- Question bank & MCQ tests ----------
-- Scoring, negative marking, randomization, question count: HOLD
CREATE TABLE IF NOT EXISTS questions (
  id              SERIAL PRIMARY KEY,
  examination_id  INT REFERENCES examinations(id) ON DELETE SET NULL,
  subject_id      INT REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id        INT REFERENCES topics(id) ON DELETE SET NULL,
  question_type   TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq')),  -- other types only if approved
  question_en     TEXT NOT NULL,
  question_mr     TEXT,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT,
  option_d        TEXT,
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  explanation     TEXT,
  in_question_bank BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tests (
  id              SERIAL PRIMARY KEY,
  title_en        TEXT NOT NULL,
  title_mr        TEXT,
  test_type       TEXT NOT NULL DEFAULT 'lecture' CHECK (test_type IN ('lecture','unit','practice')),
  lecture_id      INT REFERENCES lectures(id) ON DELETE SET NULL,
  examination_id  INT REFERENCES examinations(id) ON DELETE SET NULL,
  course_id       INT REFERENCES courses(id) ON DELETE SET NULL,
  subject_id      INT REFERENCES subjects(id) ON DELETE SET NULL,
  instructions_en TEXT,
  instructions_mr TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS test_questions (
  test_id      INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_id  INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (test_id, question_id)
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id            SERIAL PRIMARY KEY,
  test_id       INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  candidate_id  INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at  TIMESTAMPTZ,
  total         INT,
  correct       INT,
  incorrect     INT,
  unanswered    INT
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id       INT NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id      INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option  CHAR(1),
  is_correct       BOOLEAN,
  PRIMARY KEY (attempt_id, question_id)
);

-- ---------- Psychological / aptitude assessment (framework only – HOLD) ----------
CREATE TABLE IF NOT EXISTS assessments (
  id              SERIAL PRIMARY KEY,
  title_en        TEXT NOT NULL,
  title_mr        TEXT,
  area            TEXT NOT NULL CHECK (area IN ('adaptability','interest','career_counselling')),
  description_en  TEXT,
  description_mr  TEXT,
  conducted_by    TEXT,
  status          TEXT NOT NULL DEFAULT 'hold' CHECK (status IN ('hold','active','closed'))
);

-- ---------- Enrolment ----------
CREATE TABLE IF NOT EXISTS enrollments (
  id            SERIAL PRIMARY KEY,
  candidate_id  INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  course_id     INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id      INT REFERENCES batches(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, course_id)
);

-- ---------- Offline booking, accommodation, deposit & transaction proof ----------
-- Payment provider / account, refund rules, accommodation workflow: HOLD
CREATE TABLE IF NOT EXISTS offline_bookings (
  id                      SERIAL PRIMARY KEY,
  candidate_id            INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  batch_id                INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  contact_mobile          TEXT,
  contact_email           TEXT,
  accommodation_required  BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount          NUMERIC(10,2),
  payment_status          TEXT NOT NULL DEFAULT 'not_applicable'
                            CHECK (payment_status IN ('not_applicable','proof_submitted','verified','rejected')),
  transaction_ref         TEXT,
  proof_path              TEXT,
  status                  TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','confirmed','rejected','cancelled','completed')),
  refund_status           TEXT NOT NULL DEFAULT 'hold' CHECK (refund_status IN ('hold','not_applicable','processed')),
  remarks                 TEXT,
  admin_remarks           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, batch_id)
);

-- ---------- Announcements & important links ----------
CREATE TABLE IF NOT EXISTS announcements (
  id            SERIAL PRIMARY KEY,
  title_en      TEXT NOT NULL,
  title_mr      TEXT,
  body_en       TEXT,
  body_mr       TEXT,
  category      TEXT NOT NULL DEFAULT 'important' CHECK (category IN ('important','event','guest_lecture','training','exam')),
  link_url      TEXT,
  is_marquee    BOOLEAN NOT NULL DEFAULT FALSE,
  publish_from  DATE,
  publish_to    DATE,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS important_links (
  id              SERIAL PRIMARY KEY,
  title_en        TEXT NOT NULL,
  title_mr        TEXT,
  url             TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('exam_website','syllabus','exam_timetable','amrut','other')),
  examination_id  INT REFERENCES examinations(id) ON DELETE SET NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- NGOs / organisations / contributors ----------
CREATE TABLE IF NOT EXISTS contributors (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  organization        TEXT,
  contact_number      TEXT NOT NULL,
  email               TEXT,
  address             TEXT,
  photo_path          TEXT,
  contribution_type   TEXT NOT NULL CHECK (contribution_type IN ('donation','free_lecture','free_accommodation','free_course','csr','other')),
  other_specification TEXT,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','contacted','closed')),
  admin_remarks       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_lectures_date      ON lectures(lecture_date);
CREATE INDEX IF NOT EXISTS idx_travel_date        ON travel_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_resources_type     ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_subjects_exam      ON subjects(examination_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject     ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject  ON questions(subject_id);
