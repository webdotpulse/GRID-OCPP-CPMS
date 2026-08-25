# OCPP Charge Management System - User Manual

Welcome to the **OCPP Charge Management System (CMS)** User Manual. This guide is designed for Charge Point Operators (CPOs) and Station Managers. It explains how to effectively use the Next.js Admin Dashboard to manage your EV charging infrastructure, track sessions, configure pricing, and remotely control your chargers.

---

## 1. Getting Started

### 1.1 Accessing the Dashboard
Open your web browser and navigate to the CMS Dashboard URL provided by your system administrator (e.g., `https://ui.mobilitypulse.com` or `http://localhost:3002`).

### 1.2 Logging In
Enter your **Email Address** and **Password** to access the system. If you do not have an account, or have forgotten your password, please contact your system administrator to request access or a password reset.

### 1.3 Navigating the Interface
Once logged in, you'll see a sidebar navigation menu providing access to different system modules:
- **Dashboard**: High-level overview, live metrics, and real-time charging statuses.
- **Stations**: Manage physical locations where chargers are installed.
- **Chargers**: View and configure individual charging units.
- **Users**: Manage EV drivers, assign RFID tags, and control access.
- **Tariffs**: Configure pricing structures and billing rates.
- **Logs**: View real-time OCPP WebSocket communication for debugging.
- **Settings**: Manage system-wide configuration, dynamic tariffs, and roaming endpoints.

---

## 2. Managing Charging Stations and Chargers

### 2.1 Charging Stations
A **Station** represents a physical location (e.g., "Office Parking Lot") that houses one or more EV chargers.

*   **Creating a Station:** Navigate to **Stations** > **Add Station**. Enter the station name, geographical location (address, coordinates), and assign an owner.
*   **Viewing Stations:** The Stations page lists all locations. Clicking a station provides details on the chargers assigned to it.

### 2.2 Chargers
A **Charger** (or Charge Point) represents the physical hardware connected to the system.

*   **Adding a Charger:** Go to **Chargers** > **Add Charger**.
    *   **Charger ID:** Ensure the Charger ID matches the identity configured in the physical charger's hardware settings.
    *   **Assignment:** Link the charger to an existing Station and assign a Tariff.
    *   **Connectors:** After creating a charger, you can define its individual Connectors (plugs) and their specifications (e.g., AC, DC, max power).
*   **Charger Status:** The dashboard displays the real-time status of each charger (e.g., `Available`, `Preparing`, `Charging`, `Faulted`).

---

## 3. Remote Control Operations

The CMS allows you to send remote commands directly to your chargers.

1.  Navigate to **Chargers**.
2.  Click on the specific Charger you wish to manage to open its detail view.
3.  Locate the **Remote Control** tab.

Available operations include:
*   **Reset (Soft/Hard):** Reboot the charger. A Soft reset stops ongoing transactions gracefully, while a Hard reset forces an immediate reboot.
*   **Unlock Connector:** Remotely release a locked cable from a specific connector.
*   **Clear Cache:** Force the charger to clear its local RFID authorization cache.
*   **Change Availability:** Set a connector to `Operative` or `Inoperative`.
*   **Start/Stop Transaction:** Manually initiate or terminate a charging session.
*   **Update Firmware / Get Diagnostics:** Trigger remote firmware updates or request diagnostic log files.

---

## 4. User and RFID Management

The system uses a whitelist approach to authorize charging sessions.

*   **Adding Users:** Navigate to **Users** > **Add User**. Enter the user's details and assign them a role (e.g., Driver, Admin).
*   **Assigning RFID Tags:** Once a user is created, you can assign them an **idTag** (RFID card number). This tag will be whitelisted, allowing the user to start sessions by swiping their card at the charger.
*   **Managing Access:** You can block or remove RFID tags to instantly revoke charging access for a specific user.

---

## 5. Tariffs and Pricing

A **Tariff** defines the financial cost structure for a charging session.

*   **Creating a Tariff:** Go to **Tariffs** > **Add Tariff**.
*   **Pricing Elements:** You can define up to four different pricing components:
    1.  **Energy Fee (€/kWh):** The cost per kilowatt-hour of energy consumed.
    2.  **Connection Fee (€):** A fixed fee applied once per charging session.
    3.  **Time Fee (€/hour):** A cost based on the total duration of the charging session.
    4.  **Idle Fee (€/hour):** A cost applied when the car is plugged in but not actively drawing power (e.g., after the battery is fully charged).
*   **Assignment:** Tariffs can be assigned globally, at the Station level, or directly to specific Chargers. The system dynamically calculates the `totalCost` of a session based on the active tariff when the transaction ends.

---

## 6. Live Monitoring and Logs

### 6.1 Real-Time Dashboard
The **Dashboard** provides a high-level view of active charging sessions, total energy consumed, and live power metrics aggregated across your network.

### 6.2 OCPP Log Viewer
For advanced troubleshooting, navigate to **Logs**.
*   This page streams raw OCPP messages (JSON payloads) between the chargers and the CMS in real-time.
*   You can filter logs by specific Charger IDs to debug connectivity issues, authorization failures, or transaction errors.

---

## 7. Advanced Configurations (Settings)

The **Settings** page is restricted to system administrators and contains advanced configurations:

*   **Dynamic Tariffs:** Configure EPEX Spot day-ahead electricity prices.
*   **Quirk Profiles:** Apply specific behavioral modifications for non-compliant hardware vendors.
*   **Roaming (OCPI/OICP):** Configure endpoints and tokens to connect with external roaming networks (e.g., Hubject, Gireve).
