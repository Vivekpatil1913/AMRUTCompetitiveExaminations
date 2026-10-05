// Portal-specific strings (namespace: pt)
module.exports = {
  // General
  title: 'Title', notFound: 'The page you are looking for was not found, or you do not have access to it.',
  general: 'General', sections: 'Sections', categories: 'Categories', actions: 'Actions', newTab: 'opens in a new tab',
  countAvailable: '{n} item(s)', openSection: 'Open', available: 'Available', notAvailable: 'Not available',
  address: 'Address', contact: 'Contact', mobile: 'Mobile number', email: 'Email', viewMap: 'View on map', watch: 'Watch',

  // Dashboard
  dashboardLead: 'Your courses, lectures, learning resources and tests in one place.',
  limitedAccessTitle: 'Limited access.',
  limitedAccessPending: 'Your verification through Mahaamrut is pending. Some study material, lectures and offline bookings are available only to verified candidates.',
  limitedAccessRejected: 'Your verification was not successful. Some study material, lectures and offline bookings are available only to verified candidates. Please contact the programme office.',
  verificationRemarks: 'Verification remarks',
  noUpcoming: 'No upcoming lectures', noUpcomingHint: 'Upcoming lectures of your enrolled courses will appear here.',
  noCourses: 'No enrolled courses', noCoursesHint: 'You are not enrolled in any course yet. Enrolment is managed by the programme office.',
  noAnnouncements: 'No announcements at the moment.', noYatra: 'No upcoming schedule entries.',

  // Courses & subjects
  coursesLead: 'Courses you are enrolled in, with batch, mode and lecture progress.',
  centreOrOnline: 'Centre / Online', lecturesCompleted: 'Lectures completed',
  progressNote: 'Progress shows the number of scheduled lectures of the course whose date has passed, out of all lectures of the course.',
  subjectsLead: 'Subjects of your enrolled courses, grouped by examination.',
  noSubjects: 'No subjects found', noTopics: 'No topics added yet.', practice: 'Practice',

  // Study material & resources
  materialLead: 'Subject-wise study material for your preparation.',
  materialAccessNote: 'Available only for registered लक्षित गट candidates or candidates specially permitted by Admin.',
  noMaterial: 'No study material found',
  paidHoldTitle: 'Paid subscription for study material – HOLD',
  paidHoldText: 'Paid subscription for study material is not implemented. HOLD – REQUIREMENT CONFIRMATION REQUIRED.',
  resourcesTitle: 'Learning Resources', resourcesLead: 'Videos, YouTube resources, question banks, guest lecture resources and PDFs.',
  resourceTypes: 'Resource types',
  youtubeNote: 'Some YouTube links are available only to registered / verified users; not all content is private. Videos open on YouTube in a new tab.',

  // Question bank
  qbLead: 'Practise multiple-choice questions by examination, subject and topic.',
  qbPdfs: 'Question bank PDFs', practiceSize: 'Practice size (questions)',
  practiceSizeHelp: 'Number of questions to show for this practice session (1–50). This is not an examination rule.',
  qbNotStored: 'Practice answers are checked instantly and are not stored.',
  noQuestions: 'No questions found', practiceResult: 'Practice result', checkAnswers: 'Check answers', tryAgain: 'Practise again',
  question: 'Question', questions: 'Questions', correct: 'Correct', incorrect: 'Incorrect', unanswered: 'Unanswered', score: 'Score',
  correctAnswer: 'Correct answer', yourAnswer: 'Your answer',

  // Tests
  testsLead: 'Lecture tests, unit tests and practice tests for your courses.',
  test: 'Test', testType: { lecture: 'Lecture test', unit: 'Unit test', practice: 'Practice test' },
  linkedLecture: 'Linked lecture', lastResult: 'Last result', notAttempted: 'Not attempted', openTest: 'Open test', takeTest: 'Take test',
  noTests: 'No tests available', noTestsHint: 'Tests published for your courses will appear here.',
  testProgress: 'Test progress', stepSelect: 'Select Test', stepInstructions: 'Instructions', stepQuestions: 'Questions', stepSubmit: 'Submit', stepResult: 'Result',
  instructions: 'Instructions', noInstructions: 'Instructions will be provided by the programme office.',
  startTest: 'Start Test', resumeTest: 'Resume Test', noQuestionsYet: 'Questions have not been added to this test yet.',
  testRulesHold: 'The following test rules are pending confirmation and are NOT applied:',
  holdNegative: 'Negative marking – HOLD', holdRandom: 'Question randomization – HOLD (questions are shown in the configured order)',
  holdCount: 'Number of questions per test – HOLD', holdScoring: 'Scoring rules / weightage – HOLD (currently 1 per correct answer)',
  holdTime: 'Time limit – HOLD (no timer applied)', holdAttempts: 'Number of attempts allowed – HOLD',
  attemptLead: 'Select one answer for each question and submit. Correct answers are shown immediately after submission.',
  unansweredNote: 'Questions left blank are counted as unanswered.', confirmSubmit: 'Submit your answers now? You cannot change them after submission.',
  submitTest: 'Submit Test', testSubmitted: 'Your test has been submitted.', testResult: 'Test Result',
  scoreNote: 'Score = number of correct answers. Negative marking and final scoring rules:', answerReview: 'Answer review',
  resultsLead: 'Your submitted tests and scores.', submittedOn: 'Submitted on', viewResult: 'View result',
  noResults: 'No test results yet', noResultsHint: 'Results of tests you submit will appear here.',

  // Assessment
  assessmentTitle: 'Psychological / Aptitude Assessment', assessmentLead: 'Assessment framework – Adaptability, Interest and Career Counselling.',
  conductedBy: 'Conducted by',
  assessmentHold: 'Actual test structure, questions, scoring and result format: HOLD – Management Discussion Required.',

  // Lectures
  lecturesLead: 'Regular lectures, guest lectures, guidance and special sessions.', guestLead: 'Guest lectures, special lectures and guidance sessions.',
  myCourseLectures: 'My courses', noLectures: 'No lectures found',
  linkSoon: 'Link will be shared before the session.', recording: 'Recording',
  lectureTests: 'Tests for this lecture', noLectureTests: 'No test is linked to this lecture.',

  // Timetable
  timetableLead: 'Training timetable of online and offline sessions.', timetableHold: 'Exact timetable fields – HOLD',
  fromDate: 'From date', toDate: 'To date', myCoursesOnly: 'My courses only',
  timetableEmptyMine: 'No sessions for your courses in this period. Untick “My courses only” to see all sessions.',

  // Yatra
  yatraLead: 'Upcoming / current schedule of lecturers and resource persons.',
  yatraHold: 'Detailed scheduling / automation logic – HOLD. Currently shows published entries from today onward, ordered by date & time.',

  // Offline courses & booking
  offlineLead: 'Offline training batches at centres. Lectures are free of cost.',
  depositNoteFallback: 'Lectures are free; this is a refundable SECURITY DEPOSIT, not a fee.',
  noBatches: 'No offline batches available', accommodation: 'Accommodation', bookingOpen: 'Booking open', deposit: 'Security deposit',
  depositHoldShort: 'Applicability to be confirmed',
  depositApp: { not_applicable: 'Not applicable', accommodation_only: 'Only if accommodation is required', all_participants: 'All participants' },
  yourBooking: 'Your booking', bookingClosed: 'Booking is not open for this batch.', registerBook: 'Register / Book',
  verifiedOnlyBook: 'Only verified candidates can register / book offline batches.',
  alreadyBooked: 'You have already registered for this batch.',
  bookTitle: 'Offline Course Registration', bookingSteps: 'Registration steps',
  bstepCourse: 'Select Course', bstepBatch: 'Select Batch', bstepCentre: 'Select Centre', bstepProof: 'Transaction Proof',
  fixErrors: 'Please correct the following:', selectedBatch: 'Selected course, batch & centre', contactDetails: 'Contact details',
  accommodationRequired: 'Accommodation required?', accommodationNA: 'Accommodation is not available for this batch.',
  accommodationHold: 'Accommodation workflow – HOLD.',
  securityDeposit: 'Security deposit',
  depositHoldTitle: 'Security deposit applicability – HOLD',
  depositHoldText: 'Whether a security deposit applies to this batch is pending management confirmation. No payment is required now.',
  noDeposit: 'No security deposit applies to this batch.',
  depositAccOnlyHelp: 'For this batch the security deposit applies only if accommodation is required.',
  depositAmount: 'Deposit amount', qrAlt: 'Payment QR code for the security deposit',
  qrHoldTitle: 'Payment scanner / account – HOLD', qrHoldText: 'Payment account / QR details are not finalised. HOLD – REQUIREMENT CONFIRMATION REQUIRED.',
  gatewayHoldTitle: 'Payment gateway – HOLD',
  gatewayHoldText: 'No online payment gateway (Razorpay / Cashfree / PayU / UPI API) is integrated. Pay as instructed and upload the transaction proof.',
  transactionRef: 'Transaction reference / UTR number', transactionRefHelp: 'As shown in your payment app or bank receipt.',
  transactionProof: 'Transaction screenshot', proofHelp: 'Choose an image (PNG / JPG / WEBP) or PDF – max 10 MB',
  remarksLabel: 'Anything you would like the programme office to know', submitBooking: 'Submit registration',
  errMobile: 'Enter your mobile number.', errMobileFormat: 'Enter a valid mobile number (10–20 digits).', errEmail: 'Enter a valid email address.',
  errAccommodation: 'Select whether accommodation is required.', errAccommodationNA: 'Accommodation is not available for this batch.',
  errProof: 'Upload the transaction screenshot for the security deposit.', errReupload: 'Please select the transaction screenshot again.',
  bookingSuccess: 'Your offline course registration has been submitted. The programme office will review it.',

  // Bookings
  bookingsLead: 'Your offline course registrations, deposit and booking status.',
  bookingProcess: 'Booking process', pstepSubmit: 'Submit registration', pstepAttend: 'Attend training', pstepComplete: 'Course completion',
  pstepRefund: 'Refund process (as per finalised policy)',
  paymentStatus: 'Payment status', bookingStatus: 'Booking status', refundStatus: 'Refund status',
  noBookings: 'No bookings yet', noBookingsHint: 'Register for an offline batch from the Offline Courses page.',
  refundHold: 'Refund of the security deposit after course completion – rules and process are pending the finalised policy.',

  // Centres
  centresLead: 'Offline training centres and batches.', centreHold: 'Exact centre structure – HOLD', centreNo: 'Centre No.',
  noCentres: 'No centres available', batchesHere: 'Batches at this centre',

  // Announcements & links
  announcementsLead: 'Important announcements, events, guest lectures, training and exam updates.',
  linksLead: 'Official examination websites, syllabus, timetables and other resources.', noLinks: 'No links available',

  // Profile
  profileLead: 'Your registration and verification details.',
  enrolledCourses: 'Enrolled courses', materialPermission: 'Study material permission',
  permittedByAdmin: 'Specially permitted by Admin', permittedLakshit: 'Permitted (verified लक्षित गट)', notPermitted: 'Not permitted',
  grantsCount: '{n} individual resource(s) granted by Admin',
  profileIntegration: 'Profile data is expected to come from the Mahaamrut registration system.',
  profileEditHold: 'Editable fields – HOLD (to be confirmed before implementation).',
};
