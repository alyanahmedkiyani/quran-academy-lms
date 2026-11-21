"use client";


import ImageWithBasePath from "../../imageWithBasePath";
import { useEffect, useState } from "react";
import { updateTheme } from "../../redux/themeSlice";
import { useDispatch, useSelector } from "react-redux";
import { setMobileSidebar } from "../../redux/sidebarSlice";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import { useAppSelector } from "@/core/redux/hooks";
import { clearAuth } from "@/core/redux/authSlice";
import { clearNotifications } from "@/core/redux/notificationSlice";
import { resolveImageUrl } from "@/environment";
import { clearAuthStorage } from "@/lib/auth-storage";
import { usePathname, useRouter } from "next/navigation";
import { getLoginRouteForPath } from "@/lib/routing";
import type { RootState } from "@/core/redux/store";
import NotificationBell from "@/components/common/NotificationBell";


const getProfileRouteForRole = (roleName?: string): string => {
  if (roleName === "TEACHER") return all_routes.teacherProfile;
  if (roleName === "STUDENT") return all_routes.studentProfile;
  if (roleName === "PARENT") return all_routes.parentProfile;
  return all_routes.profilesettings;
};

const getSettingsRouteForRole = (roleName?: string): string => {
  if (roleName === "TEACHER") return all_routes.teacherSettings;
  if (roleName === "STUDENT") return all_routes.studentSettings;
  if (roleName === "PARENT") return all_routes.parentSettings;
  return all_routes.profilesettings;
};

const getScheduleRouteForRole = (roleName?: string): string => {
  if (roleName === "TEACHER") return all_routes.teacherSchedule;
  if (roleName === "STUDENT") return all_routes.studentSchedule;
  if (roleName === "PARENT") return all_routes.parentSchedule;
  return all_routes.adminClassSchedule;
};

