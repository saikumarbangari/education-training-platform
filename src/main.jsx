import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { LearningProvider } from "./context/LearningContext.jsx";
import "./styles.css";

function LearningSession() {
  const { token } = useAuth();
  // A different session starts with fresh state, including on shared laptops.
  return (
    <LearningProvider key={token || "guest"}>
      <App />
    </LearningProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <LearningSession />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
