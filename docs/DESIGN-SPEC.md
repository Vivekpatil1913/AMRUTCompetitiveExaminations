# विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम
## AMRUT Competitive Examination Training & Study Portal – Design & UI Specification

| | |
|---|---|
| Organisation | AMRUT – Academy of Maharashtra Research, Upliftment and Training (महाराष्ट्र संशोधन, उन्नती व प्रशिक्षण प्रबोधिनी), Government of Maharashtra |
| Document | Sitemaps, wireframes, design system, page specification, journeys, access control, HOLD items, priorities |
| Status | Phase 1 + Phase 2 frontend implemented as a working prototype. HOLD items are not implemented. |
| Technology | Node.js (Express + EJS server-rendered pages) · PostgreSQL (pgAdmin) · AWS deployment |

Conventions: **HOLD** = *HOLD – REQUIREMENT CONFIRMATION REQUIRED*. In the UI, HOLD items carry a striped amber `HOLD` tag or a dashed HOLD box. Every Mahaamrut connection point carries a blue dashed box: *Mahaamrut Integration – Technical Discussion Required*.

---

## 1. Public website sitemap

```
/                         Landing page (11 sections)
├── /about                About Programme (objectives, user categories, proposed advisory persons)
├── /examinations         Competitive Examinations (admin-configured list)
│   └── /examinations/:id   Exam → Stage → Subject → Topic tree, official links, courses, lectures
├── /courses              Course categories (chips) + courses
│   └── /courses/:id        Subjects & topics, offline batches, upcoming lectures, resources
├── /training             Online vs offline training, offline batches, deposit note
│   └── /centres            Offline centres
├── /lectures             Upcoming / past lectures (filter: type, mode)
│   └── /lectures/:id       Lecture detail (link gated by visibility)
├── /timetable            Training timetable (filter: exam, course, subject, mode, date range)
├── /resources            Learning resources (tabs by type; filter exam/course/subject/topic)
│   └── /study-material     Exam → Course → Subject → Topic → PDF (gated download)
├── /yatra                स्पर्धा परीक्षा यात्रा (lecturer travel schedule)
├── /announcements        Announcements (tabs by category)
├── /important-links      Official links (by category + exam-wise table)
├── /contribute           Support / Contribute form (NGOs, organisations, individuals)
├── /register             REGISTER / APPLY → hand-off page → Mahaamrut registration URL
├── /login                Candidate login (prototype; method HOLD) · /login/help
├── /journey              Prototype: complete candidate journey (clickable)
├── /design-system        Living design system
└── /admin/login          Admin login
```

