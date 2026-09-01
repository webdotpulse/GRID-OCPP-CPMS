import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GRID CPMS - Enterprise EV Charging",
    short_name: "GRID CPMS",
    description:
      "Enterprise EV Charging Management System with Smart Energy Flexibility, Dynamic EPEX Spot Pricing, V2G Orchestration & OCPI Roaming",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1e2228",
    theme_color: "#3f78e0",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon",
      },
      {
        src: "/assets/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/assets/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard Overview",
        url: "/dashboard",
        description: "Fleet KPI metrics, active power, and revenue analytics",
      },
      {
        name: "Live Charging Sessions",
        url: "/transactions",
        description: "Real-time telemetry, meter values, and transaction monitor",
      },
      {
        name: "Charge Point Fleet",
        url: "/chargers",
        description: "Manage OCPP chargers, firmware updates & diagnostics",
      },
      {
        name: "Ground Plan & Stations",
        url: "/stations",
        description: "Interactive visual ground plans and geospatial charging hubs",
      },
      {
        name: "Driver Companion PWA",
        url: "/mobile/dashboard",
        description: "Mobile driver dashboard, NFC passes & session control",
      },
    ],
    categories: ["business", "utilities", "productivity", "transportation"],
  };
}
