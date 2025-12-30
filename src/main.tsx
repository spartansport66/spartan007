import { createRoot } from "react-dom/client";
import React from "react"; // Import React for JSX
import "./globals.css";

// Temporarily render a very simple component to check if the app can even load
const MinimalApp = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Hello World!</h1>
  </div>
);

createRoot(document.getElementById("root")!).render(<MinimalApp />);