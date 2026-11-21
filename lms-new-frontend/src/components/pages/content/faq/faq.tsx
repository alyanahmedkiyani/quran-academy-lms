"use client";

import { useEffect, useState } from "react";
import { getPublishedFAQs } from "@/services/faqService";
import { FAQ } from "@/types/faq";

const CATEGORY_ICONS: Record<string, string> = {
  General: "help-circle",
  Courses: "book",
  Assignments: "clipboard-text",
  Schedule: "calendar",
  Attendance: "user-check",
  Fees: "credit-card",
  Technical: "settings",
  Other: "dots-circle-horizontal",
};

const FaqComponent = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    getPublishedFAQs()
      .then(setFaqs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(faqs.map((f) => f.category)))];

  const filtered = faqs.filter((f) => {
    if (activeCategory !== "All" && f.category !== activeCategory) return false;
    if (search && !f.question.toLowerCase().includes(search.toLowerCase()) &&
        !f.answer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="text-center pb-4 mb-2">
          <h3 className="fw-bold mb-2">Frequently Asked Questions</h3>
          <p className="text-muted mb-4">Find answers to common questions about the LMS platform</p>
          {/* Search */}
          <div className="d-flex justify-content-center">
            <div className="input-group" style={{ maxWidth: 480 }}>
              <span className="input-group-text bg-white border-end-0">
                <i className="ti ti-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="d-flex gap-2 flex-wrap justify-content-center mb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${activeCategory === cat ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat !== "All" && CATEGORY_ICONS[cat] && (
                  <i className={`ti ti-${CATEGORY_ICONS[cat] ?? "circle"} me-1`} />
                )}
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-5 text-muted">Loading FAQs...</div>
        ) : error ? (
          <div className="alert alert-danger mx-auto" style={{ maxWidth: 600 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5">
            <i className="ti ti-help-circle fs-1 text-muted d-block mb-2" />
            <p className="text-muted">
              {search ? `No FAQs match "${search}".` : "No FAQs available yet."}
            </p>
          </div>
        ) : (
          <div className="accordion mx-auto" style={{ maxWidth: 780 }} id="faqAccordion">
            {filtered.map((f, idx) => {
              const isOpen = openId === f.id;
              return (
                <div key={f.id} className="accordion-item border mb-2 rounded shadow-sm overflow-hidden">
                  <h2 className="accordion-header">
                    <button
                      className={`accordion-button fw-medium ${isOpen ? "" : "collapsed"} bg-white`}
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : f.id)}
                      style={{ boxShadow: "none" }}
                    >
                      <span className="me-3 text-muted small">
                        <span className="badge bg-soft-primary text-primary border border-primary fw-medium">
                          {f.category}
                        </span>
                      </span>
                      {f.question}
                    </button>
                  </h2>
                  <div className={`accordion-collapse collapse ${isOpen ? "show" : ""}`}>
                    <div className="accordion-body text-muted" style={{ whiteSpace: "pre-wrap" }}>
                      {f.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && faqs.length > 0 && (
          <div className="text-center mt-5 text-muted small">
            <i className="ti ti-headset me-1" />
            Still have questions? Use the{" "}
            <strong>Support</strong> section to submit a help request.
          </div>
        )}
      </div>
    </div>
  );
};

export default FaqComponent;
