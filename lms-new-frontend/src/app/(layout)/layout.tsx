"use client";

import Header from "@/core/common/header/header";
import Sidebar from "@/core/common/sidebar/sidebar";
import Footer from "@/core/common/footer/footer";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ThemeLayouts({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const htmlElement = document.documentElement;

    document.body.classList.remove("mini-sidebar", "expand-menu");

    const attrsToClear = ["data-sidebar", "data-theme", "data-topbar", "data-topbarcolor", "data-color"];
    attrsToClear.forEach((attr) => htmlElement.removeAttribute(attr));
    document.body.removeAttribute("data-sidebarbg");
    document.body.removeAttribute("data-topbarbg");

    switch (pathname) {
      case "/layout-mini":
        htmlElement.setAttribute("data-layout", "mini");
        document.body.classList.add("mini-sidebar");
        break;
      case "/layout-hover-view":
        htmlElement.setAttribute("data-layout", "hoverview");
        break;
      case "/layout-hidden":
        htmlElement.setAttribute("data-layout", "hidden");
        break;
      case "/layout-full-width":
        htmlElement.setAttribute("data-layout", "full-width");
        break;
      case "/layout-dark":
        htmlElement.setAttribute("data-bs-theme", "dark");
        break;
      default:
        htmlElement.setAttribute("data-layout", "default");
        break;
    }
  }, [pathname]);

  return (
    <div className="main-wrapper d-flex flex-column min-vh-100">
      <Header />
      <Sidebar />
      <div className="main-content flex-fill d-flex flex-column">
        <div className="flex-fill d-flex flex-column">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
