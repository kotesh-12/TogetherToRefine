import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';

import { PWAProvider } from './context/PWAContext';
import { LanguageProvider } from './context/LanguageContext';

// STANDARD IMPORTS (No Lazy Loading) - Stability Fix
import Login from './pages/Login';
import AccessDenied from './pages/AccessDenied';
import Student from './pages/Student';
import Teacher from './pages/Teacher';
import Institution from './pages/Institution';
import Admission from './pages/Admission';
import Profile from './pages/Profile';
import ProfileView from './pages/ProfileView';
import Group from './pages/Group';
import Allotment from './pages/Allotment';
import Details from './pages/Details';
import TTRAI from './pages/TTRAI';
import WaitingList from './pages/WaitingList';
import Attendance from './pages/Attendance';
import GeneralFeedback from './pages/GeneralFeedback';
import Exam from './pages/Exam';
import Health from './pages/Health';
import FeedbackOverview from './pages/FeedbackOverview';
import Report from './pages/Report';
import FourWayLearning from './pages/FourWayLearning';
import PendingApproval from './pages/PendingApproval';
import VideoLibrary from './pages/VideoLibrary';
import SelectFeedbackTarget from './pages/SelectFeedbackTarget';
import Notification from './pages/Notification';
import Timetable from './pages/Timetable';
import DownloadApp from './pages/DownloadApp';
import UpidHistory from './pages/UpidHistory';
import FacultyFeedback from './pages/FacultyFeedback';
import AdminDashboard from './pages/AdminDashboard';
import InstitutionDetailsAdmin from './pages/InstitutionDetailsAdmin';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import StudentFee from './pages/StudentFee';
import InstitutionFee from './pages/InstitutionFee';
import Announcements from './pages/Announcements';
import GovernmentReports from './pages/GovernmentReports';
import InspectorMode from './pages/InspectorMode';
import EarlyWarningSystem from './pages/EarlyWarningSystem';
import MarksManagement from './pages/MarksManagement';
import PerformanceAnalytics from './pages/PerformanceAnalytics';
import ParentDashboard from './pages/ParentDashboard';
import HomeworkSystem from './pages/HomeworkSystem';
import AttendanceAnalytics from './pages/AttendanceAnalytics';
import TimetableGenerator from './pages/TimetableGenerator';
import ExamSeatingPlanner from './pages/ExamSeatingPlanner';
import ViewExamSeating from './pages/ViewExamSeating';
import LibraryManagement from './pages/LibraryManagement';
import MessagingSystem from './pages/MessagingSystem';
import InspectionReadiness from './pages/InspectionReadiness';

import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import UpdateManager from './components/UpdateManager';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <UserProvider>
          <ThemeProvider>
            <PWAProvider>
              <Router>
                <UpdateManager />
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/details" element={<Details />} />
                  <Route path="/pending-approval" element={<PendingApproval />} />
                  <Route path="/download" element={<DownloadApp />} />
                  <Route path="/access-denied" element={<AccessDenied />} />

                  <Route element={<MainLayout />}>
                    {/* Common Routes (Accessible to all authenticated users) */}

                    <Route element={<ProtectedRoute allowedRoles={['student', 'teacher', 'institution', 'admin']} />}>
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile-view" element={<ProfileView />} />
                      <Route path="/group" element={<Group />} />
                      <Route path="/details" element={<Details />} /> {/* Sometimes needed for editing */}
                      <Route path="/general-feedback" element={<GeneralFeedback />} />
                      <Route path="/report-harassment" element={<Report type="sexual_harassment" />} />
                      <Route path="/report-misbehavior" element={<Report type="misbehavior" />} />
                      <Route path="/4-way-learning" element={<FourWayLearning />} />
                      <Route path="/health" element={<Health />} />
                      <Route path="/video-library" element={<VideoLibrary />} />
                      <Route path="/select-feedback-target" element={<SelectFeedbackTarget />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/timetable" element={<Timetable />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/timetable" element={<Timetable />} />
                      <Route path="/exam" element={<Exam />} />
                      <Route path="/announcements" element={<Announcements />} />
                      <Route path="/homework" element={<HomeworkSystem />} />
                      <Route path="/attendance-analytics" element={<AttendanceAnalytics />} />
                      <Route path="/view-exam-seating" element={<ViewExamSeating />} />
                      <Route path="/library" element={<LibraryManagement />} />
                    </Route>

                    {/* Admin Route */}
                    <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/institution/:id" element={<InstitutionDetailsAdmin />} />
                    </Route>

                    {/* Student Only */}
                    <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                      <Route path="/student" element={<Student />} />
                      <Route path="/upid-history" element={<UpidHistory />} />
                      <Route path="/fees/student" element={<StudentFee />} />

                    </Route>

                    {/* Teacher Only */}
                    <Route element={<ProtectedRoute allowedRoles={['teacher', 'institution']} />}>
                      <Route path="/gov-reports" element={<GovernmentReports />} />
                      <Route path="/inspector-mode" element={<InspectorMode />} />
                      <Route path="/dropout-predictor" element={<EarlyWarningSystem />} />
                      <Route path="/marks" element={<MarksManagement />} />

                      <Route path="/teacher" element={<Teacher />} />
                      <Route path="/feedback-overview" element={<FeedbackOverview />} />
                    </Route>

                    {/* Parent Only */}
                    <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
                      <Route path="/parent" element={<ParentDashboard />} />

                    </Route>

                    {/* Institution/Admin Only */}
                    <Route element={<ProtectedRoute allowedRoles={['institution']} />}>
                      <Route path="/timetable-generator" element={<TimetableGenerator />} />
                      <Route path="/exam-seating" element={<ExamSeatingPlanner />} />

                      <Route path="/inspection-readiness" element={<InspectionReadiness />} />
                      <Route path="/institution" element={<Institution />} />
                      <Route path="/admission" element={<Admission />} />
                      <Route path="/waiting-list" element={<WaitingList />} />
                      <Route path="/allotment" element={<Allotment />} />
                      <Route path="/notification" element={<Notification />} />
                      <Route path="/faculty-feedback" element={<FacultyFeedback />} />
                      <Route path="/fees/institution" element={<InstitutionFee />} />
                    </Route>
                  </Route>

                  {/* Standalone AI Page (Custom Layout) */}
                  <Route element={<ProtectedRoute allowedRoles={['student', 'teacher', 'institution', 'admin', 'parent']} />}>
                    <Route path="/ttr-ai" element={<TTRAI />} />
                    <Route path="/messages" element={<MessagingSystem />} />
                    <Route path="/analytics" element={<PerformanceAnalytics />} />
                  </Route>
                </Routes>
              </Router>
            </PWAProvider>
          </ThemeProvider>
        </UserProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
