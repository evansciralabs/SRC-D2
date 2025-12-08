# SRC-D2_WEYU
SRC-D2 WEYU: Cyber-Conspectus Matrix v2.0. Client-side, locally persistent incident and project management dashboard. Utilizing pure HTML, TailwindCSS, and JavaScript for zero-latency, high-performance data visualization.

# 💾 SRC-D2_WEYU_v11: Cyber-Conspectus Matrix

## 🚀 Overview
The SRC-D2\_WEYU\_v11 Cyber-Conspectus Matrix is a hyper-persistent, single-page application (SPA) designed for streamlined incident response tracking, project management, and rapid context capture. It operates entirely client-side, using browser technologies (LocalStorage, IndexedDB, SessionStorage) for data persistence, offering robust data integrity and operational security without reliance on external servers.

This version implements advanced data export protocols, mobile-optimized views, and a multi-tab scratchpad with granular saving options.

## ✨ Key Features

* **100% Client-Side Persistence:** Data is securely stored within your browser's local cache (LocalStorage and IndexedDB).
* **Dual-Registry Tracking:** Separate management for **Projects** and **Incidents**, utilizing advanced attachment-based sorting algorithms for Incidents.
* **Multi-Tab Scratchpad:** Dedicated context pads for **Main (SP)**, **Snippet/AI (SNPT)**, and **VIP Context (VIP)**, all supporting real-time autosave to SessionStorage.
* **Robust Export Protocol (.srcd):** Exports all data (registries + scratchpad) into a single, structured JSON file.
* **Custom Naming Conventions:** All exports use clean, chronologically accurate local timestamps and defined abbreviations:
    * **CC:** Command Conspectus (Full Dashboard Export)
    * **SP:** Scratchpad Main Export
    * **SNPT:** Snippet/AI Export
    * **VIP:** VIP Context Export
* **Attachment Management:** Supports linking media (Blobs via IndexedDB) and `.srcd` text files to entries, complete with label editing and content viewing.
* **Responsive UI:** Mobile-optimized view toggles (List/Details) for field operation.

## 🛠 Installation and Deployment

This application is provided as a single, self-contained HTML file.

1.  **Download:** Download the `SRC-D2_WEYU_v11.html` file.
2.  **Deployment:** Open the file directly in any modern web browser (Chrome, Firefox, Edge).

***Note:*** *Since the application relies on client-side storage, it will retain your data across browser sessions, but **data is not synced** across different devices or browsers.*

## 💡 Usage Tip: Maintaining a Clean State

Due to the reliance on local browser storage solutions (LocalStorage and IndexedDB), data can accumulate over time. To ensure optimal performance and easily reset your working environment without clearing browsing history:

> **Helpful Tip:** Before starting any long-term work, perform a **Full Data Export** using the `[ < ] EXPORT (.srcd)` button while your dashboard is clean (i.e., immediately after initial load or after manually deleting all entries). This exported file represents a "clean dashboard." You can later **Import** this clean file (using the **Overwrite** mode) to effectively wipe your cache data without fully clearing your browsing history.

## 🤝 Funding and Support

If you find this tool helpful, consider supporting the continued development and maintenance through the links below. Your contribution helps ensure the ongoing refinement of the SRC-D Matrix protocols.

| Platform   | Handle / Address        |
| ---        | ---                     |
| **Venmo**  | @mavartcreator          |
| **PayPal** | MavArtCreator@gmail.com |

---

*SRC-D2\_WEYU\_v11 is provided "as-is" for personal and operational use. Always back up critical data using the export function.*
