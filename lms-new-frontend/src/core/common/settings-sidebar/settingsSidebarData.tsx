import { all_routes } from "@/routes/all_routes";

export const sidebarMenus = [
  {
    label: "Account Settings",
    icon: "ti ti-user-cog me-2",
    submenus: [
      { to: all_routes.profilesettings, label: "Profile" },
      { to: all_routes.securitysettings, label: "Security" },
    ],
  },
];