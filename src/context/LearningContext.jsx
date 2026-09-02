import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "waypoint-enrolments";
const LearningContext = createContext(null);

function readSavedEnrolments() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function LearningProvider({ children }) {
  const [enrolments, setEnrolments] = useState(readSavedEnrolments);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enrolments));
  }, [enrolments]);

  function enrol(courseId, learner) {
    setEnrolments((current) =>
      current.some((item) => item.courseId === courseId)
        ? current
        : [...current, { courseId, learner, completedModules: [] }],
    );
  }

  function toggleModule(courseId, moduleId) {
    setEnrolments((current) =>
      current.map((item) => {
        if (item.courseId !== courseId) return item;
        const completed = item.completedModules.includes(moduleId);
        return {
          ...item,
          completedModules: completed
            ? item.completedModules.filter((id) => id !== moduleId)
            : [...item.completedModules, moduleId],
        };
      }),
    );
  }

  return (
    <LearningContext.Provider value={{ enrolments, enrol, toggleModule }}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error("useLearning must be used inside LearningProvider");
  return context;
}
