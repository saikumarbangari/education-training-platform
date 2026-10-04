import { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import CoursePage from "./pages/CoursePage.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import EnrolPage from "./pages/EnrolPage.jsx";
import LearningPage from "./pages/LearningPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProgressPage from "./pages/ProgressPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import AttendancePage from "./pages/AttendancePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import LearnersPage from "./pages/LearnersPage.jsx";
import LearnerPage from "./pages/LearnerPage.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import LearningGate from "./components/LearningGate.jsx";
import { api } from "./api/client.js";

const learnerView = (page) => (
  <RequireAuth>
    <LearningGate>{page}</LearningGate>
  </RequireAuth>
);

export default function App() {
  const [courseState, setCourseState] = useState({
    courses: [],
    loading: true,
    error: "",
  });
  const [requestNumber, setRequestNumber] = useState(0);

  const loadCourses = useCallback(() => {
    setCourseState((current) => ({ ...current, loading: true, error: "" }));
    setRequestNumber((number) => number + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchCourses() {
      try {
        const { courses } = await api("/courses", {
          signal: controller.signal,
        });
        if (!controller.signal.aborted)
          setCourseState({ courses, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setCourseState({
            courses: [],
            loading: false,
            error:
              "Courses could not be loaded. Check your connection and try again.",
          });
        }
      }
    }

    fetchCourses();
    return () => controller.abort();
  }, [requestNumber]);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={<DiscoverPage {...courseState} onRetry={loadCourses} />}
        />
        <Route
          path="courses/:courseId"
          element={<CoursePage {...courseState} onRetry={loadCourses} />}
        />
        <Route
          path="courses/:courseId/enrol"
          element={learnerView(
            <EnrolPage {...courseState} onRetry={loadCourses} />,
          )}
        />
        <Route
          path="learning"
          element={learnerView(
            <LearningPage {...courseState} onRetry={loadCourses} />,
          )}
        />
        <Route
          path="progress"
          element={learnerView(
            <ProgressPage {...courseState} onRetry={loadCourses} />,
          )}
        />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage register />} />
        <Route
          path="attendance"
          element={learnerView(
            <AttendancePage {...courseState} onRetry={loadCourses} />,
          )}
        />
        <Route
          path="admin"
          element={
            <RequireAuth admin>
              <AdminPage onChange={loadCourses} />
            </RequireAuth>
          }
        />
        <Route
          path="admin/learners"
          element={
            <RequireAuth admin>
              <LearnersPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin/learners/:learnerId"
          element={
            <RequireAuth admin>
              <LearnerPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
