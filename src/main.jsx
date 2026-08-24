import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.jsx";
import TeacherPortal from "./TeacherPortal.jsx";

const isTeacherPage =
  window.location.pathname === "/teacher" ||
  window.location.pathname.startsWith("/teacher/");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isTeacherPage ? <TeacherPortal /> : <App />}
  </StrictMode>
);