## 2. Public landing page wireframe

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ▮ महाराष्ट्र शासन | AMRUT                          A- A A+   [English]    │  Government top bar
├───────────────────────────────────────────────────────────────────────────┤
│ [Emblem] AMRUT │ विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम     [LOGIN] [REGISTER / APPLY] │
│               │ Academy of Maharashtra Research, Upliftment & Training             │
├───────────────────────────────────────────────────────────────────────────┤
│ Home | About | Examinations | Courses | Training | Lectures | Timetable | │  Orange nav
│ Learning Resources | स्पर्धा परीक्षा यात्रा | Announcements | Important Links│
├───────────────────────────────────────────────────────────────────────────┤
│ [Highlights] ◆ Guest lecture … ◆ Booking open … ◆ …            (pause ‖) │  Marquee
├───────────────────────────────────────────────────────────────────────────┤
│ 1 HERO: programme title, subtitle,           │ How to join (4 steps)      │
│   [REGISTER / APPLY →] [LOGIN]               │ [View complete journey]    │
├───────────────────────────────────────────────────────────────────────────┤
│ 2 About the Programme (text)                 │ What the programme provides│
│ 3 Competitive Examinations   [card][card][card] / [card][card][card]     │
│ 4 Courses / Training Programmes  [Foundation][Preparatory][UPSC][MPSC]…  │
│ 5 Upcoming Training / Timetable  (table: date, time, exam, lecture, …)   │
│ 6 Guest & Special Lectures  [type chips]  [lecture card][lecture card]   │
│ 7 स्पर्धा परीक्षा यात्रा (timeline)          │ Proposed advisory persons  │
│ 8 Learning Resources  [Question Bank][Videos][YouTube][Guest][Study][PDF]│
│ 9 Study Material  Exam→Course→Subject→Topic→PDF │ access note + HOLD box  │
│10 Announcements (table)                       │11 Important Links        │
│   Support / Contribute band  [Support / Contribute →]                     │
├───────────────────────────────────────────────────────────────────────────┤
│ Footer: brand · quick links · for candidates · contact (AMRUT Pune)       │
└───────────────────────────────────────────────────────────────────────────┘
```

## 3. Logged-in candidate sitemap (`/portal`)

```
/portal                        Competitive Examination Study Dashboard
Learning
├── /portal/courses            My Courses → /portal/courses/:id ?tab=subjects|lectures|material|tests
├── /portal/subjects           My Subjects → /portal/subjects/:id
├── /portal/study-material     Study Material (access-controlled; paid subscription HOLD)
├── /portal/resources          Videos / YouTube / Question bank files / Guest lecture resources / PDFs
├── /portal/question-bank      MCQ practice → POST check → correct answers shown
├── /portal/tests              Online Tests → /tests/:id (instructions) → /attempts/:id → /attempts/:id/result
├── /portal/results            Test Results
└── /portal/assessment         Psychological / Aptitude Assessment (framework, HOLD)
Schedule
├── /portal/lectures           My Lectures (upcoming | past | my courses) → /portal/lectures/:id
├── /portal/timetable          Candidate timetable (filters; "my courses only")
├── /portal/guest-lectures     Guest / guidance / special lectures
└── /portal/yatra              स्पर्धा परीक्षा यात्रा
Offline training
├── /portal/offline            Offline courses & batches → /portal/offline/book/:batchId
├── /portal/bookings           My bookings (status, proof, refund HOLD)
└── /portal/centres            Centres
Information
├── /portal/announcements · /portal/links · /portal/profile
└── Logout (POST /logout)
```

## 4. Candidate dashboard wireframe

```
┌ Sidebar ───────────┬───────────────────────────────────────────────────────┐
│ (S) Candidate name │ Competitive Examination Study Dashboard                │
│     ID: DEMO-001   │ ┌ Welcome, <name> ───────────────────────── [Profile] ┐│
│ ▣ Dashboard        │ │ Candidate ID · Name · Registration ● · Verification ●││
│ LEARNING           │ │ Category · Selected course · Selected examination    ││
│  My Courses        │ └──────────────────────────────────────────────────────┘│
│  My Subjects       │ (pending/rejected → alert: limited access)              │
│  Study Material    │ Quick access (tiles with counts):                        │
│  Videos            │ [My Courses][My Subjects][Study Material][Question Bank] │
│  Question Bank     │ [Videos][YouTube][Upcoming Lectures][Timetable][Tests]   │
│  Online Tests      │ [Results][Guest Lectures][यात्रा][Announcements][Links]  │
│  Test Results      │ ┌ Upcoming lectures (5) ──────────┐ ┌ Announcements ──┐ │
│  Assessment        │ │ [date] title · speaker · mode   │ │ …               │ │
│ SCHEDULE …         │ └─────────────────────────────────┘ ├ स्पर्धा परीक्षा  │ │
│ OFFLINE TRAINING … │ ┌ My Courses (progress = lectures │ │ यात्रा (next)   │ │
│ INFORMATION …      │ │ completed / total)              │ └─────────────────┘ │
└────────────────────┴───────────────────────────────────────────────────────┘
No revenue charts, analytics graphs or dark mode. On mobile the sidebar becomes an off-canvas menu and tiles go two per row.
```

## 5. Admin panel sitemap (`/admin`)

| Group | Menu items (route) |
|---|---|
| Overview | Dashboard (`/admin`) – counts, upcoming lectures, latest bookings, contributor requests, pending decisions |
| Candidates | Users / Candidates (`/admin/candidates`, detail: profile, category, verification status & remarks, Candidate ID, course assignment, study-material permission, per-resource grants, bookings, test results, prototype password) · Verification (pending filter) |
| Academic Structure | Examinations · Exam Stages · Course Categories · Courses (with subjects M2M) · Subjects · Topics / Sub-parts (nested) |
| Offline Training | Offline Bookings · Payments / Transaction Proofs · Refunds (HOLD) · Centres · Batches (dates, seats, accommodation, deposit applicability & amount) |
| Lectures & Schedules | Timetable (date view) · Lectures · Guest Lectures · Speakers / Resource Persons · स्पर्धा परीक्षा यात्रा |
| Tests & Assessment | Question Bank (MCQ) · Tests (+ question assignment) · Assessment (HOLD framework) |
| Learning Resources | Study Material (PDF) · Videos · YouTube Resources · Question Bank Files · Guest Lecture Resources · Other PDFs |
| Communication | Announcements (marquee flag, publish window) · Contributors / NGOs (status, remarks) |
| Website | Website Content (hero, intro, about, accommodation, contribute) · Important Links · General, Logo & Favicon · Footer · Mahaamrut Integration (registration URL) · Payment Settings (instructions, QR) · Admin Roles (HOLD) |

The admin panel is a small, config-driven CRUD layer (`src/admin/resources.js`) covering **only** the entities above. It is not a generic CMS.

## 6. Design system

The full live reference is at `/design-system`, defined in `public/css/amrut.css`. The visual language comes from mahaamrut.org.in.

| Token | Value | Use |
|---|---|---|
| `--amrut-400` | `#dd792e` | AMRUT brand orange (accents, rules, large text) |
| `--amrut-500` | `#cd5a21` | Labels, date tiles, marquee label |
| `--amrut-600` | `#b4501d` | Primary buttons & nav bar (WCAG AA with white) |
| `--amrut-700 / 800` | `#a25726 / #7a3c17` | Hover, hero heading |
| `--amrut-900` | `#4a230d` | Government top bar, footer |
| `--amrut-100 / 200` | `#fff7ed / #f6ede4` | Cream surfaces, table headers |
| Status | success `#15803d`, info `#1d4ed8`, warning `#9a4a07`, danger `#b91c1c` | Alerts, badges |
| Typography | **Baloo 2** (headings) · **Poppins** (body). Both support Devanagari | Marathi + English |

