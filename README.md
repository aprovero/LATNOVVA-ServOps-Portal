<div align="center">

# 🌐 LATNOVVA ServiceTool

**A comprehensive, multi-tenant web application designed for LATNOVVA's Service Operations.**

[![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](#license)

</div>

<br />

LATNOVVA ServiceTool provides a robust portal for managing personnel, project compliance, reporting, time tracking, and more. Built with multi-tenancy at its core, it seamlessly supports multiple subsidiaries (such as Latnovva Mexico) with strict data isolation and role-based access control.

---

## ✨ Key Features & Capabilities

- **🏢 Multi-Tenant Architecture**: Built to support multiple subsidiaries (e.g., Latnovva Mexico) with strict data isolation using PostgreSQL Row Level Security (RLS).
- **🔐 Role-Based Access Control (RBAC)**: Distinct access levels and features tailored for `Manager`, `Supervisor`, `HR`, `Office`, and `Tech` roles.
- **📊 Data Visualization & Mapping**: Interactive charts for reporting and real-time geographic mapping for service operations.
- **📱 Progressive Web App (PWA)**: Offline capabilities and installable as a standalone app on desktop and mobile.
- **🌍 Localization**: Seamless multi-language support configured via i18next.
- **🎨 Modern User Interface**: Responsive, accessible, and beautifully animated UI leveraging Tailwind CSS and Radix UI primitives.

---

## 🗺️ Application Modules

The portal is divided into several specialized modules tailored to operational needs:

| Module | Route | Description |
| :--- | :--- | :--- |
| **Projects** | `/projects` | The core operations hub. Provides an overview and detailed views of ongoing service projects, task assignments, and compliance statuses. |
| **Live Map** | `/live-map` | A geographic visualization to track active projects, service operations, and field personnel locations in real-time. |
| **Reports** | `/reports` | *Exclusive to the US subsidiary.* Enables users to generate, view, and edit detailed operational service reports and sub-reports. |
| **Data Analysis** | `/analysis` | Interactive charts and visualizations that provide insights into operations, performance, and trends. |
| **Tools** | `/tools` | A suite of internal utilities and calculators tailored for HR, Managers, and Office personnel. |
| **Templates** | `/templates` | Management of global and subsidiary-specific templates for data collection and standardized reporting. |
| **Calendar** | `/calendar` | Provides a visual schedule of project timelines, technician allocations, and upcoming operational events. |
| **Personnel** | `/personnel` | Comprehensive management of employee profiles, role assignments, and HR compliance tracking. |
| **Timesheets** | `/timesheets` | Detailed tracking, review, and approval of employee working hours logged across different projects. |
| **Clock In** | `/clock-in` | The primary interface for Field Techs to log their shifts, attendance, and daily activities. |
| **Nómina** | `/nomina` | *Exclusive to the Mexico (MX) subsidiary.* A specialized portal for handling payroll processing, deductions, and local HR requirements. |
| **Settings** | `/settings` | *Restricted to Managers & Supervisors.* Allows administration of application roles, system preferences, and global configurations. |

---

## 👥 Personnel Management & Onboarding

### Required Fields for Creating Employees

#### 1. Manual Creation (`+ Nuevo Colaborador` Modal)
To register an individual employee in the portal:
* **Required Fields (Strict):**
  * `Nombre` (Full Name)
  * `Puesto` (Position / Job Title)
  * `Email` (Email Address — creates the Supabase Auth user identity)
* **Automatic Defaults:**
  * `Rol de Acceso`: Defaults to `Tech`.
  * `Estatus`: Defaults to `Active`.
  * `Sitio Asignado / Proyecto`: If left unassigned, automatically defaults to the **Mexico City Central Office** (`EST-LNV-000 CDMX`).
  * `Número de Empleado`: If left blank, an internal ID is automatically assigned (`MX-LNV-XXXX` or `MX-SYS-XXXX`).

#### 2. Bulk CSV Import (`Carga Masiva de Personal`)
To upload collaborators simultaneously via the 55-column template:
* **Required Column (Strict):**
  * `NOMBRE`: Every non-empty row must include the collaborator's full name.
* **Recommended Identity & Employment Columns:**
  * `EMPRESA` (defaults to `LATNOVVA` if blank)
  * `PUESTO` (defaults to `TECHNICIAN` if blank)
  * `EMAIL` / `CORP_EMAIL`
  * `TEL`
  * `CURP`, `RFC`, `NSS` (for Mexico subsidiary compliance)
* **Intelligent Fallbacks & Automatic Calculations:**
  * `PROYECTO`: If omitted or not matching an active site, automatically assigns the employee to the **Mexico City Central Office** (`EST-LNV-000 CDMX`).
  * `NUMERO_EMPLEADO`: If omitted, automatically generates sequential IDs (`MX-LNV-XXXX` or `MX-SYS-XXXX`).
  * `EDAD`: Automatically calculated from `FECHA_NACIMIENTO` if left blank.
  * `TOTAL`: Automatically calculated as `NOMINA_PPP + NOMINA_IMSS` if left blank.
  * `CLABE`: Automatically repairs scientific notation formatted by Excel (e.g., `1.218E+16`).

---

## 📸 Biometric Face ID Testing & Clock-In

* **Automated Login Prompt Interception:** The interactive biometric Face ID consent, selfie capture, and live verification flow is currently enabled for:
  1. `tech@latnovva.com`
  2. `jacqueline.martinez@latnovva.com`
* **Face ID Clock-In:** Any collaborator with an enrolled biometric vector (`faceDescriptor`) can use Face ID for shifts and clock-ins across the portal. Biometric descriptors can also be captured by uploading and verifying a profile photo in the Personnel form.

---

## 🛠️ Technology Stack

<details>
<summary><b>Click to expand</b></summary>

- **Frontend Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), `class-variance-authority`, `lucide-react`
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Authentication**: Azure MSAL (Microsoft Entra ID) & [Supabase Auth](https://supabase.com/auth)
- **Database & Backend**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Forms & Validation**: [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/)
- **Mapping & Charts**: [React Leaflet](https://react-leaflet.js.org/), [Recharts](https://recharts.org/)
- **Animations**: [GSAP](https://gsap.com/), Tailwindcss Animate
</details>

---

## 🗄️ Database & Multi-Tenancy

The application relies heavily on **Supabase** for its backend, utilizing **Row Level Security (RLS)** to enforce strict data isolation across different subsidiaries. 

Several SQL migration and repair scripts are included in the repository root to manage identity, multi-tenancy rules, and permissions (e.g., `rls_mexico_subsidiary.sql`, `final_identity_multitenancy.sql`).

---

## License

Copyright (c) 2026 Latnovva and/or Andres Provero. All rights reserved.

This repository contains proprietary software, workflows, interface designs, and operational logic developed for Latnovva-related business use.

No permission is granted to copy, modify, distribute, sublicense, host, resell, or use this software or any substantial part of it for commercial purposes without prior written authorization.

This repository is made available only for authorized review, development, or evaluation purposes.

Public visibility of this repository does not grant any license or reuse rights.

---

<div align="center">
  <i>Internal LATNOVVA Project. All rights reserved.</i>
</div>
