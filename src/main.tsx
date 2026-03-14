import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import App from "./App.tsx";
import "./index.css";

// Use /QRMENU/ for local dev, / for production
const basename = import.meta.env.MODE === 'production' ? '/' : '/QRMENU/';

createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={basename}>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/QRMENU/"
    >
      <App />
    </ClerkProvider>
  </BrowserRouter>
);
