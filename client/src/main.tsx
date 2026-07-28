import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { FirebaseAuthGate } from "./firebase.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FirebaseAuthGate><App /></FirebaseAuthGate>
  </React.StrictMode>
);
