"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fetchAdminDashboardStats, type DashboardStats } from "@/services/dashboardService";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
import SCol2Chart from "../chats/scol2";
import SCol3Chart from "../chats/scol3";
import SCol4Chart from "../chats/scol4";
import SCol19Chart from "../chats/scol19";
import CircleChart from "../chats/circleChart";
import MonthlyRevenueExpensesChart from "../chats/MonthlyRevenueExpensesChart";
import CashFlowChart from "../chats/CashFlowChart";
import StudentGradeChart from "../chats/StudentGradeChart";
import TopCoursesChart from "../chats/TopCoursesChart";
import FinanceSummaryCards from "../FinanceSummaryCards";
import { Calendar } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Link from "next/link";
import { getSessionsList, getPendingApprovals, type SessionListItem } from "@/services/classScheduleService";
import { fetchAllAssignmentsAdmin } from "@/services/assignmentService";
import { fetchAllQuizzesAdmin } from "@/services/quizService";
import { all_routes } from "@/routes/all_routes";
import ImageWithBasePath from "@/core/imageWithBasePath";
import { useAppSelector } from "@/core/redux/hooks";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { getAllFees, getAllPlanChangeRequests, fetchRecentFeePayments } from "@/services/feesService";
import { fetchAllPlans } from "@/services/planService";
import { fetchAllStudents } from "@/services/studentService";
import { getAllSalaries } from "@/services/salaryService";
import { getAllFAQs } from "@/services/faqService";
import { getAllSupportRequests } from "@/services/supportService";
import { getAdminFeedbackSummary } from "@/services/feedbackService";
import type { AdminFeedbackSummaryResponse } from "@/types/feedback";
import { getAdminStudentAttendance, getAdminTeacherAttendance } from "@/services/attendanceService";
import { resolveImageUrl } from "@/environment";
import { fetchStudentCountryStats, fetchTopStudents, type TopStudent } from "@/services/studentService";
import { fetchTopCoursesByEnrollment } from "@/services/courseDetailsService";
const StudentWorldMap = dynamic(() => import("./StudentWorldMap"), { ssr: false });

const colorHex: Record<string, string> = {
  primary: "#4F46E5",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#0891B2",
  secondary: "#64748B",
};

const colorBg: Record<string, string> = {
  primary: "./assets/img/bg/bg-01.svg",
  danger: "./assets/img/bg/bg-02.svg",
  info: "./assets/img/bg/bg-03.svg",
  success: "./assets/img/bg/bg-04.svg",
  warning: "./assets/img/bg/bg-01.svg",
  secondary: "./assets/img/bg/bg-02.svg",
};

const ModuleStatCard = ({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) => {
  const hex = colorHex[color] ?? "#4F46E5";
  const bg = colorBg[color] ?? "./assets/img/bg/bg-01.svg";
  return (
    <div
      className="position-relative border card rounded-2 shadow-sm h-100"
      style={{ minHeight: 110, borderLeft: `4px solid ${hex}` }}
    >
      <ImageWithBasePath src={bg} alt="" className="position-absolute start-0 top-0" />
      <div className="card-body position-relative d-flex flex-column py-4 px-4">
        <span className={`avatar avatar-lg bg-${color} rounded-circle mb-3`}>
          <i className={`ti ${icon} fs-24`} />
        </span>
        <div className="fw-bold" style={{ fontSize: 26, lineHeight: 1.1, color: "#1e293b" }}>
          {value}
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: 4, fontWeight: 500 }}>
          {label}
        </div>
      </div>
    </div>
  );
};

