import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { PrimeReactProvider } from "primereact/api";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import "./styles/tailwind.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const container = document.getElementById("root");
const root = createRoot(container!);

root.render(
  <BrowserRouter>
    <PrimeReactProvider
      value={{
        hideOverlaysOnDocumentScrolling: false,
      }}
    >
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
          baseTheme: dark,
          variables: {
            colorBackground: "#1a1a1a",
            colorPrimary: "#1a1a1a",
            colorTextOnPrimaryBackground: "white",
            colorInputBackground: "#1a1a1a",
            colorInputText: "#ffffff",
          },
        }}
      >
        <App />
      </ClerkProvider>
    </PrimeReactProvider>
  </BrowserRouter>
);
