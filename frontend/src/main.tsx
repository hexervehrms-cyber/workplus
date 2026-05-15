import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { bootstrapApp } from "./app/utils/appBootstrap.ts";

bootstrapApp();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