const DashboardComponent = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const user = useAppSelector((state) => state.auth.user);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canViewTeachers = canAccess(roleName, permissions, PERMISSIONS.TEACHERS_VIEW);
  const canViewStudents = canAccess(roleName, permissions, PERMISSIONS.STUDENTS_VIEW);
  const canViewCourses = canAccess(roleName, permissions, PERMISSIONS.COURSES_VIEW);
  const canViewFinance = canAccess(roleName, permissions, PERMISSIONS.FINANCE_VIEW);
  const canViewSalary = canAccess(roleName, permissions, PERMISSIONS.SALARY_VIEW);
  const canViewFeedback = canAccess(roleName, permissions, PERMISSIONS.FEEDBACK_VIEW);
  const canViewPlans = canAccess(roleName, permissions, PERMISSIONS.PLANS_VIEW);
  const canViewSupport = canAccess(roleName, permissions, PERMISSIONS.SUPPORT_VIEW);
  const canViewFAQ = canAccess(roleName, permissions, PERMISSIONS.FAQ_MANAGE);

  // Module summary stats state
  interface FeeStats {
    total: number;
    collected: number;
    outstanding: number;
    overdue: number;
    proof: number;
    pendingAmount: number;
    overdueAmount: number;
  }
  interface SubStats {
    totalPlans: number;
    withPlan: number;
    withoutPlan: number;
    pendingReqs: number;
  }
  interface SalaryStats {
    paid: number;
    unpaid: number;
    partial: number;
    overdue: number;
  }
  interface FAQStats {
    total: number;
    published: number;
    draft: number;
    categories: number;
  }
  interface SupportStats {
    total: number;
    pending: number;
    resolved: number;
    rejected: number;
  }

  const [feeStats, setFeeStats] = useState<FeeStats | null>(null);
  const [subStats, setSubStats] = useState<SubStats | null>(null);
  const [salaryStats, setSalaryStats] = useState<SalaryStats | null>(null);
  const [faqStats, setFaqStats] = useState<FAQStats | null>(null);
  const [supportStats, setSupportStats] = useState<SupportStats | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<AdminFeedbackSummaryResponse | null>(null);

  // Academy Pulse live counts
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [pendingQuizzes, setPendingQuizzes] = useState(0);
  const [pendingProposals, setPendingProposals] = useState(0);

  const visibleCardCount = [canViewTeachers, canViewStudents, canViewCourses, canViewFinance].filter(Boolean).length;
  const statColClass =
    visibleCardCount === 1
      ? "col-12"
      : visibleCardCount === 2
        ? "col-xl-6 col-md-6"
        : visibleCardCount === 3
          ? "col-xl-4 col-md-6"
          : "col-xl-3 col-md-6";

  useEffect(() => {
    fetchAdminDashboardStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    // Fees stats
    if (canViewFinance) {
      Promise.all([getAllFees(), getAllPlanChangeRequests()])
        .then(([fees, reqs]) => {
          const pendingAmount = fees.filter((f) => f.status === "pending").reduce((s, f) => s + Number(f.amount), 0);
          const overdueAmount = fees.filter((f) => f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
          setFeeStats({
            total: fees.length,
            collected: fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0),
            outstanding: pendingAmount + overdueAmount,
            overdue: fees.filter((f) => f.status === "overdue").length,
            proof: fees.filter((f) => f.proofPath).length,
            pendingAmount,
            overdueAmount,
          });
          const withPlan = 0; // computed below when canViewPlans
          const pendingReqs = reqs.filter((r) => r.status === "pending").length;
          if (canViewPlans) {
            Promise.all([fetchAllPlans(), fetchAllStudents()])
              .then(([plans, res]) => {
                const students = res.students;
                setSubStats({
                  totalPlans: plans.length,
                  withPlan: students.filter((s: any) => s.planId).length,
                  withoutPlan: students.filter((s: any) => !s.planId).length,
                  pendingReqs,
                });
              })
              .catch(console.error);
          }
        })
        .catch(console.error);
    }
    // Salary stats
    if (canViewSalary) {
      getAllSalaries()
        .then((salaries) => {
          const sum = (status: string) =>
            salaries.filter((s) => s.status === status).reduce((a, s) => a + Number(s.amount), 0);
          setSalaryStats({
            paid: sum("paid"),
            unpaid: sum("unpaid"),
            partial: sum("partial"),
            overdue: sum("overdue"),
          });
        })
        .catch(console.error);
    }
    // FAQ stats
    if (canViewFAQ) {
      getAllFAQs()
        .then((faqs) => {
          setFaqStats({
            total: faqs.length,
            published: faqs.filter((f) => f.isPublished).length,
            draft: faqs.filter((f) => !f.isPublished).length,
            categories: new Set(faqs.map((f) => f.category)).size,
          });
        })
        .catch(console.error);
    }
    // Support stats
    if (canViewSupport) {
      getAllSupportRequests()
        .then((reqs) => {
          setSupportStats({
            total: reqs.length,
            pending: reqs.filter((r) => r.status === "pending").length,
            resolved: reqs.filter((r) => r.status === "resolved").length,
            rejected: reqs.filter((r) => r.status === "rejected").length,
          });
        })
        .catch(console.error);
    }
    // Feedback stats
    if (canViewFeedback) {
      getAdminFeedbackSummary().then(setFeedbackStats).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Academy Pulse counts
  useEffect(() => {
    fetchAllAssignmentsAdmin()
      .then((res) => setPendingAssignments(res.assignments.filter((a) => a.status === "pending").length))
      .catch(console.error);
    fetchAllQuizzesAdmin()
      .then((res) => setPendingQuizzes(res.quizzes.filter((q) => q.status === "pending").length))
      .catch(console.error);
    getPendingApprovals()
      .then((proposals) => setPendingProposals(proposals.length))
      .catch(console.error);
  }, []);

  const fmt = (n: number) => n.toLocaleString();
  const pct = (n: number) => (n >= 0 ? `+${n}%` : `${n}%`);
  const fmtFees = (n: number) => "$" + (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : n.toFixed(0));
  const fmtAmt = (n: number) => "$" + (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : n.toFixed(0));

  const [activeModuleTab, setActiveModuleTab] = useState<string>("");

  // ── Class Schedule ──
  const [calendarDate, setCalendarDate] = useState<Dayjs>(dayjs());
  const [calendarMode, setCalendarMode] = useState<"month" | "year">("month");
  const [scheduleSessions, setScheduleSessions] = useState<SessionListItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const fetchScheduleSessions = (date: Dayjs, mode: "month" | "year" = "month") => {
    setScheduleLoading(true);
    getSessionsList({
      startDate:
        mode === "year" ? date.startOf("year").format("YYYY-MM-DD") : date.startOf("month").format("YYYY-MM-DD"),
      endDate: mode === "year" ? date.endOf("year").format("YYYY-MM-DD") : date.endOf("month").format("YYYY-MM-DD"),
    })
      .then((res) => setScheduleSessions(res.sessions))
      .catch(console.error)
      .finally(() => setScheduleLoading(false));
  };

  useEffect(() => {
    fetchScheduleSessions(dayjs(), "month");
  }, []);

  const selectedDateSessions = scheduleSessions
    .filter((s) => s.date === calendarDate.format("YYYY-MM-DD"))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const monthSessions = scheduleSessions
    .filter((s) => s.date.startsWith(calendarDate.format("YYYY-MM")))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  // ── Live sessions (real-time) ──
  const [liveSessions, setLiveSessions] = useState<SessionListItem[]>([]);
  useEffect(() => {
    getSessionsList({ sessionStatus: "live" })
      .then((res) => setLiveSessions(res.sessions))
      .catch(console.error);
  }, []);

  // ── Today's Sessions gauge ──
  const [todayGauge, setTodayGauge] = useState({ total: 0, done: 0, upcoming: 0, cancelled: 0 });
  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    getSessionsList({ startDate: today, endDate: today })
      .then((res) => {
        const s = res.sessions;
        setTodayGauge({
          total: s.length,
          done: s.filter((x) => x.sessionStatus === "ended").length,
          upcoming: s.filter((x) => x.sessionStatus === "idle" || x.sessionStatus === "live").length,
          cancelled: s.filter((x) => x.sessionStatus === "cancelled").length,
        });
      })
      .catch(console.error);
  }, []);

  // ── Teacher Check-ins gauge ──
  const [teacherCheckin, setTeacherCheckin] = useState({ present: 0, total: 0, pct: 0 });
  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    getAdminTeacherAttendance({ startDate: today, endDate: today, limit: 200 })
      .then((res) => {
        setTeacherCheckin({ present: res.stats.present, total: res.stats.total, pct: res.stats.percentage });
      })
      .catch(console.error);
  }, []);

  // ── Student Attendance gauge ──
  const [studentAttGauge, setStudentAttGauge] = useState({ present: 0, total: 0, pct: 0 });
  useEffect(() => {
    const today = dayjs().format("YYYY-MM-DD");
    getAdminStudentAttendance({ startDate: today, endDate: today, limit: 500 })
      .then((res) => {
        setStudentAttGauge({ present: res.stats.present, total: res.stats.total, pct: res.stats.percentage });
      })
      .catch(console.error);
  }, []);

  // ── Top 5 students ──
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  useEffect(() => {
    fetchTopStudents(5)
      .then((res) => setTopStudents(res.students))
      .catch(console.error);
  }, []);

  // ── Student country stats (world map) ──
  const [countryStats, setCountryStats] = useState<{ country: string; count: number }[]>([]);
  useEffect(() => {
    fetchStudentCountryStats()
      .then((res) => setCountryStats(res.countries))
      .catch(console.error);
  }, []);

  // ── Top courses by enrollment ──
  const [topCourses, setTopCourses] = useState<{ name: string; count: number }[]>([]);
  useEffect(() => {
    fetchTopCoursesByEnrollment(5)
      .then((res) => setTopCourses(res.courses))
      .catch(console.error);
  }, []);

  // ── Recent fee payments ──
  const [recentFees, setRecentFees] = useState<import("@/types/fees").Fee[]>([]);
  const [feeMonth, setFeeMonth] = useState<number>(new Date().getMonth() + 1);
  const feeYear = new Date().getFullYear();
  useEffect(() => {
    fetchRecentFeePayments(5, feeMonth, feeYear)
      .then(setRecentFees)
      .catch(console.error);
  }, [feeMonth]);

  // ── Recent sessions (dashboard table) ──
  const [recentSessions, setRecentSessions] = useState<SessionListItem[]>([]);
  useEffect(() => {
    getSessionsList({ sortDir: "desc", limit: "5" })
      .then((res) => setRecentSessions(res.sessions))
      .catch(console.error);
  }, []);

  // ── Session Completion Rate (this month) ──
  const [completionSeries, setCompletionSeries] = useState<number[]>([0, 0, 0]);
  const [completionCounts, setCompletionCounts] = useState({ completed: 0, cancelled: 0, upcoming: 0, total: 0 });
  useEffect(() => {
    const start = dayjs().startOf("month").format("YYYY-MM-DD");
    const end = dayjs().endOf("month").format("YYYY-MM-DD");
    getSessionsList({ startDate: start, endDate: end })
      .then((res) => {
        const sessions = res.sessions;
        const total = sessions.length;
        const completed = sessions.filter((s) => s.sessionStatus === "ended").length;
        const cancelled = sessions.filter((s) => s.sessionStatus === "cancelled").length;
        const upcoming = sessions.filter((s) => s.sessionStatus === "idle" || s.sessionStatus === "live").length;
        setCompletionCounts({ completed, cancelled, upcoming, total });
        if (total === 0) {
          setCompletionSeries([0, 0, 0]);
        } else {
          setCompletionSeries([
            Math.round((completed / total) * 100),
            Math.round((cancelled / total) * 100),
            Math.round((upcoming / total) * 100),
          ]);
        }
      })
      .catch(console.error);
  }, []);

  const sessionStatusBg: Record<string, string> = {
    live: "bg-soft-success",
    idle: "bg-light",
    ended: "bg-soft-secondary",
    scheduled: "bg-light",
    cancelled: "bg-soft-danger",
  };

  const sessionStatusBadge: Record<string, string> = {
    live: "badge-soft-success border-success text-success",
    idle: "badge-soft-primary border-primary",
    ended: "badge-soft-secondary border-secondary",
    scheduled: "badge-soft-info border-info",
    cancelled: "badge-soft-danger border-danger",
  };

  // pick first available tab on mount
  useEffect(() => {
    if (!activeModuleTab) {
      if (canViewFinance && feeStats) {
        setActiveModuleTab("fees");
        return;
      }
      if (canViewPlans && subStats) {
        setActiveModuleTab("subs");
        return;
      }
      if (canViewSalary && salaryStats) {
        setActiveModuleTab("salary");
        return;
      }
      if (canViewFAQ && faqStats) {
        setActiveModuleTab("faq");
        return;
      }
      if (canViewSupport && supportStats) {
        setActiveModuleTab("support");
        return;
      }
      if (canViewFeedback && feedbackStats) {
        setActiveModuleTab("feedback");
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeStats, subStats, salaryStats, faqStats, supportStats, feedbackStats]);

  const [sColChart] = useState<any>({
    chart: {
      width: 80,
      height: 54,
      type: "bar",
      toolbar: { show: false },
      sparkline: { enabled: true },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "70%",
        borderRadius: 3,
        endingShape: "rounded",
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: false },
    xaxis: {
      labels: { show: false },
      axisTicks: { show: false },
      axisBorder: { show: false },
    },
    yaxis: { show: false },
    grid: { show: false },
    tooltip: { enabled: false },
    colors: [
      "#2E37A4", // default color
      "#2E37A4",
      "#2E37A4",
      "#2E37A4",
      "#FF955A", // highlighted bar
      "#2E37A4",
      "#2E37A4",
    ],
    fill: {
      type: "solid",
    },
  });

  const series = [
    {
      name: "Data",
      data: [40, 15, 60, 15, 90, 20, 70], // y-values
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content pb-0">
          {/* ── Page Header ── */}
          <div className="d-flex align-items-sm-center justify-content-between flex-wrap gap-2 mb-4">
            <div>
              <h4 className="fw-bold mb-0">Admin Dashboard</h4>
              <p className="text-muted mb-0 fs-13">Welcome back — here's what's happening today.</p>
            </div>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <Link href={all_routes.manageStudentCreate} className="btn btn-primary d-inline-flex align-items-center">
                <i className="ti ti-plus me-1" />
                Add Student
              </Link>
              <Link
                href={all_routes.adminClassSchedule}
                className="btn btn-outline-white bg-white d-inline-flex align-items-center"
              >
                <i className="ti ti-calendar-time me-1" />
                Class Schedule
              </Link>
            </div>
          </div>
          {/* ── Academy Pulse ── */}
          <div className="card mb-4 shadow-sm">
            <div className="card-body px-4 pt-3 pb-2">
              {/* header row */}
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="avatar avatar-sm rounded-circle" style={{ background: "#f0f4ff" }}>
                    <i className="ti ti-activity-heartbeat text-primary fs-16" />
                  </span>
                  <div>
                    <h6 className="fw-bold mb-0">Academy Pulse</h6>
                    <p className="mb-0 fs-11 text-muted">{dayjs().format("hh:mm a")} · last sync</p>
                  </div>
                </div>
                {/* Action Required chips */}
                <div className="d-flex align-items-center flex-wrap gap-2">
                  {(
                    [
                      {
                        label: "Assignments",
                        count: pendingAssignments,
                        icon: "ti-file-check",
                        color: "#F59E0B",
                        href: all_routes.manageAssignments,
                      },
                      {
                        label: "Quiz Approvals",
                        count: pendingQuizzes,
                        icon: "ti-help-hexagon",
                        color: "#8B5CF6",
                        href: all_routes.manageQuizzes,
                      },
                      {
                        label: "Support",
                        count: supportStats?.pending ?? 0,
                        icon: "ti-headset",
                        color: "#06B6D4",
                        href: all_routes.adminSupport,
                      },
                      {
                        label: "Overdue Fees",
                        count: feeStats?.overdue ?? 0,
                        icon: "ti-alert-circle",
                        color: "#EF4444",
                        href: all_routes.manageFees,
                      },
                      {
                        label: "Proposals",
                        count: pendingProposals,
                        icon: "ti-calendar-plus",
                        color: "#10B981",
                        href: all_routes.adminClassSchedule,
                      },
                    ] as {
                      label: string;
                      count: number;
                      icon: string;
                      color: string;
                      href: string;
                    }[]
                  ).map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill text-decoration-none border"
                      style={{ background: item.color + "0f", borderColor: item.color + "40" }}
                    >
                      <i className={`ti ${item.icon} fs-13`} style={{ color: item.color }} />
                      <span className="fs-12 fw-semibold" style={{ color: item.color }}>
                        {item.label}
                      </span>
                      <span
                        className="badge rounded-pill fw-bold ms-1"
                        style={{ background: item.color, color: "#fff", fontSize: 11 }}
                      >
                        {item.count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 1: KPI Cards ── */}
          <div className="row g-3 mb-4">
            {canViewTeachers && (
              <div className={statColClass}>
                <div className="position-relative border card rounded-2 shadow-sm mb-0">
                  <ImageWithBasePath
                    src="./assets/img/bg/bg-01.svg"
                    alt="img"
                    className="position-absolute start-0 top-0"
                  />
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-2 justify-content-between">
                      <span className="avatar bg-primary rounded-circle">
                        <i className="ti ti-user-star fs-24" />
                      </span>
                      <div className="text-end">
                        <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">
                          {stats ? pct(stats.teachers.percentChange) : "—"}
                        </span>
                        <p className="fs-13 mb-0">in last 7 Days</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="mb-1">Teachers</p>
                        <h3 className="fw-bold mb-0">{stats ? fmt(stats.teachers.total) : "…"}</h3>
                      </div>
                      <div>
                        <div id="s-col" className="chart-set">
                          <Chart options={sColChart} series={series} type="bar" width={80} height={54} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {canViewStudents && (
              <div className={statColClass}>
                <div className="position-relative border card rounded-2 shadow-sm mb-0">
                  <ImageWithBasePath
                    src="./assets/img/bg/bg-02.svg"
                    alt="img"
                    className="position-absolute start-0 top-0"
                  />
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-2 justify-content-between">
                      <span className="avatar bg-danger rounded-circle">
                        <i className="ti ti-school fs-24" />
                      </span>
                      <div className="text-end">
                        <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">
                          {stats ? pct(stats.students.percentChange) : "—"}
                        </span>
                        <p className="fs-13 mb-0">in last 7 Days</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="mb-1">Students</p>
                        <h3 className="fw-bold mb-0">{stats ? fmt(stats.students.total) : "…"}</h3>
                      </div>
                      <div>
                        <div id="s-col-2" className="chart-set">
                          <SCol2Chart />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {canViewCourses && (
              <div className={statColClass}>
                <div className="position-relative border card rounded-2 shadow-sm mb-0">
                  <ImageWithBasePath
                    src="./assets/img/bg/bg-03.svg"
                    alt="img"
                    className="position-absolute start-0 top-0"
                  />
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-2 justify-content-between">
                      <span className="avatar bg-info rounded-circle">
                        <i className="ti ti-books fs-24" />
                      </span>
                      <div className="text-end">
                        <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">
                          {stats ? pct(stats.courses.percentChange) : "—"}
                        </span>
                        <p className="fs-13 mb-0">in last 7 Days</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="mb-1">Active Courses</p>
                        <h3 className="fw-bold mb-0">{stats ? fmt(stats.courses.total) : "…"}</h3>
                      </div>
                      <div>
                        <div id="s-col-3" className="chart-set">
                          <SCol3Chart />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {canViewFinance && (
              <div className={statColClass}>
                <div className="position-relative border card rounded-2 shadow-sm mb-0">
                  <ImageWithBasePath
                    src="./assets/img/bg/bg-04.svg"
                    alt="img"
                    className="position-absolute start-0 top-0"
                  />
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-2 justify-content-between">
                      <span className="avatar bg-success rounded-circle">
                        <i className="ti ti-cash fs-24" />
                      </span>
                      <div className="text-end">
                        <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">
                          {stats ? pct(stats.fees.percentChange) : "—"}
                        </span>
                        <p className="fs-13 mb-0">in last 7 Days</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between overflow-hidden">
                      <div>
                        <p className="mb-1">Fees Collected</p>
                        <h3 className="fw-bold mb-0 text-truncate">
                          {stats ? fmtFees(stats.fees.totalCollected) : "…"}
                        </h3>
                      </div>
                      <div>
                        <div id="s-col-4" className="chart-set">
                          <SCol4Chart />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Global Charts ── */}
          <div className="row g-3 mb-4">
            {/* Top Courses by Enrollment */}
            <div className="col-xl-4 d-flex order-xl-1">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Top Courses by Enrollment</h5>
                  <Link href={all_routes.manageCourses} className="btn btn-sm btn-outline-white">
                    View All
                  </Link>
                </div>
                <div className="card-body p-0">
                  {(() => {
                    const CHART_COLORS = ["#4F46E5", "#0891B2", "#16A34A", "#D97706", "#8B5CF6"];
                    const SLOTS = 5;
                    // Always fill exactly 5 slots so the radialBar rings stay consistent
                    const filled = Array.from({ length: SLOTS }, (_, i) => {
                      const real = topCourses[i];
                      return real
                        ? { name: real.name, count: real.count, color: CHART_COLORS[i] }
                        : { name: "—", count: 0, color: "#e2e8f0" };
                    });
                    const courses = filled;
                    const total = topCourses.reduce((s, c) => s + c.count, 0);
                    const max = courses[0].count || 1;
                    const pcts = courses.map((c) => c.count > 0 ? Math.round((c.count / max) * 100) : 0);
                    const ringPositions = [
                      { top: 47 },
                      { top: 68 },
                      { top: 89 },
                      { top: 110 },
                      { top: 131 },
                    ];
                    return (
                      <div style={{ position: "relative" }}>
                        <Chart
                          options={
                            {
                              chart: { type: "radialBar", height: 360 },
                              plotOptions: {
                                radialBar: {
                                  startAngle: 0,
                                  endAngle: 270,
                                  hollow: { size: "18%", background: "transparent" },
                                  track: { background: "#e8edf5", strokeWidth: "82%", margin: 5 },
                                  dataLabels: { show: false },
                                },
                              },
                              colors: courses.map((c) => c.color),
                              legend: { show: false },
                              stroke: { lineCap: "round" },
                              tooltip: {
                                y: {
                                  formatter: (_v: number, opts: any) => `${courses[opts.seriesIndex].count} students`,
                                },
                              },
                            } as any
                          }
                          series={pcts}
                          type="radialBar"
                          height={360}
                          width="100%"
                        />
                        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none" }}>
                          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Total</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{total}</div>
                          </div>
                          {courses.map((c, i) => (
                            <div key={i} style={{ position: "absolute", right: "calc(50% + 36px)", top: ringPositions[i].top, transform: "translateY(-50%)", display: "flex", alignItems: "center", flexDirection: "row-reverse", gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                              <div style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: c.color }} title={c.name}>
                                  {(() => { const w = c.name.split(" "); return w.length > 2 ? w.slice(0, 2).join(" ") + "…" : c.name; })()}
                                </span>
                                <span style={{ fontSize: 10, color: "#64748b" }}>{c.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Student Distribution World Map */}
            <div className="col-xl-8 order-xl-2">
              <div className="card shadow-sm h-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <div>
                    <h5 className="fw-bold mb-0">Student Distribution</h5>
                    <p className="text-muted mb-0 fs-12">Geographic spread of enrolled students by country</p>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center gap-1">
                      <span className="rounded-circle" style={{ width: 8, height: 8, background: "#16A34A", display: "inline-block" }} />
                      <span className="fs-11 text-muted">Has students</span>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <span className="rounded-circle" style={{ width: 8, height: 8, background: "#e2e8f0", border: "1px solid #cbd5e1", display: "inline-block" }} />
                      <span className="fs-11 text-muted">None</span>
                    </div>
                    <span
                      className="badge px-2 py-1 fs-11 fw-semibold"
                      style={{ background: "#dcfce7", color: "#16A34A" }}
                    >
                      {countryStats.length} countr{countryStats.length !== 1 ? "ies" : "y"}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  {countryStats.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="ti ti-world-off d-block fs-32 mb-2" />
                      <p className="fs-13 mb-0">No country data available — add country info to student profiles</p>
                    </div>
                  ) : (
                    <StudentWorldMap data={countryStats} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Finance Summary KPI Cards ── */}
          {canViewFinance && <FinanceSummaryCards />}

          {/* ── Financial Charts ── */}
          <div className="row g-3 mb-4">
            {/* 1. Revenue vs Expenses */}
            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header">
                  <h5 className="fw-bold mb-0">Revenue vs Expenses</h5>
                </div>
                <div className="card-body pb-2">
                  <MonthlyRevenueExpensesChart />
                </div>
              </div>
            </div>

            {/* 2. Cash Flow */}
            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header">
                  <h5 className="fw-bold mb-0">Cash Flow</h5>
                </div>
                <div className="card-body pb-2">
                  <CashFlowChart />
                </div>
              </div>
            </div>

            {/* 3. Fee Collection */}
            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Fee Collection</h5>
                  <Link href={all_routes.manageFees} className="btn btn-sm btn-outline-white">
                    Details
                  </Link>
                </div>
                <div className="card-body">
                  {(() => {
                    const collected  = feeStats?.collected    ?? 0;
                    const pending    = feeStats?.pendingAmount ?? 0;
                    const overdue    = feeStats?.overdueAmount ?? 0;
                    const grandTotal = collected + pending + overdue;
                    const fmtAmt     = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v}`;
                    const hasData    = grandTotal > 0;
                    return (
                      <>
                        <Chart
                          options={{
                            chart: { type: "donut", height: 210 },
                            labels: ["Collected", "Pending", "Overdue"],
                            colors: ["#16A34A", "#F59E0B", "#EF4444"],
                            legend: { position: "bottom", fontSize: "12px" },
                            dataLabels: { enabled: false },
                            stroke: { width: 2, colors: ["#fff"] },
                            plotOptions: {
                              pie: {
                                donut: {
                                  size: "65%",
                                  labels: {
                                    show: true,
                                    total: {
                                      show: true,
                                      label: "Total",
                                      color: "#1e293b",
                                      formatter: () => fmtAmt(grandTotal),
                                    },
                                  },
                                },
                              },
                            },
                          } as any}
                          series={hasData ? [collected, pending, overdue] : [1, 0, 0]}
                          type="donut"
                          height={210}
                        />
                        <div className="d-flex justify-content-center gap-4 mt-1">
                          <div className="text-center">
                            <div className="fw-bold text-success">{fmtAmt(collected)}</div>
                            <div className="fs-12 text-muted">Collected</div>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-warning">{fmtAmt(pending)}</div>
                            <div className="fs-12 text-muted">Pending</div>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-danger">{fmtAmt(overdue)}</div>
                            <div className="fs-12 text-muted">Overdue</div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ── Grade Distribution + Class Schedule ── */}
          <div className="row g-3 mb-4">
            <div className="col-xl-8">
              <div className="card shadow-sm h-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Student Distribution by Grade</h5>
                  <Link href={all_routes.manageStudents} className="btn btn-sm fw-normal btn-outline-white">
                    View All
                  </Link>
                </div>
                <div className="card-body pb-0">
                  <div className="row row-gap-3 mb-3">
                    <div className="col-6 col-md-3">
                      <div className="bg-light border p-2 text-center rounded-2">
                        <p className="mb-1 text-truncate">
                          <i className="ti ti-point-filled me-1 text-primary" />
                          Total
                        </p>
                        <h5 className="fw-bold mb-0">{stats ? fmt(stats.enrollment.total) : "…"}</h5>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="bg-light border p-2 text-center rounded-2">
                        <p className="mb-1">
                          <i className="ti ti-point-filled me-1 text-success" />
                          Active
                        </p>
                        <h5 className="fw-bold mb-0">{stats ? fmt(stats.enrollment.active) : "…"}</h5>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="bg-light border p-2 text-center rounded-2">
                        <p className="mb-1">
                          <i className="ti ti-point-filled me-1 text-warning" />
                          Pending
                        </p>
                        <h5 className="fw-bold mb-0">{stats ? fmt(stats.enrollment.pending) : "…"}</h5>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="bg-light border p-2 text-center rounded-2">
                        <p className="mb-1">
                          <i className="ti ti-point-filled me-1 text-danger" />
                          Dropped
                        </p>
                        <h5 className="fw-bold mb-0">{stats ? fmt(stats.enrollment.dropped) : "…"}</h5>
                      </div>
                    </div>
                  </div>
                  <StudentGradeChart />
                </div>
              </div>
            </div>
            <div className="col-xl-4">
              <div
                className="card h-100 mb-0"
                style={{ boxShadow: "0 4px 24px rgba(79,70,229,0.10)", border: "1.5px solid #e0e7ff" }}
              >
                <div
                  className="card-header border-0 d-flex align-items-center justify-content-between px-4 pt-3 pb-2"
                  style={{ background: "linear-gradient(90deg,#f0f4ff 0%,#f8fafc 100%)" }}
                >
                  <div>
                    <h5 className="fw-bold mb-0" style={{ fontSize: 15 }}>Class Schedule</h5>
                    <p className="text-muted mb-0 fs-12">
                      {calendarMode === "year" ? calendarDate.format("YYYY") : calendarDate.format("MMMM YYYY")}
                    </p>
                  </div>
                  <Link href={all_routes.adminClassSchedule} className="btn btn-sm btn-primary px-3" style={{ fontSize: 12 }}>
                    View All
                  </Link>
                </div>
                <div className="px-2 pt-2" style={{ borderBottom: "1px solid #e8ecf4" }}>
                  <Calendar
                    fullscreen={false}
                    value={calendarDate}
                    onSelect={(date) => setCalendarDate(date)}
                    onPanelChange={(date, mode) => {
                      setCalendarDate(date);
                      setCalendarMode(mode);
                      fetchScheduleSessions(date, mode);
                    }}
                    cellRender={(date) => {
                      const count = scheduleSessions.filter((s) => s.date === date.format("YYYY-MM-DD")).length;
                      return count > 0 ? (
                        <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>
                          {count <= 3 ? (
                            Array.from({ length: count }).map((_, i) => (
                              <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#4F46E5", display: "inline-block" }} />
                            ))
                          ) : (
                            <span style={{ fontSize: 9, color: "#4F46E5", fontWeight: 700, lineHeight: 1 }}>{count}</span>
                          )}
                        </div>
                      ) : null;
                    }}
                  />
                </div>
                <div className="px-3 py-3">
                  {scheduleLoading ? (
                    <div className="text-center py-3 text-muted fs-13">
                      <i className="ti ti-loader-2 d-block fs-22 mb-1" />Loading…
                    </div>
                  ) : calendarMode === "year" ? (
                    <>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fs-12 fw-semibold text-dark">{calendarDate.format("MMMM YYYY")}</span>
                        <span className="badge rounded-pill px-2" style={{ background: "#4F46E5", fontSize: 11 }}>
                          {monthSessions.length} session{monthSessions.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {monthSessions.length === 0 ? (
                        <div className="text-center py-3" style={{ color: "#94a3b8" }}>
                          <i className="ti ti-calendar-off d-block fs-28 mb-1" />
                          <p className="fs-13 mb-0">No sessions in {calendarDate.format("MMMM YYYY")}</p>
                        </div>
                      ) : (
                        <div style={{ maxHeight: 112, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin" }}>
                          {monthSessions.map((s) => {
                            const accentColors: Record<string, string> = { live: "#16A34A", idle: "#4F46E5", ended: "#64748B", scheduled: "#0891B2", cancelled: "#DC2626" };
                            const accent = accentColors[s.sessionStatus] ?? "#4F46E5";
                            const label = s.sessionStatus === "live" ? "● Live" : s.sessionStatus === "idle" ? "Ready" : s.sessionStatus === "ended" ? "Ended" : s.sessionStatus === "cancelled" ? "Cancelled" : "Scheduled";
                            return (
                              <div key={s.id} className="mb-2 d-flex align-items-center gap-3 p-2 rounded-2" style={{ background: `${accent}0d`, borderLeft: `3px solid ${accent}` }}>
                                <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 32, height: 32, background: `${accent}20` }}>
                                  <span className="fw-bold fs-11" style={{ color: accent }}>{dayjs(s.date).format("D")}</span>
                                </div>
                                <div className="overflow-hidden flex-fill">
                                  <h6 className="fs-13 fw-semibold mb-0 text-truncate">{s.title || s.Course?.courseName || "Session"}</h6>
                                  <p className="mb-0 fs-11 text-muted text-truncate">
                                    <i className="ti ti-calendar me-1" />{dayjs(s.date).format("ddd, MMM D")}
                                    <span className="ms-2"><i className="ti ti-clock me-1" />{s.startTime}–{s.endTime}</span>
                                  </p>
                                </div>
                                <span className="badge rounded-pill fs-10 flex-shrink-0" style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : selectedDateSessions.length === 0 ? (
                    <div className="text-center py-3" style={{ color: "#94a3b8" }}>
                      <i className="ti ti-calendar-off d-block fs-28 mb-1" />
                      <p className="fs-13 mb-0">No sessions on {calendarDate.format("ddd, MMM D")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fs-12 fw-semibold text-dark">{calendarDate.format("ddd, MMM D")}</span>
                        <span className="badge rounded-pill px-2" style={{ background: "#4F46E5", fontSize: 11 }}>
                          {selectedDateSessions.length} session{selectedDateSessions.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div style={{ maxHeight: 112, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin" }}>
                        {selectedDateSessions.map((s, idx) => {
                          const teacherName = s.Teacher ? `${s.Teacher.firstName} ${s.Teacher.lastName}` : "—";
                          const accentColors: Record<string, string> = { live: "#16A34A", idle: "#4F46E5", ended: "#64748B", scheduled: "#0891B2", cancelled: "#DC2626" };
                          const accent = accentColors[s.sessionStatus] ?? "#4F46E5";
                          const label = s.sessionStatus === "live" ? "● Live" : s.sessionStatus === "idle" ? "Ready" : s.sessionStatus === "ended" ? "Ended" : s.sessionStatus === "cancelled" ? "Cancelled" : "Scheduled";
                          return (
                            <div key={s.id} className="mb-2 d-flex align-items-center gap-3 p-2 rounded-2" style={{ background: `${accent}0d`, borderLeft: `3px solid ${accent}` }}>
                              <div className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 32, height: 32, background: `${accent}20` }}>
                                <span className="fw-bold fs-12" style={{ color: accent }}>{idx + 1}</span>
                              </div>
                              <div className="overflow-hidden flex-fill">
                                <h6 className="fs-13 fw-semibold mb-0 text-truncate">{s.title || s.Course?.courseName || "Session"}</h6>
                                <p className="mb-0 fs-11 text-muted text-truncate">
                                  <i className="ti ti-user me-1" />{teacherName}
                                  <span className="ms-2"><i className="ti ti-clock me-1" />{s.startTime}–{s.endTime}</span>
                                </p>
                              </div>
                              <span className="badge rounded-pill fs-10 flex-shrink-0" style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Operational Charts ── */}
          <div className="row g-3 mb-4">
            {/* Session Completion Radial */}
            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header">
                  <h5 className="fw-bold mb-0">Session Completion Rate</h5>
                  <p className="text-muted mb-0 fs-12">This month's session outcomes</p>
                </div>
                <div className="card-body pb-2">
                  <Chart
                    options={
                      {
                        chart: { type: "radialBar", height: 230 },
                        plotOptions: {
                          radialBar: {
                            hollow: { size: "32%" },
                            track: { background: "#f1f5f9", strokeWidth: "90%" },
                            dataLabels: {
                              name: { fontSize: "10px", color: "#94a3b8", offsetY: -4 },
                              value: { fontSize: "13px", fontWeight: 700, color: "#1e293b", offsetY: 4 },
                              total: {
                                show: true,
                                label: "Completion",
                                color: "#64748b",
                                fontSize: "11px",
                                formatter: () => `${completionSeries[0]}%`,
                              },
                            },
                          },
                        },
                        colors: ["#16A34A", "#EF4444", "#0891B2"],
                        labels: ["Completed", "Cancelled", "Upcoming"],
                        legend: { show: true, position: "bottom", fontSize: "12px" },
                      } as any
                    }
                    series={completionSeries}
                    type="radialBar"
                    height={230}
                  />
                  <div className="row text-center g-2 mt-0">
                    <div className="col-4">
                      <div className="fw-bold text-success fs-15">{completionSeries[0]}%</div>
                      <div className="fs-12 text-muted">Completed</div>
                      <div className="fs-11 text-muted">{completionCounts.completed} sessions</div>
                    </div>
                    <div className="col-4">
                      <div className="fw-bold text-danger fs-15">{completionSeries[1]}%</div>
                      <div className="fs-12 text-muted">Cancelled</div>
                      <div className="fs-11 text-muted">{completionCounts.cancelled} sessions</div>
                    </div>
                    <div className="col-4">
                      <div className="fw-bold text-info fs-15">{completionSeries[2]}%</div>
                      <div className="fs-12 text-muted">Upcoming</div>
                      <div className="fs-11 text-muted">{completionCounts.upcoming} sessions</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Top Performing Courses</h5>
                  <Link href={all_routes.manageCourses} className="btn btn-sm fw-normal btn-outline-white">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  <TopCoursesChart courses={topCourses} />
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-lg-6 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Teachers Schedule</h5>
                  <Link href={all_routes.adminClassSchedule} className="btn btn-sm fw-normal btn-outline-white">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  <div className="row g-2 mb-4 text-center">
                    <div className="col border-end">
                      <p className="mb-1 fs-13">Teaching</p>
                      <h3 className="fw-bold mb-0">32</h3>
                    </div>
                    <div className="col border-end">
                      <p className="mb-1 fs-13">Off Today</p>
                      <h3 className="fw-bold mb-0">11</h3>
                    </div>
                    <div className="col">
                      <p className="mb-1 fs-13">On Leave</p>
                      <h3 className="fw-bold mb-0">4</h3>
                    </div>
                  </div>
                  {[
                    { img: "assets/img/doctors/doctor-02.jpg", name: "Prof. Sarah Johnson", subject: "Mathematics" },
                    { img: "assets/img/doctors/doctor-03.jpg", name: "Ms. Emily Carter", subject: "Science" },
                    { img: "assets/img/doctors/doctor-04.jpg", name: "Mr. David Lee", subject: "English" },
                    { img: "assets/img/doctors/doctor-14.jpg", name: "Dr. Michael Smith", subject: "History" },
                  ].map((t) => (
                    <div key={t.name} className="d-flex justify-content-between align-items-center mb-3">
                      <div className="d-flex align-items-center">
                        <Link href={all_routes.manageTeachers} className="avatar flex-shrink-0">
                          <ImageWithBasePath src={t.img} className="rounded-circle" alt="img" />
                        </Link>
                        <div className="ms-2">
                          <h6 className="fw-semibold fs-14 mb-0 text-truncate">
                            <Link href={all_routes.manageTeachers}>{t.name}</Link>
                          </h6>
                          <p className="fs-13 mb-0">{t.subject}</p>
                        </div>
                      </div>
                      <Link href={all_routes.manageTeachers} className="btn btn-primary btn-sm py-1 flex-shrink-0 ms-2">
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Academy Pulse Gauges ── */}
          {/* <div className="row g-3 mb-4">
            {(
              [
                {
                  color: "#16A34A",
                  bg: "#dcfce7",
                  track: "rgba(22,163,74,0.15)",
                  pct: liveSessions.length > 0 ? 100 : 5,
                  value: String(liveSessions.length),
                  label: "Live Sessions Now",
                  sub:
                    liveSessions.length === 0
                      ? "No sessions active"
                      : liveSessions
                          .slice(0, 2)
                          .map(
                            (s) =>
                              `${s.Teacher ? s.Teacher.firstName : "—"}${s.Course ? " · " + s.Course.courseName : ""}`,
                          )
                          .join("  ·  "),
                },
                {
                  color: "#4F46E5",
                  bg: "#e0e7ff",
                  track: "rgba(79,70,229,0.15)",
                  pct: todayGauge.total > 0 ? Math.round((todayGauge.done / todayGauge.total) * 100) : 0,
                  value: String(todayGauge.total),
                  label: "Today's Sessions",
                  sub: todayGauge.total === 0
                    ? "No sessions today"
                    : `${todayGauge.done} done · ${todayGauge.upcoming} upcoming · ${todayGauge.cancelled} cancelled`,
                },
                {
                  color: "#0891B2",
                  bg: "#e0f2fe",
                  track: "rgba(8,145,178,0.15)",
                  pct: teacherCheckin.pct,
                  value: teacherCheckin.total > 0 ? `${teacherCheckin.present}/${teacherCheckin.total}` : "—",
                  label: "Teacher Check-ins",
                  sub: teacherCheckin.total > 0
                    ? `${teacherCheckin.pct}% check-in rate today`
                    : "No records for today",
                },
                {
                  color: "#D97706",
                  bg: "#fef3c7",
                  track: "rgba(217,119,6,0.15)",
                  pct: studentAttGauge.pct,
                  value: studentAttGauge.total > 0 ? `${studentAttGauge.pct}%` : "—",
                  label: "Student Attendance",
                  sub: studentAttGauge.total > 0
                    ? `${studentAttGauge.present} present of ${studentAttGauge.total} marked`
                    : "No attendance marked today",
                },
              ] as {
                color: string;
                bg: string;
                track: string;
                pct: number;
                value: string;
                label: string;
                sub: string;
              }[]
            ).map((g) => (
              <div key={g.label} className="col-xl-3 col-md-6 d-flex">
                <div className="card shadow-sm flex-fill mb-0 d-flex align-items-center justify-content-center py-3">
                  <div style={{ position: "relative", width: 220, height: 220 }}>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        width: 200,
                        height: 200,
                        borderRadius: "50%",
                        background: g.bg,
                      }}
                    />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <Chart
                        options={
                          {
                            chart: {
                              type: "radialBar",
                              height: 220,
                              width: 220,
                              background: "transparent",
                              sparkline: { enabled: true },
                            },
                            plotOptions: {
                              radialBar: {
                                hollow: { size: "70%", background: "transparent" },
                                track: { background: g.track, strokeWidth: "100%" },
                                dataLabels: { show: false },
                              },
                            },
                            colors: [g.color],
                            stroke: { lineCap: "round" },
                          } as any
                        }
                        series={[g.pct]}
                        type="radialBar"
                        height={220}
                        width={220}
                      />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                        width: 108,
                        zIndex: 2,
                      }}
                    >
                      <div style={{ fontSize: 22, fontWeight: 800, color: g.color, lineHeight: 1 }}>{g.value}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#1e293b", marginTop: 3, lineHeight: 1.25 }}>
                        {g.label}
                      </div>
                      <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, lineHeight: 1.25 }}>{g.sub}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div> */}

          {/* ── Section 3: Module Overview (Tabs) ── */}
          {(canViewFinance || canViewPlans || canViewSalary || canViewFAQ || canViewSupport || canViewFeedback) && (
            <div
              className="card mb-4"
              style={{ boxShadow: "0 6px 32px rgba(79,70,229,0.13)", border: "1.5px solid #e0e7ff", borderRadius: 18 }}
            >
              <div
                className="card-header border-bottom-0 d-flex align-items-end justify-content-between flex-wrap gap-3"
                style={{
                  background: "linear-gradient(90deg,#f0f4ff 0%,#f8fafc 100%)",
                  borderRadius: "16px 16px 0 0",
                  padding: "18px 24px 0",
                }}
              >
                <div className="mb-2">
                  <h5 className="fw-bold mb-1" style={{ fontSize: 17 }}>
                    Module Overview
                  </h5>
                  <p className="text-muted mb-0 fs-12">Click a tab to inspect module-level stats.</p>
                </div>
                <ul
                  className="nav nav-tabs card-header-tabs flex-nowrap overflow-auto"
                  style={{ borderBottom: "none" }}
                >
                  {canViewFinance && feeStats && (
                    <li className="nav-item">
                      <button
                        className={`nav-link d-inline-flex align-items-center gap-1 ${activeModuleTab === "fees" ? "active" : ""}`}
                        onClick={() => setActiveModuleTab("fees")}
                      >
                        <i className="ti ti-receipt fs-14" />
                        Fees
                      </button>
                    </li>
                  )}
                  {canViewPlans && subStats && (
                    <li className="nav-item">
                      <button
                        className={`nav-link d-inline-flex align-items-center gap-1 ${activeModuleTab === "subs" ? "active" : ""}`}
                        onClick={() => setActiveModuleTab("subs")}
                      >
                        <i className="ti ti-package fs-14" />
                        Subscriptions
                      </button>
                    </li>
                  )}
                  {canViewSalary && salaryStats && (
                    <li className="nav-item">
                      <button
                        className={`nav-link d-inline-flex align-items-center gap-1 ${activeModuleTab === "salary" ? "active" : ""}`}
                        onClick={() => setActiveModuleTab("salary")}
                      >
                        <i className="ti ti-wallet fs-14" />
                        Salary
                      </button>
                    </li>
                  )}
                  {canViewFAQ && faqStats && (
                    <li className="nav-item">
                      <button
                        className={`nav-link d-inline-flex align-items-center gap-1 ${activeModuleTab === "faq" ? "active" : ""}`}
                        onClick={() => setActiveModuleTab("faq")}
                      >
                        <i className="ti ti-help-circle fs-14" />
                        FAQ
                      </button>
                    </li>
                  )}
                  {canViewSupport && supportStats && (
                    <li className="nav-item">
                      <button
                        className={`nav-link d-inline-flex align-items-center gap-1 ${activeModuleTab === "support" ? "active" : ""}`}
                        onClick={() => setActiveModuleTab("support")}
                      >
                        <i className="ti ti-headset fs-14" />
                        Support
                      </button>
                    </li>
                  )}
                  {canViewFeedback && feedbackStats && (
                    <li className="nav-item">
                      <button
                        className={`nav-link d-inline-flex align-items-center gap-1 ${activeModuleTab === "feedback" ? "active" : ""}`}
                        onClick={() => setActiveModuleTab("feedback")}
                      >
                        <i className="ti ti-star fs-14" />
                        Feedback
                      </button>
                    </li>
                  )}
                </ul>
              </div>
              <div className="card-body" style={{ padding: "24px 24px" }}>
                {/* Fees */}
                {activeModuleTab === "fees" && canViewFinance && feeStats && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-muted mb-0 fs-13">Fee collection summary across all students.</p>
                      <Link href={all_routes.manageFees} className="btn btn-sm btn-outline-primary px-3">
                        View All Fees
                      </Link>
                    </div>
                    <div className="row g-3">
                      {(
                        [
                          {
                            label: "Total Records",
                            value: String(feeStats.total),
                            icon: "ti-receipt",
                            color: "primary",
                          },
                          {
                            label: "Collected",
                            value: fmtAmt(feeStats.collected),
                            icon: "ti-circle-check",
                            color: "success",
                          },
                          {
                            label: "Outstanding",
                            value: fmtAmt(feeStats.outstanding),
                            icon: "ti-alert-circle",
                            color: "warning",
                          },
                          {
                            label: "Overdue",
                            value: String(feeStats.overdue),
                            icon: "ti-clock-exclamation",
                            color: "danger",
                          },
                          {
                            label: "Proof Submitted",
                            value: String(feeStats.proof),
                            icon: "ti-file-check",
                            color: "info",
                          },
                        ] as { label: string; value: string; icon: string; color: string }[]
                      ).map(({ label, value, icon, color }) => (
                        <div className="col-6 col-sm-4 col-xl" key={label}>
                          <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Subscriptions */}
                {activeModuleTab === "subs" && canViewPlans && subStats && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-muted mb-0 fs-13">Plan distribution and upgrade requests.</p>
                      <Link href={all_routes.adminSubscriptions} className="btn btn-sm btn-outline-primary px-3">
                        View All Plans
                      </Link>
                    </div>
                    <div className="row g-3">
                      {(
                        [
                          {
                            label: "Total Plans",
                            value: String(subStats.totalPlans),
                            icon: "ti-package",
                            color: "primary",
                          },
                          {
                            label: "Students with Plan",
                            value: String(subStats.withPlan),
                            icon: "ti-users",
                            color: "success",
                          },
                          {
                            label: "Without Plan",
                            value: String(subStats.withoutPlan),
                            icon: "ti-user-off",
                            color: "secondary",
                          },
                          {
                            label: "Pending Requests",
                            value: String(subStats.pendingReqs),
                            icon: "ti-clock-exclamation",
                            color: subStats.pendingReqs > 0 ? "warning" : "secondary",
                          },
                        ] as { label: string; value: string; icon: string; color: string }[]
                      ).map(({ label, value, icon, color }) => (
                        <div className="col-6 col-sm-3" key={label}>
                          <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Salary */}
                {activeModuleTab === "salary" && canViewSalary && salaryStats && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-muted mb-0 fs-13">Teacher salary payment status overview.</p>
                      <Link href={all_routes.adminSalary} className="btn btn-sm btn-outline-primary px-3">
                        View All Salaries
                      </Link>
                    </div>
                    <div className="row g-3">
                      {(
                        [
                          {
                            label: "Total Paid",
                            value: fmtAmt(salaryStats.paid),
                            icon: "ti-circle-check",
                            color: "success",
                          },
                          {
                            label: "Total Unpaid",
                            value: fmtAmt(salaryStats.unpaid),
                            icon: "ti-clock",
                            color: "secondary",
                          },
                          {
                            label: "Total Partial",
                            value: fmtAmt(salaryStats.partial),
                            icon: "ti-alert-circle",
                            color: "warning",
                          },
                          {
                            label: "Total Overdue",
                            value: fmtAmt(salaryStats.overdue),
                            icon: "ti-alert-triangle",
                            color: "danger",
                          },
                        ] as { label: string; value: string; icon: string; color: string }[]
                      ).map(({ label, value, icon, color }) => (
                        <div className="col-6 col-sm-3" key={label}>
                          <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* FAQ */}
                {activeModuleTab === "faq" && canViewFAQ && faqStats && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-muted mb-0 fs-13">Published and draft FAQ entries by category.</p>
                      <Link href={all_routes.adminFaq} className="btn btn-sm btn-outline-primary px-3">
                        Manage FAQs
                      </Link>
                    </div>
                    <div className="row g-3">
                      {(
                        [
                          { label: "Total", value: String(faqStats.total), icon: "ti-list", color: "primary" },
                          { label: "Published", value: String(faqStats.published), icon: "ti-eye", color: "success" },
                          { label: "Draft", value: String(faqStats.draft), icon: "ti-pencil", color: "secondary" },
                          { label: "Categories", value: String(faqStats.categories), icon: "ti-tag", color: "info" },
                        ] as { label: string; value: string; icon: string; color: string }[]
                      ).map(({ label, value, icon, color }) => (
                        <div className="col-6 col-sm-3" key={label}>
                          <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Support */}
                {activeModuleTab === "support" && canViewSupport && supportStats && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-muted mb-0 fs-13">Open, resolved and rejected support tickets.</p>
                      <Link href={all_routes.adminSupport} className="btn btn-sm btn-outline-primary px-3">
                        Manage Support
                      </Link>
                    </div>
                    <div className="row g-3">
                      {(
                        [
                          { label: "Total", value: String(supportStats.total), icon: "ti-ticket", color: "primary" },
                          { label: "Pending", value: String(supportStats.pending), icon: "ti-clock", color: "warning" },
                          {
                            label: "Resolved",
                            value: String(supportStats.resolved),
                            icon: "ti-circle-check",
                            color: "success",
                          },
                          {
                            label: "Rejected",
                            value: String(supportStats.rejected),
                            icon: "ti-circle-x",
                            color: "danger",
                          },
                        ] as { label: string; value: string; icon: string; color: string }[]
                      ).map(({ label, value, icon, color }) => (
                        <div className="col-6 col-sm-3" key={label}>
                          <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Feedback */}
                {activeModuleTab === "feedback" && canViewFeedback && feedbackStats && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="text-muted mb-0 fs-13">Session feedback ratings submitted by students.</p>
                      <Link href={all_routes.adminFeedback} className="btn btn-sm btn-outline-primary px-3">
                        View Analytics
                      </Link>
                    </div>
                    <div className="row g-3">
                      {(
                        [
                          {
                            label: "Total Responses",
                            value: String(feedbackStats.total),
                            icon: "ti-message-circle",
                            color: "primary",
                          },
                          {
                            label: "Avg Overall Rating",
                            value: feedbackStats.overallSummary
                              ? `${feedbackStats.overallSummary.overallRating.toFixed(1)} ★`
                              : "—",
                            icon: "ti-star",
                            color: "warning",
                          },
                          {
                            label: "Avg Teaching Quality",
                            value: feedbackStats.overallSummary
                              ? feedbackStats.overallSummary.teachingQuality.toFixed(1)
                              : "—",
                            icon: "ti-chalkboard",
                            color: "success",
                          },
                          {
                            label: "Teachers Reviewed",
                            value: String(feedbackStats.teacherSummaries.length),
                            icon: "ti-user-star",
                            color: "info",
                          },
                        ] as { label: string; value: string; icon: string; color: string }[]
                      ).map(({ label, value, icon, color }) => (
                        <div className="col-6 col-sm-3" key={label}>
                          <ModuleStatCard label={label} value={value} icon={icon} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="row g-3 mb-4">
            <div className="col-xl-4 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Top 5 Students</h5>
                  <Link href={all_routes.manageStudents} className="btn btn-sm fw-normal btn-outline-white">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {topStudents.length === 0 ? (
                    <p className="text-muted fs-13 text-center py-4 mb-0">No student data yet</p>
                  ) : topStudents.map((s) => {
                    const fullName = `${s.firstName} ${s.lastName}`;
                    const initials = `${s.firstName[0]}${s.lastName[0]}`.toUpperCase();
                    const avatarSrc = s.profileImg ? `${resolveImageUrl(s.profileImg)}` : null;
                    return (
                      <div key={s.id} className="d-flex justify-content-between align-items-center mb-3">
                        <div className="d-flex align-items-center" style={{ minWidth: 0 }}>
                          <Link href={all_routes.manageStudents} className="me-2 flex-shrink-0">
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={fullName} className="rounded-circle" style={{ width: 38, height: 38, objectFit: "cover" }} />
                            ) : (
                              <div className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white fw-bold" style={{ width: 38, height: 38, fontSize: 13 }}>
                                {initials}
                              </div>
                            )}
                          </Link>
                          <div style={{ minWidth: 0 }}>
                            <h6 className="fs-14 mb-0 text-truncate">
                              <Link href={all_routes.manageStudents} className="fw-medium">{fullName}</Link>
                            </h6>
                            <p className="mb-0 fs-13 text-muted">
                              Fees Paid: ${s.totalPaid.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="badge fw-medium badge-soft-primary border border-primary flex-shrink-0">
                          {s.courseCount} Course{s.courseCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-lg-6 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Recent Fee Payments</h5>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto", fontSize: 12 }}
                    value={feeMonth}
                    onChange={(e) => setFeeMonth(Number(e.target.value))}
                  >
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m} {feeYear}</option>
                    ))}
                  </select>
                </div>
                <div className="card-body">
                  {recentFees.length === 0 ? (
                    <p className="text-muted fs-13 text-center py-4 mb-0">No paid fees yet</p>
                  ) : (
                    recentFees.map((fee) => {
                      const studentName = fee.Student
                        ? `${fee.Student.firstName} ${fee.Student.lastName}`
                        : "Unknown Student";
                      const initials = fee.Student
                        ? `${fee.Student.firstName[0]}${fee.Student.lastName[0]}`.toUpperCase()
                        : "?";
                      const avatarSrc = fee.Student?.profileImg
                        ? `${resolveImageUrl(fee.Student.profileImg)}`
                        : null;
                      return (
                        <div key={fee.id} className="d-flex justify-content-between align-items-center mb-3">
                          <div className="d-flex align-items-center" style={{ minWidth: 0 }}>
                            <div className="avatar me-2 flex-shrink-0">
                              {avatarSrc ? (
                                <img src={avatarSrc} alt={studentName} className="rounded-circle" style={{ width: 38, height: 38, objectFit: "cover" }} />
                              ) : (
                                <div className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white fw-bold" style={{ width: 38, height: 38, fontSize: 13 }}>
                                  {initials}
                                </div>
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h6 className="fs-13 mb-0 fw-semibold text-truncate" title={fee.title}>{fee.title}</h6>
                              <p className="mb-0 fs-12 text-muted text-truncate">{studentName}</p>
                            </div>
                          </div>
                          <span className="badge bg-success fw-medium flex-shrink-0 ms-2">
                            + ${Number(fee.amount).toLocaleString()}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-lg-6 d-flex">
              <div className="card shadow-sm flex-fill w-100 mb-0">
                <div className="card-header">
                  <h5 className="fw-bold mb-0">Quick Actions</h5>
                </div>
                <div className="card-body d-flex flex-column gap-2">
                  {([
                    { label: "Add Student",          icon: "ti-user-plus",       color: "#4F46E5", href: all_routes.manageStudentCreate },
                    { label: "Add Teacher",           icon: "ti-user-star",       color: "#0891B2", href: all_routes.manageTeacherCreate },
                    { label: "Create Class Session",  icon: "ti-calendar-plus",   color: "#16A34A", href: all_routes.adminClassSchedule },
                    { label: "Add Expense",           icon: "ti-cash",            color: "#D97706", href: all_routes.adminExpenses },
                    { label: "Issue Certificate",     icon: "ti-certificate",     color: "#8B5CF6", href: all_routes.adminCertificates },
                    { label: "Manage Fees",           icon: "ti-receipt",         color: "#EF4444", href: all_routes.manageFees },
                  ] as { label: string; icon: string; color: string; href: string }[]).map((a) => (
                    <Link
                      key={a.label}
                      href={a.href}
                      className="d-flex align-items-center gap-3 px-3 py-2 rounded-2 text-decoration-none"
                      style={{ background: `${a.color}0f`, border: `1px solid ${a.color}25`, transition: "background 0.15s" }}
                    >
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                        style={{ width: 34, height: 34, background: `${a.color}20` }}
                      >
                        <i className={`ti ${a.icon} fs-16`} style={{ color: a.color }} />
                      </span>
                      <span className="fw-medium fs-13" style={{ color: "#1e293b" }}>{a.label}</span>
                      <i className="ti ti-chevron-right ms-auto fs-14" style={{ color: a.color }} />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Recent Activity ── */}
          <div className="row g-3 mb-4">
            <div className="col-12">
              <div className="card shadow-sm mb-0">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h5 className="fw-bold mb-0">Recent Class Sessions</h5>
                  <Link href={all_routes.adminClassSchedule} className="btn btn-sm fw-normal btn-outline-white">
                    View All
                  </Link>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="thead-light">
                        <tr>
                          <th>Teacher</th>
                          <th>Name</th>
                          <th>Students</th>
                          <th>Date &amp; Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSessions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted py-4 fs-13">
                              <i className="ti ti-calendar-off d-block fs-24 mb-1" />
                              No sessions found
                            </td>
                          </tr>
                        ) : (
                          recentSessions.map((s) => {
                            const statusMap: Record<string, { label: string; badge: string }> = {
                              live: { label: "Live", badge: "badge-soft-success border-success text-success" },
                              ended: { label: "Completed", badge: "badge-soft-success border-success text-success" },
                              cancelled: { label: "Cancelled", badge: "badge-soft-danger border-danger" },
                              idle: { label: "Scheduled", badge: "badge-soft-info border-info" },
                            };
                            const { label: statusLabel, badge: statusBadge } =
                              statusMap[s.sessionStatus] ?? { label: s.sessionStatus, badge: "badge-soft-secondary border-secondary" };
                            const teacherName = s.Teacher ? `${s.Teacher.firstName} ${s.Teacher.lastName}` : "—";
                            const visibleStudents = (s.students ?? []).slice(0, 3);
                            const extraCount = (s.students ?? []).length - visibleStudents.length;
                            return (
                              <tr key={s.id}>
                                <td>
                                  <div className="d-flex align-items-center">
                                    {s.Teacher?.imageUrl ? (
                                      <Link href={all_routes.manageTeachers} className="avatar me-2 flex-shrink-0">
                                        <img src={`${resolveImageUrl(s.Teacher.imageUrl)}`} alt="img" className="rounded-circle w-100 h-100 object-fit-cover" />
                                      </Link>
                                    ) : (
                                      <span className="avatar me-2 flex-shrink-0 bg-primary rounded-circle d-inline-flex align-items-center justify-content-center">
                                        <i className="ti ti-user fs-16 text-white" />
                                      </span>
                                    )}
                                    <div>
                                      <h6 className="fs-14 mb-0 fw-semibold">
                                        <Link href={all_routes.manageTeachers}>{teacherName}</Link>
                                      </h6>
                                    </div>
                                  </div>
                                </td>
                                <td className="fs-13">{s.Course?.courseName ?? "—"}</td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    {visibleStudents.map((stu, i) => (
                                      stu.profileImg ? (
                                        <img
                                          key={stu.id}
                                          src={`${resolveImageUrl(stu.profileImg)}`}
                                          alt={stu.firstName}
                                          title={`${stu.firstName} ${stu.lastName}`}
                                          className="rounded-circle object-fit-cover"
                                          style={{ width: 28, height: 28, border: "2px solid #fff", marginLeft: i === 0 ? 0 : -8 }}
                                        />
                                      ) : (
                                        <span
                                          key={stu.id}
                                          title={`${stu.firstName} ${stu.lastName}`}
                                          className="rounded-circle bg-primary d-inline-flex align-items-center justify-content-center"
                                          style={{ width: 28, height: 28, border: "2px solid #fff", marginLeft: i === 0 ? 0 : -8, fontSize: 10, color: "#fff", fontWeight: 700 }}
                                        >
                                          {stu.firstName[0]}{stu.lastName[0]}
                                        </span>
                                      )
                                    ))}
                                    {extraCount > 0 && (
                                      <span
                                        className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center"
                                        style={{ width: 28, height: 28, border: "2px solid #fff", marginLeft: -8, fontSize: 10, color: "#64748b", fontWeight: 700 }}
                                      >
                                        +{extraCount}
                                      </span>
                                    )}
                                    {(s.students ?? []).length === 0 && (
                                      <span className="text-muted fs-12">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="fs-13">
                                  {dayjs(s.date).format("DD MMM YYYY")} · {s.startTime}
                                </td>
                                <td>
                                  <span className={`badge fs-12 py-1 border rounded fw-medium ${statusBadge}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* End Content */}
      </div>
      {/* ========================
			End Page Content
		========================= */}
    </>
  );
};

export default DashboardComponent;
