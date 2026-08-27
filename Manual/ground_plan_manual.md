# The Charge Grid: Parking Ground Plan Manual

The **Charge Grid Ground Plan** module is an enterprise feature that enables Station Managers and CPOs to create interactive 2D parking ground plans and monitor real-time EV charging statuses across physical bays.

---

## 1. Enabling Ground Plans for a Station

1. Navigate to **Stations** (`/stations`) in the admin dashboard.
2. Select the target station and click **Edit**.
3. Scroll to the **Enable Ground Plan** toggle and switch it **ON**.
4. Once enabled, the **Edit Ground Plan Layout** button appears on the station detail page.

![Stations Directory & Map](../Screenshots/17_Stations_Directory_Map.png)

---

## 2. Building the Ground Plan Layout

Clicking **Edit Ground Plan Layout** opens the interactive 2D Ground Plan Canvas (`/stations/[id]/ground-plan`):

![Ground Plan Builder](../Screenshots/21_Station_GroundPlan_2D_Builder.png)

### Canvas Controls & Tools:
* **Add Spot:** Creates a new draggable parking bay on the grid workspace.
* **Draw Area:** Creates a customizable rectangular zone to represent buildings, customer lounges, solar canopies, or restricted areas.
* **Draw Line:** Places customizable lines to represent lane markings, curbs, or perimeter fences.
* **Drag & Drop:** Click and drag any spot, area, or line to align with your facility's physical architectural layout.
* **Rotate:** Click the circular rotation icon on any parking spot to rotate it by 45 degrees to match angled parking bays.
* **Delete:** Click the trash icon on selected elements to remove them.
* **Labeling:** Type inside the spot or area header to assign custom bay names (e.g., *"VIP Bay 1"*, *"Fast Charger 01"*).
* **Assign Connector Socket:** Use the dropdown inside each parking bay to link an available physical charger socket (e.g., `Charger-East / Connector 1`) to that parking space.
* **Custom Styling Menu (Hover):** Hover over lines or areas to customize:
  * **Line / Border Color:** Select border colors for visual demarcation.
  * **Fill Color:** Choose background fills for painted bays or pavement areas.
  * **Line Width:** Set border thickness.
  * **Dimensions:** Set precise width and height pixel constraints.

Click **Save Plan** to persist the layout to PostgreSQL.

---

## 3. Real-Time Live View Floor Monitor

Access the real-time floor monitoring view via the station's **Live View** tab (`/stations/[id]/live`):

![Ground Plan Live View](../Screenshots/22_Station_Live_FloorPlan_Monitor.png)

The Live View renders the parking layout with dynamic glassmorphism indicators that update in real-time via WebSocket telemetry:

### Visual Bay States:

* 🟢 **Available (Blue/Green outline):** The assigned charger socket is online, operative, and ready for a vehicle to plug in.
* ⚡ **Charging (Pulsing Green glow):** A vehicle is connected and actively drawing power. The bay tile displays:
  * Instantaneous Charging Rate (**kW**)
  * Total Energy Delivered (**kWh**)
  * Active RFID Tag / Driver Account
  * Elapsed Charging Duration
* 🔴 **Faulted / Unavailable (Red outline):** The assigned socket is inoperative, faulted, or the charger is disconnected.
* ⚪ **Unassigned (Dashed border):** A parking bay exists in the ground plan layout but no physical charger socket has been linked to it yet.
