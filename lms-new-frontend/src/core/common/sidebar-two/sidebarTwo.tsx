"use client";


import ImageWithBasePath from "../../imageWithBasePath";
import  { useState, useEffect, useCallback } from "react";
import { updateTheme } from "../../redux/themeSlice";
import { useDispatch, useSelector } from "react-redux";
import { setExpandMenu, setMobileSidebar } from "../../redux/sidebarSlice";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";

const SidebarTwo = () => {
  const location = usePathname();

  const isActive = (path: string) => location === path;

  // State to manage open submenus
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>(
    {}
  );

  // Helper to check if any submenu child is active
  const isAnyActive = (paths: string[]) => paths.some(isActive);

   const mobileSidebar = useSelector(
      (state: any) => state.sidebarSlice.mobileSidebar
    );
     const toggleMobileSidebar = () => {
        dispatch(setMobileSidebar(!mobileSidebar));
      };

  // Open submenu if a child route is active
  useEffect(() => {
    setOpenSubmenus((prev) => ({
      ...prev,
      appointments: isAnyActive([
        all_routes.doctorsappointments,
        all_routes.onlineconsultations,
      ]),
      settings: isAnyActive([
        all_routes.doctorsprofilesettings,
        all_routes.doctorspasswordsettings,
        all_routes.doctorsnotificationsettings,
      ]),
    }));
    // eslint-disable-next-line
  }, [location]);

  // Toggle submenu open/close
  const handleToggle = (submenu: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [submenu]: !prev[submenu],
    }));
  };


    const dispatch = useDispatch();

   const handleMiniSidebar = () => {
      const rootElement = document.documentElement;
      const isMini = rootElement.getAttribute("data-layout") === "mini";
      const updatedLayout = isMini ? "default" : "mini";
      dispatch(
        updateTheme({
          "data-layout": updatedLayout,
        })
      );
      if (isMini) {
        rootElement.classList.remove("mini-sidebar");
      } else {
        rootElement.classList.add("mini-sidebar");
      }
    };
    // const onMouseEnter = () => {
    //   dispatch(setExpandMenu(true));
    // };
    // const onMouseLeave = () => {
    //   dispatch(setExpandMenu(false));
    // };

    const handleMouseEnter = useCallback(() => {
      const body = document.body;
      if (body.classList.contains('mini-sidebar')) {
        body.classList.add('expand-menu');
      }
      dispatch(setExpandMenu(true));
    }, [dispatch]);

    // Handle mouse leave for mini sidebar
    const handleMouseLeave = useCallback(() => {
      const body = document.body;
      if (body.classList.contains('mini-sidebar')) {
        body.classList.remove('expand-menu');
      }
      dispatch(setExpandMenu(false));
    }, [dispatch]);

  return (
    <>
      {/* Sidenav Menu Start */}
      <div className="sidebar doctor-sidebar" id="sidebar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}>
        {/* Start Logo */}
        <div className="sidebar-logo">
          <div>
            {/* Logo Normal */}
            <Link href={all_routes.dashboard} className="logo logo-normal" style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a2e', letterSpacing: '0.2em' }}>LMS</span>
              </span>
            </Link>
            {/* Logo Small */}
            <Link href={all_routes.dashboard} className="logo-small" style={{ textDecoration: 'none' }}>
              <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.85rem', padding: '4px 7px', borderRadius: '6px', letterSpacing: '0.05em', display: 'inline-block' }}>QA</span>
            </Link>
            {/* Logo Dark */}
            <Link href={all_routes.dashboard} className="dark-logo" style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#e2e8f0', letterSpacing: '0.2em' }}>LMS</span>
              </span>
            </Link>
          </div>
         <button
            className="sidenav-toggle-btn btn border-0 p-0 active"
            id="toggle_btn"
            onClick={handleMiniSidebar}
          >
            <i className="ti ti-arrow-left" />
          </button>
          {/* Sidebar Menu Close */}
          <button className="sidebar-close" onClick={toggleMobileSidebar}>
            <i className="ti ti-x align-middle" />
          </button>
        </div>
        {/* End Logo */}
        {/* Sidenav Menu */}
        <div className="sidebar-inner" data-simplebar="">
          <div id="sidebar-menu" className="sidebar-menu">
            <ul>
              <li className="menu-title">
                <span>Main Menu</span>
              </li>
              <li>
                <ul>
                  <li
                    className={
                      isActive(all_routes.doctordashboard) ? "active" : ""
                    }
                  >
                    <Link href={all_routes.doctordashboard}>
                      <i className="ti ti-layout-dashboard" />
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(all_routes.doctorProfileCompletion) ? "active" : ""
                    }
                  >
                    <Link href={all_routes.doctorProfileCompletion}>
                      <i className="ti ti-clipboard-check" />
                      <span>Complete Profile</span>
                    </Link>
                  </li>
                  {/* Appointments Submenu */}
                  <li
                    className={`submenu${
                      openSubmenus.appointments ? " active" : ""
                    }`}
                  >
                    <Link
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle("appointments");
                      }}
                    >
                      <i className="ti ti-calendar-check" />
                      <span>Appointments</span>
                      <span className="menu-arrow">
                        <i
                          className={
                            openSubmenus.appointments
                              ? "ti ti-chevron-down"
                              : "ti ti-chevron-right"
                          }
                        />
                      </span>
                    </Link>
                    <ul
                      style={{
                        display: openSubmenus.appointments ? "block" : "none",
                      }}
                    >
                      <li>
                        <Link
                          href={all_routes.doctorsappointments}
                          className={
                            isActive(all_routes.doctorsappointments) ||
                            isActive(all_routes.doctorsappointmentdetails)
                              ? "active"
                              : ""
                          }
                        >
                          Appointments
                        </Link>
                      </li>
                      <li>
                        <Link
                          href={all_routes.onlineconsultations}
                          className={
                            isActive(all_routes.onlineconsultations)
                              ? "active"
                              : ""
                          }
                        >
                          Online Consultations
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li
                    className={
                      isActive(all_routes.doctorschedule) ? "active" : ""
                    }
                  >
                    <Link href={all_routes.doctorschedule}>
                      <i className="ti ti-clock-check" />
                      <span>My Schedule</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(all_routes.doctorsprescriptions)
                        ? "active"
                        : isActive(all_routes.doctorsprescriptiondetails)
                        ? "active"
                        : ""
                    }
                  >
                    <Link href={all_routes.doctorsprescriptions}>
                      <i className="ti ti-prescription" />
                      <span>Prescriptions</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(all_routes.doctorleaves) ? "active" : ""
                    }
                  >
                    <Link href={all_routes.doctorleaves}>
                      <i className="ti ti-calendar-x" />
                      <span>Leave</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(all_routes.doctorreviews) ? "active" : ""
                    }
                  >
                    <Link href={all_routes.doctorreviews}>
                      <i className="ti ti-star" />
                      <span>Reviews</span>
                    </Link>
                  </li>
                  {/* Settings Submenu */}
                  <li
                    className={`submenu${
                      openSubmenus.settings ? " active" : ""
                    }`}
                  >
                    <Link
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle("settings");
                      }}
                    >
                      <i className="ti ti-settings" />
                      <span>Settings</span>
                      <span className="menu-arrow">
                        <i
                          className={
                            openSubmenus.settings
                              ? "ti ti-chevron-down"
                              : "ti ti-chevron-right"
                          }
                        />
                      </span>
                    </Link>
                    <ul
                      style={{
                        display: openSubmenus.settings ? "block" : "none",
                      }}
                    >
                      <li>
                        <Link
                          href={all_routes.doctorsprofilesettings}
                          className={
                            isActive(all_routes.doctorsprofilesettings)
                              ? "active"
                              : ""
                          }
                        >
                          Profile Settings
                        </Link>
                      </li>
                      <li>
                        <Link
                          href={all_routes.doctorspasswordsettings}
                          className={
                            isActive(all_routes.doctorspasswordsettings)
                              ? "active"
                              : ""
                          }
                        >
                          Change Password
                        </Link>
                      </li>
                      <li>
                        <Link
                          href={all_routes.doctorsnotificationsettings}
                          className={
                            isActive(all_routes.doctorsnotificationsettings)
                              ? "active"
                              : ""
                          }
                        >
                          Notifications
                        </Link>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
      </div>
      {/* Sidenav Menu End */}
    </>
  );
};

export default SidebarTwo;
