import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";

export default function NotFoundPage() {
  return (
    <Feedback
      tone="error"
      title="Page not found"
      headingLevel="h1"
      action={
        <Link className="button button--small" to="/">
          Return to Discover
        </Link>
      }
    >
      <p>The address may be incorrect, or the page may have moved.</p>
    </Feedback>
  );
}
