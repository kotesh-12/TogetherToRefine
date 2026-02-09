import React, { Suspense, lazy } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';

// Lazy loading components for better optimization
const Login = lazy(() => import('./pages/Login?v=0049'));
const AccessDenied = lazy(() => import('./pages/AccessDenied?v=0049'));
const Student = lazy(() => import('./pages/Student?v=0049'));
const Teacher = lazy(() => import('./pages/Teacher?v=0049'));
const Institution = lazy(() => import('./pages/Institution?v=0049'));
const Admission = lazy(() => import('./pages/Admission?v=0049'));
const Profile = lazy(() => import('./pages/Profile?v=0049'));
const ProfileView = lazy(() => import('./pages/ProfileView?v=0049'));
const Group = lazy(() => import('./pages/Group?v=0049'));
const Allotment = lazy(() => import('./pages/Allotment?v=0049'));
const Details = lazy(() => import('./pages/Details?v=0049'));
const TTRAI = lazy(() => import('./pages/TTRAI?v=0049'));
const WaitingList = lazy(() => import('./pages/WaitingList?v=0049'));
const Attendance = lazy(() => import('./pages/Attendance?v=0049'));
const GeneralFeedback = lazy(() => import('./pages/GeneralFeedback?v=0049'));
const Exam = lazy(() => import('./pages/Exam?v=0049'));
const Health = lazy(() => import('./pages/Health?v=0049'));
const FeedbackOverview = lazy(() => import('./pages/FeedbackOverview?v=0049'));
const Report = lazy(() => import('./pages/Report?v=0049'));
const FourWayLearning = lazy(() => import('./pages/FourWayLearning?v=0049'));
const PendingApproval = lazy(() => import('./pages/PendingApproval?v=0049'));
const VideoLibrary = lazy(() => import('./pages/VideoLibrary?v=0049'));
const SelectFeedbackTarget = lazy(() => import('./pages/SelectFeedbackTarget?v=0049'));
const Notification = lazy(() => import('./pages/Notification?v=0049'));
const Timetable = lazy(() => import('./pages/Timetable?v=0049'));
const DownloadApp = lazy(() => import('./pages/DownloadApp?v=0049'));
const UpidHistory = lazy(() => import('./pages/UpidHistory?v=0049'));
const FacultyFeedback = lazy(() => import('./pages/FacultyFeedback?v=0049'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard?v=0049'));
const InstitutionDetailsAdmin = lazy(() => import('./pages/InstitutionDetailsAdmin?v=0049'));
const Onboarding = lazy(() => import('./pages/Onboarding?v=0049'));
const Settings = lazy(() => import('./pages/Settings?v=0049'));
const StudentFee = lazy(() => import('./pages/StudentFee?v=0049'));
const InstitutionFee = lazy(() => import('./pages/InstitutionFee?v=0049'));
const Announcements = lazy(() => import('./pages/Announcements?v=0049'));


import ProtectedRoute from './components/ProtectedRoute';
const MainLayout = lazy(() => import('./components/MainLayout?v=0049'));

import UpdateManager from './components/UpdateManager';
import GlobalLoader from './components/GlobalLoader';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <ThemeProvider>
          <Router>
            <UpdateManager />
            <Suspense fallback={<GlobalLoader />}>
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
                  <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
                    <Route path="/teacher" element={<Teacher />} />
                    <Route path="/feedback-overview" element={<FeedbackOverview />} />
                  </Route>

                  {/* Institution/Admin Only */}
                  <Route element={<ProtectedRoute allowedRoles={['institution']} />}>
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
                <Route element={<ProtectedRoute allowedRoles={['student', 'teacher', 'institution', 'admin']} />}>
                  <Route path="/ttr-ai" element={<TTRAI />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </ThemeProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
