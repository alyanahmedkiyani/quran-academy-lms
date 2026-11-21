import { useState, useEffect, useCallback } from "react";
import ImageWithBasePath from "../../imageWithBasePath";
import { useDispatch, useSelector } from "react-redux";
import { updateTheme } from "../../redux/themeSlice";
import { setExpandMenu, setMobileSidebar } from "../../redux/sidebarSlice";
import { all_routes } from "@/routes/all_routes";
import { usePathname } from "next/navigation";
import Link from "next/link";

const Sidebarthree = () => {
  const location = usePathname();
  const routes = all_routes;

  // State for open submenus
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({
    settings: false,
  });

  // Open settings submenu if on a settings route
  useEffect(() => {
    const isSettingsRoute = location
      ? [
          routes.patientprofilesettings,
          routes.patientpasswordsettings,
          routes.patientnotificationssettings,
        ].includes(location)
      : false;
    setOpenSubmenus((prev) => ({
      ...prev,
      settings: isSettingsRoute ? true : prev.settings,
    }));
  }, [location, routes]);

  const isActive = (path: string) => location !== null && location === path;

  const handleToggle = (menu: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
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
    if (body.classList.contains("mini-sidebar")) {
      body.classList.add("expand-menu");
    }
    dispatch(setExpandMenu(true));
  }, [dispatch]);

  // Handle mouse leave for mini sidebar
  const handleMouseLeave = useCallback(() => {
    const body = document.body;
    if (body.classList.contains("mini-sidebar")) {
      body.classList.remove("expand-menu");
    }
    dispatch(setExpandMenu(false));
  }, [dispatch]);

  const mobileSidebar = useSelector(
    (state: any) => state.sidebarSlice.mobileSidebar
  );
  const toggleMobileSidebar = () => {
    dispatch(setMobileSidebar(!mobileSidebar));
  };

  return (
    <>
      {/* Sidenav Menu Start */}
      <div
        className="sidebar doctor-sidebar"
        id="sidebar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Start Logo */}
        <div className="sidebar-logo">
          <div>
            {/* Logo Normal */}
            <Link href={routes.dashboard} className="logo logo-normal" style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>QA</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a1a2e', letterSpacing: '0.2em' }}>LMS</span>
              </span>
            </Link>
            {/* Logo Small */}
            <Link href={routes.dashboard} className="logo-small" style={{ textDecoration: 'none' }}>
              <span style={{ background: 'linear-gradient(135deg, #4361EE 0%, #7209B7 100%)', color: '#fff', fontWeight: 900, fontSize: '0.85rem', padding: '4px 7px', borderRadius: '6px', letterSpacing: '0.05em', display: 'inline-block' }}>QA</span>
            </Link>
            {/* Logo Dark */}
            <Link href={routes.dashboard} className="dark-logo" style={{ textDecoration: 'none' }}>
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
                      isActive(routes.patientdashboard) ? "active" : ""
                    }
                  >
                    <Link href={routes.patientdashboard}>
                      <i className="ti ti-layout-dashboard" />
                      <span>Dashboard</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(routes.patientappointments) ||
                      isActive(routes.patientappointmentdetails)
                        ? "active"
                        : ""
                    }
                  >
                    <Link href={routes.patientappointments}>
                      <i className="ti ti-calendar-check" />
                      <span>Appointments</span>
                    </Link>
                  </li>
                  <li
                    className={isActive(routes.patientdoctors) ? "active" : ""}
                  >
                    <Link href={routes.patientdoctors}>
                      <i className="ti ti-stethoscope" />
                      <span>Doctors</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(routes.patientPrescriptions) ||
                      isActive(routes.patientprescriptiondetails)
                        ? "active"
                        : ""
                    }
                  >
                    <Link href={routes.patientPrescriptions}>
                      <i className="ti ti-prescription" />
                      <span>Prescriptions</span>
                    </Link>
                  </li>
                  <li
                    className={
                      isActive(routes.patientinvoices) ||
                      isActive(routes.patientinvoicedetails)
                        ? "active"
                        : ""
                    }
                  >
                    <Link href={routes.patientinvoices}>
                      <i className="ti ti-star" />
                      <span>Invoice</span>
                    </Link>
                  </li>
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
                          href={routes.patientprofilesettings}
                          className={
                            isActive(routes.patientprofilesettings)
                              ? "active"
                              : ""
                          }
                        >
                          Profile Settings
                        </Link>
                      </li>
                      <li>
                        <Link
                          href={routes.patientpasswordsettings}
                          className={
                            isActive(routes.patientpasswordsettings)
                              ? "active"
                              : ""
                          }
                        >
                          Change Password
                        </Link>
                      </li>
                      <li>
                        <Link
                          href={routes.patientnotificationssettings}
                          className={
                            isActive(routes.patientnotificationssettings)
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

export default Sidebarthree;
