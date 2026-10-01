import { useLearning } from "../context/LearningContext.jsx";
import Feedback from "./Feedback.jsx";

export default function LearningGate({ children }) {
  const { loading, error, retry } = useLearning();
  if (loading)
    return <Feedback headingLevel="h1" title="Loading your learning record…" />;
  if (error)
    return (
      <Feedback
        headingLevel="h1"
        tone="error"
        title="Cannot load your learning record"
        action={
          <button className="button" onClick={retry}>
            Try again
          </button>
        }
      >
        <p>{error}</p>
      </Feedback>
    );
  return children;
}
