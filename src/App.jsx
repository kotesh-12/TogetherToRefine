import React, { Suspense, lazy } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';

// Lazy loading components for better optimization
const Login = lazy(() => import('./pages/Login'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));
const Student = lazy(() => import('./pages/Student'));
const Teacher = lazy(() => import('./pages/Teacher'));
const Institution = lazy(() => import('./pages/Institution'));
const Admission = lazy(() => import('./pages/Admission'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileView = lazy(() => import('./pages/ProfileView'));
const Group = lazy(() => import('./pages/Group'));
const Allotment = lazy(() => import('./pages/Allotment'));
const Details = lazy(() => import('./pages/Details'));
const TTRAI = lazy(() => import('./pages/TTRAI'));
const WaitingList = lazy(() => import('./pages/WaitingList'));
const Attendance = lazy(() => import('./pages/Attendance'));
const GeneralFeedback = lazy(() => import('./pages/GeneralFeedback'));
const Exam = lazy(() => import('./pages/Exam'));
const Health = lazy(() => import('./pages/Health'));
const FeedbackOverview = lazy(() => import('./pages/FeedbackOverview'));
const Report = lazy(() => import('./pages/Report'));
const FourWayLearning = lazy(() => import('./pages/FourWayLearning.jsx'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const VideoLibrary = lazy(() => import('./pages/VideoLibrary'));
const SelectFeedbackTarget = lazy(() => import('./pages/SelectFeedbackTarget'));
const Notification = lazy(() => import('./pages/Notification'));
const Timetable = lazy(() => import('./pages/Timetable'));
const DownloadApp = lazy(() => import('./pages/DownloadApp'));
const UpidHistory = lazy(() => import('./pages/UpidHistory'));
const FacultyFeedback = lazy(() => import('./pages/FacultyFeedback'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const InstitutionDetailsAdmin = lazy(() => import('./pages/InstitutionDetailsAdmin'));
const Onboarding = lazy(() => import('./pages/Onboarding'));


import ProtectedRoute from './components/ProtectedRoute';
const MainLayout = lazy(() => import('./components/MainLayout'));

import UpdateManager from './components/UpdateManager';

function App() {
  return (
    <UserProvider>
      <UpdateManager />
      <Router>
        <Suspense fallback={<div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>}>
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
                <Route path="/profile" element={<Profile />} />
                <Route path="/profileview" element={<ProfileView />} />
                <Route path="/group" element={<Group />} />
                <Route path="/details" element={<Details />} /> {/* Sometimes needed for editing */}
                <Route path="/general-feedback" element={<GeneralFeedback />} />
                <Route path="/report-harassment" element={<Report type="sexual_harassment" />} />
                <Route path="/report-misbehavior" element={<Report type="misbehavior" />} />
                <Route path="/ttr-ai" element={<TTRAI />} />
                <Route path="/4-way-learning" element={<FourWayLearning />} />
                <Route path="/health" element={<Health />} />
                <Route path="/video-library" element={<VideoLibrary />} />
                <Route path="/select-feedback-target" element={<SelectFeedbackTarget />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/exam" element={<Exam />} />
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
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </UserProvider>
  );
}

export default App;
