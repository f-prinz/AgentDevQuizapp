import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { appRoutes } from "./app-routes";
// Schriften selbst gehostet — der Abend kann ohne Internet stattfinden.
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "./styles/app.css";

const element = document.getElementById("root");
if (!element) throw new Error("App root element is missing");

ReactDOM.createRoot(element).render(
  <React.StrictMode><RouterProvider router={createBrowserRouter(appRoutes)} /></React.StrictMode>,
);