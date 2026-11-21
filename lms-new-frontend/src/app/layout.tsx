import BootstrapJs from "../core/common/bootstrap-js/bootstrapjs";
import "../../node_modules/bootstrap/dist/css/bootstrap.min.css";
import "../../node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "../../node_modules/@fortawesome/fontawesome-free/css/all.min.css";
import "../../node_modules/@tabler/icons-webfont/dist/tabler-icons.css";
import "../../src/style/css/iconsax.css";
import "../../src/style/scss/index.scss";
import "../../src/style/css/feather.css";
import Providers from "./Providers";

export const metadata = {
  title: "QA LMS | Advanced Learning Management System for Academies",
  description: "A smart and flexible LMS platform to manage courses, teachers, and students online. Ideal for academies and e-learning platforms.",
  keywords: "QA LMS, learning management system, online academy, LMS platform, e-learning, course management, student management",
  author: "QA LMS",
  icons: {
    icon: "favicon-qa.svg",
    shortcut: "favicon-qa.svg",
    apple: "favicon-qa.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning={true}>
        <Providers>{children}</Providers>
        <BootstrapJs />
      </body>
    </html>
  );
}
