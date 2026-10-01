import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
const LearningContext = createContext(null);

export function LearningProvider({ children }) {
  const { token } = useAuth();
  const [enrolments, setEnrolments] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const busy = useRef(new Set());
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api("/enrolments/me", { token, signal: controller.signal })
      .then(({ enrolments }) => {
        if (!controller.signal.aborted) setEnrolments(enrolments);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, revision]);

  async function save(courseId, action) {
    if (busy.current.has(courseId)) return;
    busy.current.add(courseId);
    setPending([...busy.current]);
    try {
      return await action();
    } finally {
      busy.current.delete(courseId);
      setPending([...busy.current]);
    }
  }

  async function enrol(courseId, learner) {
    return save(courseId, async () => {
      const { enrolment } = await api("/enrolments", {
        method: "POST",
        token,
        body: { courseId, goal: learner.goal },
      });
      setEnrolments((current) => [
        enrolment,
        ...current.filter((item) => item.courseId !== courseId),
      ]);
    });
  }

  async function toggleModule(course, moduleId) {
    return save(course.id, async () => {
      const item = enrolments.find((item) => item.courseId === course.id);
      const validIds = new Set(course.modules.map((module) => module.id));
      const completed = item.completedModules.filter((id) => validIds.has(id));
      const completedModuleIds = completed.includes(moduleId)
        ? completed.filter((id) => id !== moduleId)
        : [...completed, moduleId];
      const { enrolment } = await api(`/enrolments/${course.id}/progress`, {
        method: "PATCH",
        token,
        body: { completedModuleIds },
      });
      setEnrolments((current) =>
        current.map((item) => (item.courseId === course.id ? enrolment : item)),
      );
    });
  }

  async function withdraw(courseId) {
    return save(courseId, async () => {
      await api(`/enrolments/${courseId}`, { method: "DELETE", token });
      setEnrolments((current) =>
        current.filter((item) => item.courseId !== courseId),
      );
    });
  }

  return (
    <LearningContext.Provider
      value={{
        enrolments,
        loading,
        error,
        pending,
        enrol,
        toggleModule,
        withdraw,
        retry: () => setRevision((n) => n + 1),
      }}
    >
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context)
    throw new Error("useLearning must be used inside LearningProvider");
  return context;
}
