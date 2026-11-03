import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { CharacterLab } from "./rig/CharacterLab.js";
import "./styles.css";

// No router in this app (tabs are local useState) — /lab is a separate,
// isolated preview page (Part 2a), not wired to live data. Both the Vite
// dev server and the production static server already serve index.html for
// any path, so a plain pathname check is all that's needed.
const root = window.location.pathname === "/lab" ? <CharacterLab /> : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>{root}</React.StrictMode>);