The library covers:
- **Actions and labels:** buttons (primary, secondary, outline, ghost, danger, sm/lg, disabled, loading), badges (ONLINE/OFFLINE/status/lock), status dots, HOLD tag and box, integration-point box.
- **Feedback:** alerts.
- **Data entry and display:** form fields (required marker, help, error), select, radio choices, checkbox, file drop zone, data tables (stack into cards on phones), tabs, chips, pagination, step indicators (vertical/horizontal), progress bar.
- **Layout and content:** cards (accent, link, quick-access, lecture, person), timeline, tree, definition list, modal.
- **States:** empty, skeleton/spinner.
- **Page structure:** top bar (text-size A-/A/A+, language switch), header, sticky nav, marquee with pause, footer with tricolour rule, portal/admin shell with sidebar.

## 7. Page-by-page UI specification

| Page | Route | Key content | Data source (admin-managed) |
|---|---|---|---|
| Landing | `/` | Hero, intro, exam cards, course categories, timetable (next 6), lecture highlights, यात्रा, resource categories, study material, announcements, links, advisory persons, contribute CTA | site_content, examinations, course_categories, lectures, travel_schedules, resources, announcements, important_links, speakers |
| About | `/about` | Programme text, objectives, user-category table (verification type), proposed advisory persons (HOLD responsibilities) | site_content, speakers |
| Examinations | `/examinations[/:id]` | Exam cards; detail = stage→subject→topic tree, unit-test counts, official syllabus/timetable/website links (HOLD if empty), courses, upcoming lectures | examinations, exam_stages, subjects, topics, tests |
| Courses | `/courses[/:id]` | Category chips; course cards (exam, subjects, duration "as per batch"); detail = subjects/topics, offline batches, lectures, resources | course_categories, courses, course_subjects |
| Training / Centres | `/training`, `/centres` | Online vs offline explanation, offline batch table (period, accommodation, deposit or HOLD, booking status), deposit note, HOLD list; centres (HOLD structure) | batches, centres, settings |
| Lectures | `/lectures[/:id]` | Upcoming/past tabs, type & mode filters, lecture cards; detail with join link gated by visibility | lectures, speakers |
| Timetable | `/timetable` | Filters (exam, course, subject, mode, from/to), table: date, time, exam/course, lecture, subject, mode, centre/online link, remarks; today highlighted | lectures |
| यात्रा | `/yatra` | Timeline: person, date, time, place, remarks; today highlighted; HOLD box on scheduling logic | travel_schedules |
| Resources | `/resources` | Type tabs with counts, filters, resource cards with Download/Open or lock reason | resources, resource_grants |
| Study Material | `/study-material` | Exam→Course→Subject→Topic→PDF tree; gated downloads; paid subscription HOLD | resources (study_material) |
| Announcements / Links | `/announcements`, `/important-links` | Category tabs; link groups and exam-wise official links (HOLD where empty) | announcements, important_links, examinations |
| Contribute | `/contribute` | Form: name*, organisation, contact*, email, address, photo, contribution type*, other (conditional), description; HOLD on final fields & notifications | contributors |
| Register | `/register` | Category/verification table, steps, **Continue to Mahaamrut portal** (configurable URL), integration box | settings |
| Login | `/login` | Candidate ID / mobile + password (prototype), OTP tab disabled (HOLD), forgot/help, back to website, integration box | candidates |
| Portal pages | `/portal/*` | See §3 and §4 | all of the above + enrollments, tests, attempts, offline_bookings |
| Admin | `/admin/*` | See §5 | all tables |

