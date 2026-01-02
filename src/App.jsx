import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
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
import FourWayLearning from './pages/FourWayLearning.jsx';
import VideoLibrary from './pages/VideoLibrary';

import { UserProvider } from './context/UserContext';


function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/student" element={<Student />} />
          <Route path="/teacher" element={<Teacher />} />
          <Route path="/institution" element={<Institution />} />
          <Route path="/admission" element={<Admission />} />
          <Route path="/waiting-list" element={<WaitingList />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/general-feedback" element={<GeneralFeedback />} />
          <Route path="/exam" element={<Exam />} />
          <Route path="/health" element={<Health />} />
          <Route path="/feedback-overview" element={<FeedbackOverview />} />
          <Route path="/report-harassment" element={<Report type="sexual_harassment" />} />
          <Route path="/report-misbehavior" element={<Report type="misbehavior" />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profileview" element={<ProfileView />} />
          <Route path="/group" element={<Group />} />
          <Route path="/allotment" element={<Allotment />} />
          <Route path="/details" element={<Details />} />
          <Route path="/ttr-ai" element={<TTRAI />} />
          <Route path="/4-way-learning" element={<FourWayLearning />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
