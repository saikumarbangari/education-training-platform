import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { LearningProvider } from "./context/LearningContext.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <LearningProvider>
        <App />
      </LearningProvider>
    </HashRouter>
  </StrictMode>,
);