## 8. Component list

| Area | Components | Notes |
|---|---|---|
| Partials | `topbar`, `brand`, `header`, `marquee`, `footer`, `flash`, `page-header`, `hold`, `empty`, `mode-badge`, `lecture-card`, `timetable-table`, `resource-card` | in `src/views/partials` |
| Portal helpers | `_select`, `_tree`, `_progress`, `_test-steps`, `_test-list`, `_mcq`, `_status`, `_payment` | in `src/views/portal` |
| Admin | generic `list`, generic `form` (text, textarea, url, number, money, date, time, checkbox, select, ref, m2m, file, readonly) | driven by `src/admin/resources.js` |

## 9. User journeys

**General user**: Registration (Mahaamrut) → redirect to training platform → verification/access as applicable → browse courses/exams → view subjects/resources → view timetable → attend online/offline training → take online tests where applicable → access relevant learning resources.

**Offline course user**: Registration → select course/batch → select accommodation requirement → follow applicable payment/security-deposit process → upload transaction proof where required → submit registration → attend training → course completion → refund process as per finalised policy (HOLD).

**Prototype journey (clickable at `/journey`)**: Landing → REGISTER / APPLY → Mahaamrut portal → registration/application → Mahaamrut verification → successful verification (simulation screen) → candidate accesses portal → LOGIN → Dashboard → My Course → Examination → Subject → Study Material → Lecture → Timetable → Question Bank → Online Test → Result.

**Online test flow**: Select test → Instructions (HOLD rules listed) → Start → Questions (fixed order) → Submit → Result: score (= correct answers), correct, incorrect, unanswered, and every question with the correct answer highlighted immediately.

## 10. Registration integration flow

```
This portal                         Mahaamrut (existing)                 This portal
───────────                         ────────────────────                 ───────────
[REGISTER / APPLY] ─► /register ─► settings.mahaamrut_register_url ─► registration / application
                                                                      ─► verification (EWS: लक्षित गट;
                                                                          caste: Non-लक्षित गट)
                                         ┄┄┄┄┄┄ INTEGRATION POINT (HOLD) ┄┄┄┄┄┄
                                         how verified candidate + unique ID reach this portal
                                         (API / SSO / redirect token / data sync – NOT decided)
                                                                      ─► /login ─► /portal
```

Prototype behaviour:
- The candidate table holds `candidate_uid` (format HOLD), `mahaamrut_ref`, category and verification status.
- Admins can add or update candidates manually until the integration is defined.
- Login uses Candidate ID or mobile plus a password. This is a prototype stand-in only and is clearly labelled.
- The only touch-points to replace later are the `/login` handler and the candidate provisioning. No page design depends on the chosen mechanism.

## 11. Access-control concept

| Level (`resources.access_level` / `lectures.visibility`) | Public | Logged-in candidate | Verified | Verified लक्षित गट | Admin-permitted (flag or per-resource grant) |
|---|---|---|---|---|---|
| `public` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `registered` | – | ✔ | ✔ | ✔ | ✔ |
| `verified` | – | – | ✔ | ✔ | ✔ (grant) |
| `lakshit_or_permitted` (study material) | – | – | – | ✔ | ✔ |

- Access is configured per resource and per lecture by Admin. Nothing is hard-coded per page.
- Downloads go through `/files/resource/:id`, which runs an access check. Private uploads are never served as static files.
- Transaction proofs are visible only to the uploading candidate and to admins.
- Offline booking requires a verified candidate.
- Final access-control rules and admin roles are **HOLD**.

## 12. Responsive layouts