const Header = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAppSelector((state) => state.auth.user);
  const displayName = authUser?.username ?? "User";
  const roleLabel = authUser?.role?.name ?? "Staff";
  const profileRoute = getProfileRouteForRole(authUser?.role?.name);
  const settingsRoute = getSettingsRouteForRole(authUser?.role?.name);
  const scheduleRoute = getScheduleRouteForRole(authUser?.role?.name);
  const avatarSrc = authUser?.profileImg
    ? `${resolveImageUrl(authUser.profileImg)}`
    : "/assets/img/users/user-01.jpg";
  const themeSettings = useSelector(
    (state: RootState) => state.theme.themeSettings
  );
  const [isHiddenLayoutActive, setIsHiddenLayoutActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [clock, setClock] = useState("");
  const [isSidebarOpened, setIsSidebarOpened] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Load hidden layout state from localStorage on client only
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined"
        ? window.localStorage.getItem("hiddenLayoutActive")
        : null;
      setIsHiddenLayoutActive(saved ? JSON.parse(saved) : false);
    } catch {
      // no-op if storage is unavailable
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const htmlElement: any = document.documentElement;
    Object.entries(themeSettings).forEach(([key, value]) => {
      htmlElement.setAttribute(key, value);
    });
  }, [themeSettings]);

  const handleUpdateTheme = (key: string, value: string) => {
    if (themeSettings["dir"] === "rtl" && key !== "dir") {
      dispatch(updateTheme({ dir: "ltr" }));
    }
    dispatch(updateTheme({ [key]: value }));
  };

  const toggleMobileSidebar = () => {
    const body = document.body;
    const isOpened = !body.classList.contains("slide-nav");
    body.classList.toggle("slide-nav");
    setIsSidebarOpened(isOpened);
    dispatch(setMobileSidebar(isOpened));
  };

  const handleToggleHiddenLayout = () => {
    // Only apply this functionality when layout is "hidden"
    if (themeSettings["data-layout"] === "hidden") {
      const newState = !isHiddenLayoutActive;
      setIsHiddenLayoutActive(newState);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("hiddenLayoutActive", JSON.stringify(newState));
      }
    }
  };

  // Sync body class with hidden layout state
  useEffect(() => {
    const bodyElement = document.body;
    const isHiddenLayout = themeSettings["data-layout"] === "hidden";
    if (isHiddenLayout) {
      if (isHiddenLayoutActive) {
        bodyElement.classList.add("hidden-layout");
      } else {
        bodyElement.classList.remove("hidden-layout");
      }
    } else {
      bodyElement.classList.remove("hidden-layout");
      setIsHiddenLayoutActive(false);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("hiddenLayoutActive");
      }
    }
  }, [isHiddenLayoutActive, themeSettings]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleLogout = () => {
    clearAuthStorage();
    dispatch(clearAuth());
    dispatch(clearNotifications());
    router.replace(getLoginRouteForPath(pathname));
  };

  return (
    <>
      {/* Topbar Start */}
      <header className="navbar-header">
        <div className="page-container topbar-menu">
          <div className="d-flex align-items-center gap-2">
            {/* Logo */}
            <Link href={all_routes.dashboard} className="logo" style={{ textDecoration: 'none' }}>
              {/* Logo Normal */}
              <span className="logo-light">
                <span className="logo-lg">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a2e', letterSpacing: '0.2em' }}>LMS</span>
                  </span>
                </span>
                <span className="logo-sm">
                  <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.9rem', padding: '4px 8px', borderRadius: '6px', letterSpacing: '0.05em', display: 'inline-block' }}>QA</span>
                </span>
              </span>
              {/* Logo Dark */}
              <span className="logo-dark">
                <span className="logo-lg">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#e2e8f0', letterSpacing: '0.2em' }}>LMS</span>
                  </span>
                </span>
              </span>
            </Link>
            {/* Sidebar Mobile Button */}
            <Link
              id="mobile_btn"
              className="mobile-btn"
              href="#"
              onClick={toggleMobileSidebar}
            >
              <i className="ti ti-menu-deep fs-24" />
            </Link>
            <button
              className="sidenav-toggle-btn btn border-0 p-0 active"
              id="toggle_btn2"
              onClick={handleToggleHiddenLayout}
            >
              <i className="ti ti-arrow-right" />
            </button>
            {/* Digital Clock */}
            <div className="d-lg-flex d-none align-items-center me-2" style={{ minWidth: 110 }}>
              <span style={{
                fontVariantNumeric: "tabular-nums",
                fontSize: "0.85rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "var(--pr-body-color, #374151)",
                background: "var(--pr-secondary-bg, #f3f4f6)",
                border: "1px solid var(--pr-border-color, #e5e7eb)",
                borderRadius: "6px",
                padding: "4px 10px",
              }}>
                <i className="ti ti-clock me-1" style={{ fontSize: "0.8rem" }} />
                {clock}
              </span>
            </div>
            {/* Search */}
            <div className="me-auto d-flex align-items-center header-search d-lg-flex d-none">
              {/* Search */}
              <div className="input-icon-start position-relative me-2">
                <span className="input-icon-addon">
                  <i className="ti ti-search" />
                </span>
                <input
                  type="text"
                  className="form-control shadow-sm"
                  placeholder="Search"
                />
                <span className="input-icon-addon text-dark shadow fs-18 d-inline-flex p-0 header-search-icon">
                  <i className="ti ti-command" />
                </span>
              </div>
              {/* /Search */}
            </div>
          </div>
          <div className="d-flex align-items-center">
            {/* Search for Mobile */}
            <div className="header-item d-flex d-lg-none me-2">
              <button
                className="topbar-link btn btn-icon"
                data-bs-toggle="modal"
                data-bs-target="#searchModal"
                type="button"
              >
                <i className="ti ti-search fs-16" />
              </button>
            </div>
            {/* AI Assistance */}
            {/* <Link
              href="#"
              className="btn btn-liner-gradient me-3 d-lg-flex d-none"
            >
              AI Assistance
              <i className="ti ti-chart-bubble-filled ms-1" />
            </Link> */}
            {/* AI Assistance */}
            {/* Appointment */}
            <div className="header-item">
              <div className="dropdown me-2">
                <Link href={scheduleRoute} className="btn topbar-link">
                  <i className="ti ti-calendar-due" />
                </Link>
              </div>
            </div>
            {/* Appointment */}
            {/* Settings */}
            {/* <div className="header-item">
              <div className="dropdown me-2">
                <Link href={settingsRoute} className="btn topbar-link">
                  <i className="ti ti-settings-2" />
                </Link>
              </div>
            </div> */}
            {/* Settings */}
            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #e7e8eb",
                background: "transparent",
                cursor: "pointer",
                marginRight: 8,
                color: "#0a1b39",
                flexShrink: 0,
              }}
            >
              <i className={`ti ${isFullscreen ? "ti-arrows-minimize" : "ti-arrows-maximize"}`} style={{ fontSize: 16 }} />
            </button>
            {/* Light/Dark Mode Button */}
            {isMounted && (
              <div className="header-item d-none d-sm-flex me-2">
                <Link
                  href="#"
                  id="dark-mode-toggle"
                  className={`btn btn-outline-primary btn-icon btn-sm header-togglebtn ${
                    themeSettings["data-bs-theme"] === "dark" ? "activate" : ""
                  }`}
                  onClick={() => handleUpdateTheme("data-bs-theme", "light")}
                >
                  <i className="ti ti-sun fs-16" />
                </Link>
                {/* Light Mode Toggle */}
                <Link
                  href="#"
                  id="light-mode-toggle"
                  className={`btn btn-outline-primary btn-icon btn-sm header-togglebtn ${
                    themeSettings["data-bs-theme"] === "light" ? "activate" : ""
                  }`}
                  onClick={() => handleUpdateTheme("data-bs-theme", "dark")}
                >
                  <i className="ti ti-moon fs-16" />
                </Link>
              </div>
            )}
            {/* Notification Bell */}
            <div className="header-item">
              <NotificationBell />
            </div>
            {/* User Dropdown */}
            <div className="dropdown profile-dropdown d-flex align-items-center justify-content-center">
              <Link
                href="#"
                className="topbar-link dropdown-toggle drop-arrow-none position-relative"
                data-bs-toggle="dropdown"
                data-bs-offset="0,22"
                aria-haspopup="false"
                aria-expanded="false"
              >
                <img
                  src={avatarSrc}
                  width={32}
                  height={32}
                  className="rounded-circle d-flex"
                  alt="user-image"
                  style={{ objectFit: "cover" }}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
                />
                <span className="online text-success">
                  <i className="ti ti-circle-filled d-flex bg-white rounded-circle border border-1 border-white" />
                </span>
              </Link>
              <div className="dropdown-menu dropdown-menu-end dropdown-menu-md p-2">
                <div className="d-flex align-items-center bg-light rounded-3 p-2 mb-2">
                  <img
                    src={avatarSrc}
                    className="rounded-circle"
                    width={42}
                    height={42}
                    alt=""
                    style={{ objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
                  />
                  <div className="ms-2">
                    <p className="fw-medium text-dark mb-0 text-capitalize">
                      {displayName}
                    </p>
                    <span className="d-block fs-13 text-uppercase">
                      {roleLabel}
                    </span>
                  </div>
                </div>
                {/* Item*/}
                <Link href={profileRoute} className="dropdown-item">
                  <i className="ti ti-user-circle me-1 align-middle" />
                  <span className="align-middle">Profile Settings</span>
                </Link>
                <div className="pt-2 mt-2 border-top">
                  <button
                    type="button"
                    className="dropdown-item text-danger d-flex align-items-center gap-2"
                    onClick={handleLogout}
                  >
                    <i className="ti ti-logout me-1 fs-17 align-middle" />
                    <span className="align-middle">Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* Topbar End */}
      {/* Search Modal */}
      <div className="modal fade" id="searchModal">
        <div className="modal-dialog modal-lg">
          <div className="modal-content bg-transparent">
            <div className="card shadow-none mb-0">
              <div
                className="px-3 py-2 d-flex flex-row align-items-center"
                id="search-top"
              >
                <i className="ti ti-search fs-22" />
                <input
                  type="search"
                  className="form-control border-0"
                  placeholder="Search"
                />
                <button
                  type="button"
                  className="btn p-0"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x fs-22" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    <div className={`sidebar-overlay${isSidebarOpened ? " opened" : ""}`}></div>
    </>
  );
};

export default Header;
