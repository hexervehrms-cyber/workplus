import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Clear only corrupted legacy localStorage entries (do not wipe valid sessions on every load)
try {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      JSON.parse(user);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  }
} catch (e) {
  console.error('Error checking localStorage:', e);
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