| Breakpoint | Behaviour |
|---|---|
| ≥ 1100 px | Full nav bar, 3–4 column grids, split layouts (content + aside) |
| 960–1100 px | Grids drop to 2 columns, footer 2 columns |
| ≤ 960 px | Hamburger menu for public nav; portal/admin sidebar becomes off-canvas (Esc/overlay closes); hero and split layouts stack |
| ≤ 720 px | Tables become labelled card rows; forms single column; quick-access tiles 2 per row; header actions compact; ≥ 42–46 px touch targets |
| ≤ 420 px | Logo divider hidden; emblem + programme title only |

## 13. Empty / loading / error / success states

| State | Implementation |
|---|---|
| Empty | `partials/empty` – icon, title, hint (every list, table and tree) |
| Loading | Forms with `data-loading` disable the submit button and show a spinner (prevents double submission); skeleton styles available |
| Error | Field-level `aria-invalid` + `.field-error`, a form-level alert, HTTP 422 re-render with previous values; 403/404/500 page; FK-safe delete message in admin |
| Success | Flash alerts after save/submit; contribute "thank you" page; booking → "My bookings" with status |
| Access | Lock badges with the reason (login / verification / लक्षित गट); redirect to login with return URL |

## 14. HOLD items (not implemented – UI/framework only)

| # | Item | Where it is visible |
|---|---|---|
| 1 | Mahaamrut → study-portal authentication mechanism | Login, Register, Journey, Profile, Admin › Candidates & Integration settings |
| 2 | Redirect / API / SSO implementation | Register, Journey (simulation screen) |
| 3 | Candidate login method (password vs OTP etc.) | Login (OTP tab disabled), Login help |
| 4 | Unique user ID format | Admin candidate form, Journey simulation |
| 5 | Exact eligibility rules (लक्षित गट / Non-लक्षित गट) | About, Register |
| 6 | Verification documents | About, Register, Admin candidate |
| 7 | Verification authority | Register, Admin candidate |
| 8 | Verification approval / rejection workflow | Admin candidate (status set manually) |
| 9 | Final course/exam/subject hierarchy | Configurable (stages, M2M, nested topics) |
| 10 | Exact timetable fields | Timetable pages |
| 11 | Lecturer travel automation logic | यात्रा pages, Admin |
| 12–13 | Psychological assessment questions / scoring | Portal Assessment, Admin Assessment |
| 14–17 | MCQ negative marking, randomisation, scoring rules, question count | Test instructions, results, Admin Tests |
| 18 | Payment gateway | Booking form, Admin Payment settings |
| 19 | Payment account / bank arrangement | Booking form (QR not set), Admin Payment settings |
| 20 | Security deposit final amount & applicability | Batch config (`hold` default), Training page |
| 21 | Refund policy | Bookings (refund status HOLD), Admin Refunds |
| 22 | Accommodation workflow | Booking form, Training |
| 23 | Centre structure | Centres pages, Admin Centres |
| 24–26 | WhatsApp / email / SMS provider | Contribute, Login help |
| 27 | Admin roles & permissions | Admin login, Admin Roles |
| 28 | Contributor final form fields | Contribute |
| 29 | External examination links | Exam detail, Important links (HOLD where empty) |
| 30 | Paid subscription for study material | Study Material pages |
| 31 | Final content approval workflow | Admin Roles |
| + | Offline course duration (75-day vs 15-day inconsistency) | Configurable per course/batch, never hard-coded |
| + | Advisory persons' names (illegible in the source PDF except Mr. M. R. Deshpande) and responsibilities | Seeded as "Resource Person n (name to be updated)" – edit in Admin › Speakers |

## 15. Development priority & status

| Phase | Items | Status |
|---|---|---|
| **1 – Immediate** | AMRUT design system · landing page · header/footer/nav · registration CTA · login UI · dashboard UI · course/exam/subject/topic management · learning resources · lectures · timetable · स्पर्धा परीक्षा यात्रा · admin panel · responsive · Marathi/English | **Done** (prototype) |
| **2** | Candidate access framework · verification status framework · unique ID field · study-material access control & grants · question bank · online tests · results · offline courses · batches · centres · offline booking · accommodation selection · transaction proof upload | **Done** (framework; HOLD rules not applied) |
| **3 – After confirmation** | Mahaamrut authentication integration · registration-to-portal redirect · psychological assessment · payment gateway · refund workflow · notifications (WhatsApp/email/SMS) · final access-control rules · admin roles · other HOLD items | **Not started** – awaiting decisions |

Before production, the technical architecture still needs to be finalised: AWS services, file storage, backups, monitoring and SLA. These are intentionally not specified here.
