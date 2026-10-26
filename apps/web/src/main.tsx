import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { appRoutes } from "./app-routes";
import "./styles/app.css";

const element = document.getElementById("root");
if (!element) throw new Error("App root element is missing");

ReactDOM.createRoot(element).render(
  <React.StrictMode><RouterProvider router={createBrowserRouter(appRoutes)} /></React.StrictMode>,
);