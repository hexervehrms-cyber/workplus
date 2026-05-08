import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Clear corrupted localStorage
try {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      JSON.parse(user);
    } catch {
      localStorage.clear();
    }
  }
} catch (e) {
  console.error('Error checking localStorage:', e);
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
