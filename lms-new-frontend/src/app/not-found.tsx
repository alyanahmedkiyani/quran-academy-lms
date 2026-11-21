import Link from "next/link";

const NotFoundPage = () => {
  return (
    <main className="not-found-page" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: "3rem", margin: 0 }}>404</h1>
        <p style={{ marginTop: "0.5rem", color: "#666" }}>We could not find the page you were looking for.</p>
      </div>
      <Link
        href="/"
        style={{
          padding: "0.75rem 1.5rem",
          borderRadius: "999px",
          border: "1px solid #0d6efd",
          color: "#0d6efd",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Go back home
      </Link>
    </main>
  );
};

export default NotFoundPage;

