"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  AdminSidebarData,
  TeacherSidebarData,
  StudentSidebarData,
  ParentSidebarData,
} from "./sidebarData";
import { useDispatch, useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { setExpandMenu, setMobileSidebar } from "@/core/redux/sidebarSlice";
import ImageWithBasePath from "@/core/imageWithBasePath";
import { updateTheme } from "@/core/redux/themeSlice";
import { useAppSelector, useAppDispatch } from "@/core/redux/hooks";
import { incrementUnread } from "@/core/redux/chatSlice";
import { RoleName } from "@/types/auth";
import { getDashboardRouteForRole } from "@/lib/roles";
import { canAccess } from "@/lib/permissions";
import { socket_url } from "@/environment";
import { getAccessToken } from "@/lib/auth-storage";

const getSidebarData = (role: RoleName | null) => {
  if (!role) return AdminSidebarData;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return AdminSidebarData;
  if (role === "TEACHER") return TeacherSidebarData;
  if (role === "STUDENT") return StudentSidebarData;
  if (role === "PARENT") return ParentSidebarData;
  return AdminSidebarData;
};

const Sidebar = () => {
  const Location = usePathname();
  const [subOpen, setSubopen] = useState<any>("");
  const [subsidebar, setSubsidebar] = useState("");
  const [isSidebarOpened, setIsSidebarOpened] = useState(false);
  const dispatch = useDispatch();
  const appDispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const roleName = (user?.role?.name ?? null) as RoleName | null;
  const unreadCounts = useAppSelector((state) => state.chat?.unreadCounts ?? {});
  const totalChatUnread: number = Object.values(unreadCounts as Record<string, number>).reduce((s, n) => s + n, 0);

  const permissions = (user?.permissions ?? []) as string[];

  // Derive stable userId / userType for the socket
  const userId   = user?.id ? String(user.id) : "";
  const userType = (user?.role?.name ?? "").toLowerCase().replace("super_admin", "admin");

  // Ref so the pathname is always current inside the socket callback
  const pathnameRef = useRef(Location);
  useEffect(() => { pathnameRef.current = Location; }, [Location]);

  // Global chat socket — always connected so unread counts update on every page
  useEffect(() => {
    if (!userId || !userType) return;

    const token = getAccessToken();
    const socket = io(socket_url, {
      path: "/chat/socket.io/",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token },
    });

    socket.on("connect", () => {
      socket.emit("userConnected", { userId, userType });
    });

    // Private messages — increment badge only when the user is NOT on the chat page
    // (when on the chat page the chat component's own socket handles this with
    //  proper active-conversation awareness)
    socket.on("privateMessageSent", (message: { senderId: number; senderType: string }) => {
      const isChatPage = pathnameRef.current?.includes("/chat");
      if (isChatPage) return;

      const myId = parseInt(userId);
      const isSender = message.senderId === myId && message.senderType === userType;
      if (!isSender) {
        appDispatch(incrementUnread(`${message.senderType}-${message.senderId}`));
      }
    });

    // Group messages — same logic
    socket.on("newGroupMessage", (message: { groupId: number; senderId: number; senderType: string }) => {
      const isChatPage = pathnameRef.current?.includes("/chat");
      if (isChatPage) return;

      const myId = parseInt(userId);
      const isSender = message.senderId === myId && message.senderType === userType;
      if (!isSender) {
        appDispatch(incrementUnread(`group-${message.groupId}`));
      }
    });

    return () => { socket.disconnect(); };
  }, [userId, userType, appDispatch]);
  const sidebarData = getSidebarData(roleName);
  const dashboardRoute = getDashboardRouteForRole(roleName ?? undefined);

  /** Returns true if the current user can see this sidebar item. */
  const canSeeItem = (item: any): boolean => {
    // Legacy allowedRoles support (teacher/student/parent items use this)
    if (item?.allowedRoles && item.allowedRoles.length > 0) {
      if (!roleName) return false;
      return item.allowedRoles.includes(roleName);
    }
    // New permission-based check for admin items
    if (item?.requiredPermission) {
      return canAccess(roleName, permissions, item.requiredPermission);
    }
    return true;
  };

  const toggleSidebar = (title: any) => {
    localStorage.setItem("menuOpened", title);
    if (title === subOpen) {
      setSubopen("");
    } else {
      setSubopen(title);
    }
  };

  const toggleSubsidebar = (subitem: any) => {
    if (subitem === subsidebar) {
      setSubsidebar("");
    } else {
      setSubsidebar(subitem);
    }
  };

  const handleClick = (label: any) => {
    toggleSidebar(label);
  };

  const navigate = useRouter();
  const themeSettings = useSelector((state: any) => state.theme.themeSettings);

  const handleMiniSidebar = () => {
    const rootElement = document.documentElement;
    const isMini = rootElement.getAttribute("data-layout") === "mini";
    const updatedLayout = isMini ? "default" : "mini";
    dispatch(
      updateTheme({
        "data-layout": updatedLayout,
      }),
    );
    if (isMini) {
      document.body.classList.remove("mini-sidebar");
    } else {
      document.body.classList.add("mini-sidebar");
    }
  };

  const handleMouseEnter = useCallback(() => {
    const body = document.body;
    if (body.classList.contains("mini-sidebar")) {
      body.classList.add("expand-menu");
    }
    dispatch(setExpandMenu(true));
  }, [dispatch]);

  const handleMouseLeave = useCallback(() => {
    const body = document.body;
    if (body.classList.contains("mini-sidebar")) {
      body.classList.remove("expand-menu");
    }
    dispatch(setExpandMenu(false));
  }, [dispatch]);

  const handleLayoutClick = (layout: string) => {
    const layoutSettings: any = {
      "data-layout": "default",
      dir: "ltr",
    };

    switch (layout) {
      case "Default":
        layoutSettings["data-layout"] = "default";
        layoutSettings.dir = "ltr";
        break;
      case "Hidden":
        layoutSettings["data-layout"] = "hidden";
        break;
      case "Mini":
        layoutSettings["data-layout"] = "mini";
        break;
      case "Hover View":
        layoutSettings["data-layout"] = "hoverview";
        break;
      case "Full Width":
        layoutSettings["data-layout"] = "full-width";
        break;
      case "RTL":
        layoutSettings.dir = "rtl";
        break;
      default:
        layoutSettings.dir = "ltr";
        break;
    }
    dispatch(updateTheme(layoutSettings));
    navigate.push(dashboardRoute);
  };

  const mobileSidebar = useSelector((state: any) => state.sidebarSlice.mobileSidebar);
  const toggleMobileSidebar = () => {
    const body = document.body;
    body.classList.remove("slide-nav");
    setIsSidebarOpened(false);
    const overlay = document.querySelector(".sidebar-overlay");
    if (overlay) {
      overlay.classList.remove("opened");
    }
  };

  /** Close mobile sidebar only when it's actually open (slide-nav class present) */
  const closeMobileIfOpen = () => {
    if (document.body.classList.contains("slide-nav")) {
      toggleMobileSidebar();
    }
  };

  useEffect(() => {
    const rootElement: any = document.documentElement;
    Object.entries(themeSettings).forEach(([key, value]) => {
      rootElement.setAttribute(key, value);
    });
    if (themeSettings["data-layout"] === "mini") {
      document.body.classList.add("mini-sidebar");
    } else if (Location === "/layout-rtl") {
      rootElement.setAttribute("dir", "rtl");
    } else {
      document.body.classList.remove("mini-sidebar");
      rootElement.setAttribute("dir", "ltr");
    }
  }, [themeSettings, Location]);

  return (
    <>
      {/* Sidenav Menu Start */}
      <div className="sidebar" id="sidebar" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {/* Start Logo */}
        <div className="sidebar-logo">
          <div className="logo-container">
            {/* Logo Normal */}
            <Link href={dashboardRoute} className="logo logo-normal" style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a2e', letterSpacing: '0.2em' }}>LMS</span>
              </span>
            </Link>
            {/* Logo Small */}
            <Link href={dashboardRoute} className="logo-small" style={{ textDecoration: 'none' }}>
              <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.85rem', padding: '4px 7px', borderRadius: '6px', letterSpacing: '0.05em', display: 'inline-block' }}>QA</span>
            </Link>
            {/* Logo Dark */}
            <Link href={dashboardRoute} className="dark-logo" style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#e2e8f0', letterSpacing: '0.2em' }}>LMS</span>
              </span>
            </Link>
          </div>
          <button className="sidenav-toggle-btn btn border-0 p-0 active" id="toggle_btn" onClick={handleMiniSidebar}>
            <i className="ti ti-arrow-left" />
          </button>
          {/* Sidebar Menu Close */}
          <button className="sidebar-close" onClick={toggleMobileSidebar}>
            <i className="ti ti-x align-middle" />
          </button>
        </div>
        {/* End Logo */}
        {/* Sidenav Menu */}
        <div className="sidebar-inner">
          <OverlayScrollbarsComponent style={{ height: "100%", width: "100%" }}>
            <div id="sidebar-menu" className="sidebar-menu">
              <ul>
                {sidebarData?.map((mainLabel, index) => {
                  // Hide entire section if no items are visible to this user
                  const visibleItems = mainLabel?.submenuItems?.filter((title: any) => canSeeItem(title));
                  if (!visibleItems || visibleItems.length === 0) return null;

                  return (
                  <React.Fragment key={`main-${index}`}>
                    <li className="menu-title">
                      <span>{mainLabel?.tittle}</span>
                    </li>
                    <li>
                      <ul>
                        {mainLabel?.submenuItems
                          ?.map((title: any, i) => {
                            let link_array: any = [];
                            if ("submenuItems" in title) {
                              title.submenuItems?.forEach((link: any) => {
                                link_array.push(link?.link);
                                if (link?.submenu && "submenuItems" in link) {
                                  link.submenuItems?.forEach((item: any) => {
                                    link_array.push(item?.link);
                                  });
                                }
                              });
                            }
                            title.links = link_array;

                            if (!canSeeItem(title)) {
                              return null;
                            }
                            return (
                              <li className="submenu" key={`title-${i}`}>
                                <Link
                                  href={title?.submenu ? "#" : title?.link}
                                  onClick={(e) => {
                                    if (title?.submenu) {
                                      e.preventDefault();
                                    } else {
                                      // Direct-navigate link — close mobile sidebar
                                      closeMobileIfOpen();
                                    }
                                    handleClick(title?.label);

                                    if (mainLabel?.tittle === "Layout") {
                                      handleLayoutClick(title?.label);
                                    }
                                  }}
                                  className={`${subOpen === title?.label ? "subdrop" : ""} ${
                                    title?.links?.includes(Location) || title?.link === Location ? "active" : ""
                                  }`}
                                >
                                  <i className={`ti ti-${title.icon}-filled`}></i>
                                  <span>{title?.label}</span>
                                  {title?.label === "Chat" && totalChatUnread > 0 && (
                                    <span className="badge bg-danger ms-auto rounded-pill fs-11 fw-bold" style={{ minWidth: 20 }}>
                                      {totalChatUnread > 99 ? "99+" : totalChatUnread}
                                    </span>
                                  )}
                                  {(title?.submenu || title?.customSubmenuTwo) && <span className="menu-arrow"></span>}
                                  {title?.submenu === false && title?.version === "v1.6.7" && (
                                    <span className="badge bg-danger ms-2 rounded-2 badge-md fs-12 fw-medium">
                                      v1.6.7
                                    </span>
                                  )}
                                </Link>

                                {title?.submenu !== false && (
                                  <ul
                                    style={{
                                      display: subOpen === title?.label ? "block" : "none",
                                    }}
                                  >
                                    {title?.submenuItems?.map((item: any, j: any) => {
                                      if (!canSeeItem(item)) {
                                        return null;
                                      }
                                      const isSubActive =
                                        item?.submenuItems?.map((link: any) => link?.link).includes(Location) ||
                                        item?.link === Location;

                                      return (
                                        <li
                                          className={`${item?.submenuItems ? "submenu submenu-two" : ""} `}
                                          key={`item-${j}`}
                                        >
                                          <Link
                                            href={item?.submenu ? "#" : item?.link}
                                            className={`${isSubActive ? "active subdrop" : ""} ${
                                              subsidebar === item?.label ? "subdrop" : ""
                                            }`}
                                            onClick={() => {
                                              toggleSubsidebar(item?.label);
                                              if (title?.label === "Layouts") {
                                                handleLayoutClick(item?.label);
                                              }
                                              if (!item?.submenu) {
                                                closeMobileIfOpen();
                                              }
                                            }}
                                          >
                                            {item?.label}
                                            {(item?.submenu || item?.customSubmenuTwo) && (
                                              <span className="menu-arrow"></span>
                                            )}
                                          </Link>
                                          {item?.submenuItems ? (
                                            <ul
                                              style={{
                                                display: subsidebar === item?.label ? "block" : "none",
                                              }}
                                            >
                                              {item?.submenuItems?.map((items: any, k: any) => {
                                                if (!canSeeItem(items)) {
                                                  return null;
                                                }
                                                const isSubSubActive =
                                                  items?.submenuItems
                                                    ?.map((link: any) => link.link)
                                                    .includes(Location) || items?.link === Location;

                                                return (
                                                  <li key={`submenu-item-${k}`}>
                                                    <Link
                                                      href={items?.submenu ? "#" : items?.link}
                                                      className={`${isSubSubActive ? "active" : ""}`}
                                                      onClick={() => {
                                                        if (!items?.submenu) {
                                                          closeMobileIfOpen();
                                                        }
                                                      }}
                                                    >
                                                      {items?.label}
                                                    </Link>
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </li>
                            );
                          })
                          .filter(Boolean)}
                      </ul>
                    </li>
                  </React.Fragment>
                  );
                })}
              </ul>
            </div>
          </OverlayScrollbarsComponent>
        </div>
      </div>
      {/* Sidenav Menu End */}

      <div className={`sidebar-overlay${isSidebarOpened ? " opened" : ""}`}></div>
    </>
  );
};

export default Sidebar;
