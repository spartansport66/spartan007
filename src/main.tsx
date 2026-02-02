import { createRoot } from "react-dom/client";
import React from "react";
import "./globals.css";
import App from "./App"; // Import the main App component

createRoot(document.getElementById("root")!).render(<App />);