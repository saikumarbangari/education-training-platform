import { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import CoursePage from "./pages/CoursePage.jsx";
import DiscoverPage from "./pages/DiscoverPage.jsx";
import EnrolPage from "./pages/EnrolPage.jsx";
import LearningPage from "./pages/LearningPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProgressPage from "./pages/ProgressPage.jsx";

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
        const response = await fetch("./data/courses.json", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const courses = await response.json();
        setCourseState({ courses, loading: false, error: "" });
      } catch (error) {
        if (error.name !== "AbortError") {
          setCourseState({
            courses: [],
            loading: false,
            error: "Courses could not be loaded. Check your connection and try again.",
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
          element={<EnrolPage {...courseState} onRetry={loadCourses} />}
        />
        <Route
          path="learning"
          element={<LearningPage {...courseState} onRetry={loadCourses} />}
        />
        <Route
          path="progress"
          element={<ProgressPage {...courseState} onRetry={loadCourses} />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
