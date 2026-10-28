import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";


const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(<App />);


if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error: unknown) => {
      // App functionality should remain available even if offline support cannot register.
      console.warn("Stem Lab offline shell registration failed:", error);
    });
  });
}
