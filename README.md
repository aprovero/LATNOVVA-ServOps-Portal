<div align="center">

# 🌐 LATNOVVA ServiceTool

**A comprehensive, multi-tenant web application designed for LATNOVVA's Service Operations.**

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

<div align="center">
  <i>Internal APROVERO Project. All rights reserved.</i>
</div>
