"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FEATURES = [
  { icon: "📸", color: "rgba(108,99,255,0.12)", title: "Screenshots", desc: "Automatic screenshots at customizable intervals. See exactly what employees are working on in real-time." },
  { icon: "🌐", color: "rgba(74,222,128,0.12)", title: "Browser History", desc: "Track all websites visited across Chrome, Edge & Firefox. Identify time wasters and enforce policies." },
  { icon: "🔌", color: "rgba(59,130,246,0.12)", title: "USB Monitoring", desc: "Detect and log every USB device connection. Get instant alerts when unauthorized drives are inserted." },
  { icon: "🚫", color: "rgba(251,191,36,0.12)", title: "Site Blocking", desc: "Block distracting or harmful websites automatically. Changes apply instantly to all employee devices." },
  { icon: "🔔", color: "rgba(239,68,68,0.12)", title: "Smart Alerts", desc: "Get notified for idle time, after-hours activity, USB connections, and blocked site visits instantly." },
  { icon: "🖥️", color: "rgba(20,184,166,0.12)", title: "Live Screen", desc: "Watch any employee screen in real-time via WebRTC. Perfect for remote teams and sensitive environments." },
  { icon: "📊", color: "rgba(168,85,247,0.12)", title: "Advanced Reports", desc: "Detailed productivity reports, app usage analytics, and work hour summaries for every employee." },
  { icon: "⌨️", color: "rgba(245,158,11,0.12)", title: "Keylogger", desc: "Record keystrokes per application. Understand exactly how time is spent across every tool." },
  { icon: "💾", color: "rgba(236,72,153,0.12)", title: "File Activity", desc: "Monitor file opens, copies, deletions, and transfers on Desktop, Documents & Downloads." },
  { icon: "🖨️", color: "rgba(34,211,238,0.12)", title: "Print Logs", desc: "Track every print job — document name, printer, page count, and timestamp recorded automatically." },
  { icon: "⚡", color: "rgba(248,113,113,0.12)", title: "Remote Shutdown", desc: "Shut down any employee PC remotely from the dashboard — instantly and silently, no IT needed." },
  { icon: "🔒", color: "rgba(16,185,129,0.12)", title: "Remote Lock", desc: "Lock any workstation remotely in one click. Secure sensitive machines immediately from anywhere." },
];

const TABS = [
  { id: "dashboard",   icon: "📊", label: "Dashboard" },
  { id: "employees",   icon: "👥", label: "Employees" },
  { id: "screenshots", icon: "📸", label: "Screenshots" },
  { id: "alerts",      icon: "🔔", label: "Alerts" },
  { id: "livescreen",  icon: "🖥️", label: "Live Screen" },
  { id: "reports",     icon: "📈", label: "Reports" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #080b12;
          --bg2: #0d1120;
          --bg3: #111827;
          --accent: #6c63ff;
          --accent2: #4ade80;
          --text: #f1f5f9;
          --muted: #64748b;
          --border: rgba(255,255,255,0.07);
          --card: rgba(255,255,255,0.03);
          --font-display: 'Syne', sans-serif;
          --font-body: 'DM Sans', sans-serif;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-body);
          line-height: 1.6;
          overflow-x: hidden;
        }

        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }

        /* ── NAV ── */
        nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 60px;
          background: rgba(8,11,18,0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }

        .logo {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          color: var(--text);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon {
          width: 32px; height: 32px;
          background: var(--accent);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .logo-icon svg { width: 18px; height: 18px; fill: white; }

        nav ul {
          list-style: none;
          display: flex;
          gap: 36px;
        }
        nav ul a {
          color: var(--muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }
        nav ul a:hover { color: var(--text); }

        .nav-cta {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn-ghost {
          color: var(--muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .btn-ghost:hover { color: var(--text); }

        .btn-primary {
          background: var(--accent);
          color: white;
          padding: 10px 22px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-display);
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-primary:hover { background: #5a52e0; transform: translateY(-1px); }

        /* ── HAMBURGER ── */
        .hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          z-index: 201;
        }
        .hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          background: var(--text);
          border-radius: 2px;
          transition: all 0.3s ease;
        }
        .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* ── MOBILE MENU ── */
        .mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 199;
          background: rgba(8,11,18,0.97);
          backdrop-filter: blur(24px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 28px;
          animation: menuFadeIn 0.2s ease;
        }
        @keyframes menuFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .mobile-menu a {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 700;
          color: var(--text);
          text-decoration: none;
          transition: color 0.2s;
        }
        .mobile-menu a:hover { color: var(--accent); }
        .mobile-menu-divider {
          width: 48px;
          height: 1px;
          background: var(--border);
        }
        .mobile-menu-sub {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .mobile-menu-sub a {
          font-size: 16px !important;
        }

        /* ── HERO ── */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 140px 24px 80px;
          overflow: hidden;
        }

        .hero-glow {
          position: absolute;
          top: -100px; left: 50%;
          transform: translateX(-50%);
          width: 800px; height: 600px;
          background: radial-gradient(ellipse, rgba(108,99,255,0.18) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-glow2 {
          position: absolute;
          top: 200px; left: 20%;
          width: 400px; height: 400px;
          background: radial-gradient(ellipse, rgba(74,222,128,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(108,99,255,0.12);
          border: 1px solid rgba(108,99,255,0.3);
          border-radius: 100px;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #a5a0ff;
          margin-bottom: 32px;
          animation: fadeUp 0.6s ease both;
        }
        .badge-dot {
          width: 6px; height: 6px;
          background: #6c63ff;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        h1 {
          font-family: var(--font-display);
          font-size: clamp(38px, 6vw, 80px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin-bottom: 24px;
          animation: fadeUp 0.6s 0.1s ease both;
        }
        h1 .accent  { color: var(--accent); }
        h1 .accent2 { color: var(--accent2); }

        .hero-sub {
          font-size: 18px;
          color: var(--muted);
          max-width: 560px;
          font-weight: 400;
          margin-bottom: 40px;
          animation: fadeUp 0.6s 0.2s ease both;
          line-height: 1.7;
        }

        .hero-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          animation: fadeUp 0.6s 0.3s ease both;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn-large  { padding: 14px 32px; font-size: 16px; border-radius: 10px; }
        .btn-outline {
          background: transparent;
          color: var(--text);
          padding: 13px 28px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          font-family: var(--font-display);
          transition: all 0.2s;
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-outline:hover { border-color: rgba(255,255,255,0.2); background: var(--card); }

        .hero-stats {
          display: flex;
          align-items: center;
          gap: 40px;
          margin-top: 64px;
          animation: fadeUp 0.6s 0.4s ease both;
          flex-wrap: wrap;
          justify-content: center;
        }
        .stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .stat-number { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--text); }
        .stat-label  { font-size: 13px; color: var(--muted); }
        .stat-divider { width: 1px; height: 40px; background: var(--border); }

        /* ── DASHBOARD MOCKUP ── */
        .hero-mockup {
          width: 100%;
          max-width: 1000px;
          margin: 64px auto 0;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg2);
          overflow: hidden;
          box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
          animation: fadeUp 0.8s 0.5s ease both;
          position: relative;
        }
        .mockup-bar {
          background: var(--bg3);
          border-bottom: 1px solid var(--border);
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .mockup-dots { display: flex; gap: 6px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot-r { background: #ff5f57; }
        .dot-y { background: #ffbd2e; }
        .dot-g { background: #28c840; }
        .mockup-url {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 5px 16px;
          font-size: 12px;
          color: var(--muted);
          flex: 1;
          max-width: 300px;
        }
        .mockup-content {
          display: grid;
          grid-template-columns: 200px 1fr;
          min-height: 400px;
        }
        .mockup-sidebar {
          background: rgba(255,255,255,0.02);
          border-right: 1px solid var(--border);
          padding: 20px 0;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px 16px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 12px;
        }
        .sidebar-logo-icon { width: 24px; height: 24px; background: var(--accent); border-radius: 6px; }
        .sidebar-logo-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text); }
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          font-size: 12px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .sidebar-item:hover { color: var(--text); background: rgba(255,255,255,0.03); }
        .sidebar-item.active { color: white; background: rgba(108,99,255,0.15); }
        .sidebar-item.active .si-icon { background: var(--accent); }
        .si-icon { width: 20px; height: 20px; border-radius: 4px; background: rgba(255,255,255,0.08); flex-shrink: 0; }
        .mockup-main { padding: 20px; }
        .mockup-cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 16px; }
        .mockup-card {
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px;
        }
        .mc-label { font-size: 10px; color: var(--muted); margin-bottom: 6px; }
        .mc-value { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--text); }
        .mc-sub { font-size: 10px; color: var(--accent2); margin-top: 2px; }
        .mc-sub.red { color: #f87171; }
        .mockup-graph {
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          height: 180px;
          position: relative;
          overflow: hidden;
        }
        .mg-title { font-size: 11px; color: var(--muted); margin-bottom: 12px; }
        .graph-bars { display: flex; align-items: flex-end; gap: 6px; height: 130px; }
        .bar { flex: 1; border-radius: 4px 4px 0 0; background: rgba(108,99,255,0.3); transition: background 0.2s; position: relative; }
        .bar:hover { background: rgba(108,99,255,0.6); }
        .bar.highlight { background: var(--accent); }

        /* ── SECTION BASE ── */
        section {
          position: relative;
          z-index: 1;
          padding: 100px 24px;
        }
        .container { max-width: 1100px; margin: 0 auto; }
        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 16px;
        }
        .section-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 52px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }
        .section-sub {
          font-size: 17px;
          color: var(--muted);
          max-width: 520px;
          line-height: 1.7;
        }

        /* ── FEATURES GRID ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          margin-top: 64px;
        }
        .feature-card {
          background: var(--bg);
          padding: 32px 28px;
          transition: background 0.2s;
          position: relative;
          overflow: hidden;
        }
        .feature-card:hover { background: var(--bg2); }
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--accent), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .feature-card:hover::before { opacity: 1; }
        .fc-icon {
          width: 44px; height: 44px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
          font-size: 20px;
        }
        .fc-title { font-family: var(--font-display); font-size: 15px; font-weight: 700; margin-bottom: 8px; color: var(--text); }
        .fc-desc  { font-size: 13px; color: var(--muted); line-height: 1.65; }

        /* ── PLANS ── */
        .plans-section { background: var(--bg2); }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 56px;
        }
        .plan-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          position: relative;
          transition: transform 0.2s, border-color 0.2s;
        }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-card.popular {
          border-color: rgba(108,99,255,0.5);
          background: linear-gradient(135deg, rgba(108,99,255,0.08), var(--bg));
        }
        .popular-badge {
          position: absolute;
          top: -12px; left: 50%;
          transform: translateX(-50%);
          background: var(--accent);
          color: white;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-display);
          padding: 4px 14px;
          border-radius: 100px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .plan-name { font-family: var(--font-display); font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .plan-price { font-family: var(--font-display); font-size: 40px; font-weight: 800; line-height: 1; margin: 20px 0 4px; }
        .plan-price span { font-size: 16px; font-weight: 400; color: var(--muted); }
        .plan-desc { font-size: 13px; color: var(--muted); margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid var(--border); }
        .plan-features { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
        .plan-features li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted); }
        .plan-features li.has { color: var(--text); }
        .pf-check { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 10px; }
        .pf-check.yes { background: rgba(74,222,128,0.15); color: var(--accent2); }
        .pf-check.no  { background: rgba(255,255,255,0.04); color: var(--muted); }
        .plan-btn {
          width: 100%; padding: 13px; border-radius: 8px;
          font-size: 14px; font-weight: 600; font-family: var(--font-display);
          cursor: pointer; transition: all 0.2s; text-align: center;
          text-decoration: none; display: block; border: none;
        }
        .plan-btn.primary { background: var(--accent); color: white; }
        .plan-btn.primary:hover { background: #5a52e0; }
        .plan-btn.outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .plan-btn.outline:hover { border-color: rgba(255,255,255,0.2); }

        /* ── HOW IT WORKS ── */
        .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 64px; }
        .step { text-align: center; padding: 32px 20px; position: relative; }
        .step::after { content: '→'; position: absolute; right: -12px; top: 32px; color: var(--border); font-size: 20px; }
        .step:last-child::after { display: none; }
        .step-num {
          width: 48px; height: 48px; border-radius: 12px;
          background: rgba(108,99,255,0.1);
          border: 1px solid rgba(108,99,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--accent);
          margin: 0 auto 20px;
        }
        .step-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .step-desc  { font-size: 13px; color: var(--muted); line-height: 1.6; }

        /* ── TESTIMONIALS ── */
        .testimonials-section { background: var(--bg2); }
        .testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 56px; }
        .testimonial { background: var(--bg); border: 1px solid var(--border); border-radius: 14px; padding: 28px; }
        .t-stars { color: #f59e0b; font-size: 14px; margin-bottom: 16px; }
        .t-text { font-size: 14px; color: #94a3b8; line-height: 1.7; margin-bottom: 20px; }
        .t-author { display: flex; align-items: center; gap: 12px; }
        .t-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 14px; font-weight: 700; color: white;
        }
        .t-name { font-size: 14px; font-weight: 600; }
        .t-role { font-size: 12px; color: var(--muted); }

        /* ── CTA ── */
        .cta-section { text-align: center; padding: 120px 24px; }
        .cta-box {
          max-width: 700px; margin: 0 auto;
          background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(74,222,128,0.05));
          border: 1px solid rgba(108,99,255,0.2);
          border-radius: 24px; padding: 72px 48px;
          position: relative; overflow: hidden;
        }
        .cta-box::before {
          content: '';
          position: absolute;
          top: -60px; left: 50%; transform: translateX(-50%);
          width: 300px; height: 300px;
          background: radial-gradient(ellipse, rgba(108,99,255,0.2), transparent 70%);
          pointer-events: none;
        }
        .cta-title { font-family: var(--font-display); font-size: clamp(28px, 4vw, 44px); font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 16px; }
        .cta-sub { font-size: 16px; color: var(--muted); margin-bottom: 36px; }
        .cta-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .cta-note { margin-top: 20px; font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .cta-note span { display: flex; align-items: center; gap: 6px; }

        /* ── FOOTER ── */
        footer { background: var(--bg2); border-top: 1px solid var(--border); padding: 60px 24px 32px; }
        .footer-grid {
          max-width: 1100px; margin: 0 auto;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          padding-bottom: 48px;
          border-bottom: 1px solid var(--border);
        }
        .footer-brand p { font-size: 14px; color: var(--muted); margin-top: 14px; max-width: 260px; line-height: 1.65; }
        .footer-col h4 { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
        .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .footer-col ul a { font-size: 14px; color: var(--muted); text-decoration: none; transition: color 0.2s; }
        .footer-col ul a:hover { color: var(--text); }
        .footer-bottom { max-width: 1100px; margin: 32px auto 0; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--muted); flex-wrap: wrap; gap: 8px; }

        /* ── ANIMATIONS ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }

        /* ── FEATURE TABS SECTION ── */
        .feature-tabs-section { padding: 100px 24px; background: var(--bg); overflow: hidden; }
        .tabs-header { text-align: center; margin-bottom: 64px; }
        .tabs-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          max-width: 1100px; margin: 0 auto;
          border: 1px solid var(--border);
          border-radius: 20px;
          overflow: hidden;
          background: var(--bg2);
          box-shadow: 0 40px 100px rgba(0,0,0,0.5);
          min-height: 520px;
        }
        .tabs-nav {
          background: rgba(255,255,255,0.02);
          border-right: 1px solid var(--border);
          padding: 24px 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .tabs-nav-header {
          padding: 0 20px 16px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
          display: flex; align-items: center; gap: 10px;
        }
        .tabs-nav-logo { width: 28px; height: 28px; background: var(--accent); border-radius: 7px; flex-shrink: 0; }
        .tabs-nav-logo-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text); }
        .tab-item {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 20px;
          cursor: pointer; transition: all 0.2s;
          position: relative;
          font-size: 13px; font-weight: 500; color: var(--muted);
          user-select: none;
        }
        .tab-item:hover { color: var(--text); background: rgba(255,255,255,0.04); }
        .tab-item.active { color: white; background: rgba(108,99,255,0.14); }
        .tab-item.active .tab-icon { background: var(--accent); }
        .tab-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--accent);
          border-radius: 0 2px 2px 0;
        }
        .tab-icon {
          width: 22px; height: 22px; border-radius: 5px;
          background: rgba(255,255,255,0.07);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
          transition: background 0.2s;
        }
        .tabs-content-area { position: relative; overflow: hidden; padding: 28px; }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        .tp-title { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 20px; }
        .tp-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
        .tp-kpi { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
        .tp-kpi-label { font-size: 10px; color: var(--muted); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.05em; }
        .tp-kpi-val { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--text); line-height: 1; }
        .tp-kpi-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; margin-top: 4px; padding: 2px 6px; border-radius: 4px; }
        .tp-kpi-badge.up   { background: rgba(74,222,128,0.12); color: #4ade80; }
        .tp-kpi-badge.warn { background: rgba(248,113,113,0.12); color: #f87171; }
        .tp-chart-area { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
        .tp-chart-title { font-size: 11px; color: var(--muted); margin-bottom: 14px; }
        .tp-bars { display: flex; align-items: flex-end; gap: 5px; height: 110px; }
        .tp-bar { flex: 1; border-radius: 3px 3px 0 0; background: rgba(108,99,255,0.25); transition: background 0.2s; cursor: pointer; }
        .tp-bar:hover { background: rgba(108,99,255,0.55); }
        .tp-bar.hi { background: var(--accent); }

        .ss-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
        .ss-card { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
        .ss-card:hover { border-color: rgba(108,99,255,0.4); transform: translateY(-2px); }
        .ss-thumb { height: 70px; display: flex; align-items: center; justify-content: center; font-size: 20px; position: relative; overflow: hidden; }
        .ss-thumb::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4)); }
        .ss-info { padding: 8px; }
        .ss-name { font-size: 10px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .ss-time { font-size: 9px; color: var(--muted); }
        .ss-filter-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .ss-filter-btn { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 500; background: var(--bg3); border: 1px solid var(--border); color: var(--muted); cursor: pointer; transition: all 0.15s; }
        .ss-filter-btn.active { background: rgba(108,99,255,0.15); border-color: rgba(108,99,255,0.4); color: var(--accent); }

        .emp-table { width: 100%; border-collapse: collapse; }
        .emp-table th { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); font-weight: 600; }
        .emp-table td { padding: 10px 12px; font-size: 12px; color: var(--text); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .emp-status { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; }
        .emp-status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .emp-status.online .emp-status-dot { background: #4ade80; }
        .emp-status.offline .emp-status-dot { background: #64748b; }
        .emp-status.idle .emp-status-dot { background: #f59e0b; }
        .emp-prod-bar { display: flex; align-items: center; gap: 8px; }
        .emp-prod-track { height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; flex: 1; overflow: hidden; }
        .emp-prod-fill { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.8s ease; }
        .emp-prod-fill.green  { background: #4ade80; }
        .emp-prod-fill.yellow { background: #f59e0b; }

        .alert-list { display: flex; flex-direction: column; gap: 8px; }
        .alert-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg3); cursor: pointer; transition: border-color 0.2s; }
        .alert-item:hover { border-color: rgba(255,255,255,0.12); }
        .alert-item.high   { border-left: 3px solid #f87171; }
        .alert-item.medium { border-left: 3px solid #f59e0b; }
        .alert-item.low    { border-left: 3px solid #4ade80; }
        .alert-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .alert-item.high   .alert-dot { background: #f87171; }
        .alert-item.medium .alert-dot { background: #f59e0b; }
        .alert-item.low    .alert-dot { background: #4ade80; }
        .alert-body { flex: 1; }
        .alert-title { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .alert-desc  { font-size: 11px; color: var(--muted); }
        .alert-time  { font-size: 10px; color: var(--muted); white-space: nowrap; }

        .live-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .live-card { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; transition: border-color 0.2s; cursor: pointer; }
        .live-card:hover { border-color: rgba(108,99,255,0.4); }
        .live-card.watching { border-color: rgba(248,113,113,0.5); }
        .live-screen { height: 80px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .live-pulse { position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: #f87171; animation: livePulse 1.5s ease-in-out infinite; }
        @keyframes livePulse {
          0%,100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(248,113,113,0.4); }
          50% { opacity: 0.7; transform: scale(0.9); box-shadow: 0 0 0 6px rgba(248,113,113,0); }
        }
        .live-footer { padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; }
        .live-name { font-size: 11px; font-weight: 600; color: var(--text); }
        .live-app  { font-size: 10px; color: var(--muted); }

        .report-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .report-kpi { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 14px; text-align: center; }
        .report-kpi-val { font-family: var(--font-display); font-size: 26px; font-weight: 800; color: var(--text); }
        .report-kpi-label { font-size: 10px; color: var(--muted); margin-top: 3px; }
        .report-chart { background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
        .report-bars-h { display: flex; flex-direction: column; gap: 8px; }
        .rbar-row { display: flex; align-items: center; gap: 10px; }
        .rbar-label { font-size: 11px; color: var(--muted); width: 70px; text-align: right; flex-shrink: 0; }
        .rbar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .rbar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), #a78bfa); }
        .rbar-val { font-size: 11px; color: var(--text); width: 36px; text-align: right; font-weight: 600; }

        /* ── INTEL SECTION ── */
        .intel-section { background: var(--bg2); padding: 100px 24px; }
        .intel-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; margin-top: 64px; }
        .intel-col-title { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; }
        .intel-metric { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; gap: 12px; }
        .intel-metric:hover { border-color: rgba(108,99,255,0.3); background: rgba(108,99,255,0.04); }
        .intel-metric-left { display: flex; align-items: center; gap: 12px; }
        .intel-metric-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .intel-metric-name { font-size: 13px; font-weight: 600; color: var(--text); }
        .intel-metric-sub  { font-size: 11px; color: var(--muted); margin-top: 1px; }
        .intel-metric-right { text-align: right; flex-shrink: 0; }
        .intel-metric-val  { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--text); }
        .intel-metric-mini { font-size: 10px; margin-top: 2px; }
        .intel-metric-mini.up   { color: #4ade80; }
        .intel-metric-mini.warn { color: #f87171; }
        .intel-mini-bar  { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; margin-top: 6px; width: 80px; }
        .intel-mini-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--accent), #818cf8); }

        /* ── RESPONSIVE ── */
        @media (max-width: 1100px) {
          .features-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          nav { padding: 16px 24px; }
          nav ul { display: none; }
          .nav-cta .btn-ghost { display: none; }
          .hamburger { display: flex; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .plans-grid { grid-template-columns: 1fr; max-width: 420px; margin-left: auto; margin-right: auto; }
          .steps { grid-template-columns: 1fr 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 1fr 1fr; }
          .mockup-cards { grid-template-columns: repeat(2, 1fr); }
          .tabs-layout { grid-template-columns: 1fr; min-height: auto; }
          .tabs-nav { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--border); padding: 0; flex-direction: row; }
          .tabs-nav-header { display: none; }
          .tab-item { white-space: nowrap; border-radius: 0; }
          .tab-item.active::before { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 3px; border-radius: 0; }
          .intel-layout { grid-template-columns: 1fr; }
          .tp-kpi-row { grid-template-columns: repeat(2, 1fr); }
          .hero-sub { font-size: 16px; }
          .hero-stats { gap: 24px; margin-top: 48px; }
          .stat-divider { display: none; }
        }
        @media (max-width: 768px) {
          .hero-mockup { display: none; }
          section { padding: 72px 20px; }
          .hero { padding: 120px 20px 72px; }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr 1fr; }
          .steps { grid-template-columns: 1fr; }
          .step::after { display: none; }
          .footer-grid { grid-template-columns: 1fr; }
          .cta-box { padding: 40px 20px; }
          .ss-grid { grid-template-columns: repeat(2, 1fr); }
          .live-grid { grid-template-columns: repeat(2, 1fr); }
          .report-kpis { grid-template-columns: repeat(2, 1fr); }
          .hero-actions { flex-direction: column; width: 100%; }
          .hero-actions a { width: 100%; justify-content: center; }
          nav { padding: 14px 20px; }
          .plan-price { font-size: 32px; }
        }
        @media (max-width: 400px) {
          .features-grid { grid-template-columns: 1fr; }
          h1 { font-size: 34px; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav>
        <Link href="#" className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" /></svg>
          </div>
          MonitorHub
        </Link>
        <ul>
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How It Works</a></li>
          <li><a href="#plans">Pricing</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <div className="nav-cta">
          <a href="https://app.monitorhub.live/login" className="btn-ghost">Login</a>
          <Link href="/signup" className="btn-primary">Get Started →</Link>
        </div>
        <button
          className={`hamburger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div className="mobile-menu">
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#how"      onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#plans"    onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#contact"  onClick={() => setMenuOpen(false)}>Contact</a>
          <div className="mobile-menu-divider" />
          <div className="mobile-menu-sub">
            <a href="https://app.monitorhub.live/login" onClick={() => setMenuOpen(false)}>Login</a>
            <Link href="/signup" className="btn-primary btn-large" onClick={() => setMenuOpen(false)}>
              Get Started →
            </Link>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-glow2" />

        <div className="badge">
          <span className="badge-dot" />
          Real-time Employee Monitoring Platform
        </div>

        <h1>
          Monitor. Protect.<br />
          <span className="accent">Stay in Control.</span>
        </h1>

        <p className="hero-sub">
          Complete visibility into your workforce — screenshots, activity tracking, site blocking, and live screen monitoring. All from one dashboard.
        </p>

        <div className="hero-actions">
          <Link href="/signup" className="btn-primary btn-large">Start Free Trial →</Link>
          <a href="#how" className="btn-outline">See How It Works</a>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-number">500+</span>
            <span className="stat-label">Companies</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">10K+</span>
            <span className="stat-label">Employees Monitored</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">99.9%</span>
            <span className="stat-label">Uptime</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">3 Plans</span>
            <span className="stat-label">Free to Premium</span>
          </div>
        </div>

        {/* Dashboard Mockup */}
        <div className="hero-mockup">
          <div className="mockup-bar">
            <div className="mockup-dots">
              <div className="dot dot-r" /><div className="dot dot-y" /><div className="dot dot-g" />
            </div>
            <div className="mockup-url">app.monitorhub.live/dashboard</div>
          </div>
          <div className="mockup-content">
            <div className="mockup-sidebar">
              <div className="sidebar-logo">
                <div className="sidebar-logo-icon" />
                <span className="sidebar-logo-text">MonitorHub</span>
              </div>
              {["Dashboard","Employees","Screenshots","Alerts","Reports","Live Screen","Settings"].map((item, i) => (
                <div key={item} className={`sidebar-item${i === 0 ? " active" : ""}`}>
                  <div className="si-icon" /> {item}
                </div>
              ))}
            </div>
            <div className="mockup-main">
              <div className="mockup-cards">
                {[
                  { label: "ACTIVE EMPLOYEES", value: "24",   sub: "↑ 3 online now",      red: false },
                  { label: "SCREENSHOTS TODAY", value: "1,247", sub: "↑ 12% vs yesterday", red: false },
                  { label: "ALERTS",            value: "7",   sub: "↑ 2 high severity",   red: true  },
                  { label: "PRODUCTIVITY",      value: "84%", sub: "↑ 4% this week",       red: false },
                ].map((c) => (
                  <div key={c.label} className="mockup-card">
                    <div className="mc-label">{c.label}</div>
                    <div className="mc-value">{c.value}</div>
                    <div className={`mc-sub${c.red ? " red" : ""}`}>{c.sub}</div>
                  </div>
                ))}
              </div>
              <div className="mockup-graph">
                <div className="mg-title">Activity Overview — Last 14 Days</div>
                <div className="graph-bars">
                  {[40,55,48,70,62,85,75,90,68,72,80,65,88,95].map((h, i) => (
                    <div key={i} className={`bar${h >= 88 ? " highlight" : ""}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features">
        <div className="container">
          <div className="reveal">
            <div className="section-badge">⚡ Features</div>
            <h2 className="section-title">Everything you need to<br />monitor your team</h2>
            <p className="section-sub">Powerful tools that give you complete visibility — without complexity.</p>
          </div>
          <div className="features-grid reveal">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <div className="fc-icon" style={{ background: f.color }}>{f.icon}</div>
                <div className="fc-title">{f.title}</div>
                <div className="fc-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE TABS ── */}
      <section className="feature-tabs-section">
        <div className="container">
          <div className="tabs-header reveal">
            <div className="section-badge">🖥️ Explore the Platform</div>
            <h2 className="section-title">Every tool, one dashboard</h2>
            <p className="section-sub" style={{ margin: "0 auto" }}>
              Click any section below to see exactly what your team will experience — real data, real UI.
            </p>
          </div>

          <div className="tabs-layout reveal">
            {/* Sidebar Nav */}
            <div className="tabs-nav">
              <div className="tabs-nav-header">
                <div className="tabs-nav-logo" />
                <span className="tabs-nav-logo-text">MonitorHub</span>
              </div>
              {TABS.map((t) => (
                <div
                  key={t.id}
                  className={`tab-item${activeTab === t.id ? " active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  <div className="tab-icon">{t.icon}</div>
                  {t.label}
                </div>
              ))}
            </div>

            {/* Content Panels */}
            <div className="tabs-content-area">

              {/* Dashboard */}
              <div className={`tab-panel${activeTab === "dashboard" ? " active" : ""}`}>
                <div className="tp-title">Dashboard Overview</div>
                <div className="tp-kpi-row">
                  {[
                    { label: "Active Employees", val: "24",   badge: "up",   b: "↑ 3 online" },
                    { label: "Screenshots Today", val: "1,247", badge: "up", b: "↑ 12%" },
                    { label: "Alerts",            val: "7",   badge: "warn", b: "↑ 2 high" },
                    { label: "Productivity",      val: "84%", badge: "up",   b: "↑ 4%" },
                  ].map((k) => (
                    <div key={k.label} className="tp-kpi">
                      <div className="tp-kpi-label">{k.label}</div>
                      <div className="tp-kpi-val">{k.val}</div>
                      <div className={`tp-kpi-badge ${k.badge}`}>{k.b}</div>
                    </div>
                  ))}
                </div>
                <div className="tp-chart-area">
                  <div className="tp-chart-title">Activity — Last 14 Days</div>
                  <div className="tp-bars">
                    {[38,52,46,68,60,82,73,88,65,70,78,62,85,93].map((h, i) => (
                      <div key={i} className={`tp-bar${h >= 85 ? " hi" : ""}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Employees */}
              <div className={`tab-panel${activeTab === "employees" ? " active" : ""}`}>
                <div className="tp-title">Employee Status</div>
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Department</th><th>Status</th><th>Productivity</th><th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Ali Hassan",    dept: "Engineering", status: "online",  prod: 88,  color: "green",  last: "Just now"   },
                      { name: "Sara Malik",    dept: "Marketing",   status: "idle",    prod: 62,  color: "yellow", last: "12 min ago" },
                      { name: "Omar Farooq",   dept: "Sales",       status: "online",  prod: 91,  color: "green",  last: "2 min ago"  },
                      { name: "Nadia Qureshi", dept: "HR",          status: "offline", prod: 0,   color: "",       last: "2 hrs ago"  },
                      { name: "Bilal Ahmed",   dept: "Finance",     status: "online",  prod: 76,  color: "green",  last: "5 min ago"  },
                    ].map((e) => (
                      <tr key={e.name}>
                        <td><strong>{e.name}</strong></td>
                        <td style={{ color: "var(--muted)" }}>{e.dept}</td>
                        <td>
                          <span className={`emp-status ${e.status}`}>
                            <span className="emp-status-dot" /> {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                          </span>
                        </td>
                        <td>
                          <div className="emp-prod-bar">
                            <div className="emp-prod-track">
                              <div className={`emp-prod-fill${e.color ? ` ${e.color}` : ""}`} style={{ width: `${e.prod}%` }} />
                            </div>
                            <span style={{ fontSize: 11, color: e.color === "green" ? "#4ade80" : e.color === "yellow" ? "#f59e0b" : "var(--muted)" }}>
                              {e.prod > 0 ? `${e.prod}%` : "—"}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: 11 }}>{e.last}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Screenshots */}
              <div className={`tab-panel${activeTab === "screenshots" ? " active" : ""}`}>
                <div className="tp-title">Screenshots Captured</div>
                <div className="ss-filter-row">
                  {["All","Engineering","Marketing","Sales"].map((f, i) => (
                    <button key={f} className={`ss-filter-btn${i === 0 ? " active" : ""}`}>{f}</button>
                  ))}
                </div>
                <div className="ss-grid">
                  {[
                    { bg: "linear-gradient(135deg,rgba(108,99,255,0.3),rgba(59,130,246,0.2))",   icon: "💻", name: "Ali Hassan",  app: "VS Code",  time: "2 min ago"  },
                    { bg: "linear-gradient(135deg,rgba(74,222,128,0.2),rgba(16,185,129,0.15))",  icon: "📧", name: "Omar Farooq", app: "Gmail",    time: "4 min ago"  },
                    { bg: "linear-gradient(135deg,rgba(245,158,11,0.2),rgba(251,191,36,0.1))",   icon: "📊", name: "Sara Malik",  app: "Excel",    time: "14 min ago" },
                    { bg: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(236,72,153,0.1))",    icon: "🔴", name: "Bilal Ahmed", app: "Chrome",   time: "6 min ago"  },
                    { bg: "linear-gradient(135deg,rgba(168,85,247,0.2),rgba(139,92,246,0.15))", icon: "📝", name: "Ali Hassan",  app: "Notion",   time: "8 min ago"  },
                    { bg: "linear-gradient(135deg,rgba(20,184,166,0.2),rgba(6,182,212,0.1))",    icon: "💬", name: "Omar Farooq", app: "Slack",    time: "10 min ago" },
                  ].map((s, i) => (
                    <div key={i} className="ss-card">
                      <div className="ss-thumb" style={{ background: s.bg }}>{s.icon}</div>
                      <div className="ss-info">
                        <div className="ss-name">{s.name}</div>
                        <div className="ss-time">{s.time} · {s.app}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerts */}
              <div className={`tab-panel${activeTab === "alerts" ? " active" : ""}`}>
                <div className="tp-title">Recent Alerts</div>
                <div className="alert-list">
                  {[
                    { severity: "high",   title: "USB Device Connected",  desc: "Ali Hassan inserted a USB drive on PC-ENGINEERING-01",       time: "2 min ago"  },
                    { severity: "high",   title: "Blocked Site Attempt",   desc: "Sara Malik attempted to visit youtube.com (blocked)",         time: "14 min ago" },
                    { severity: "medium", title: "Idle Time Detected",     desc: "Nadia Qureshi was idle for 25+ minutes",                     time: "1 hr ago"   },
                    { severity: "medium", title: "After-Hours Activity",   desc: "Bilal Ahmed logged in at 11:42 PM last night",               time: "8 hrs ago"  },
                    { severity: "low",    title: "App Usage Anomaly",      desc: "Omar Farooq used WhatsApp Web for 2+ hours",                 time: "Yesterday"  },
                  ].map((a, i) => (
                    <div key={i} className={`alert-item ${a.severity}`}>
                      <div className="alert-dot" />
                      <div className="alert-body">
                        <div className="alert-title">{a.title}</div>
                        <div className="alert-desc">{a.desc}</div>
                      </div>
                      <div className="alert-time">{a.time}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Screen */}
              <div className={`tab-panel${activeTab === "livescreen" ? " active" : ""}`}>
                <div className="tp-title">Live Screen Monitoring</div>
                <div className="live-grid">
                  {[
                    { name: "Ali Hassan",    app: "VS Code · Active",    bg: "linear-gradient(135deg,rgba(108,99,255,0.25),rgba(59,130,246,0.15))", icon: "💻", watching: true  },
                    { name: "Omar Farooq",   app: "Gmail · Active",      bg: "linear-gradient(135deg,rgba(74,222,128,0.2),rgba(16,185,129,0.1))",   icon: "📧", watching: false },
                    { name: "Sara Malik",    app: "Excel · Idle 12m",    bg: "linear-gradient(135deg,rgba(245,158,11,0.2),rgba(251,191,36,0.1))",   icon: "📊", watching: false },
                    { name: "Nadia Qureshi", app: "Offline",             bg: "rgba(255,255,255,0.03)",                                              icon: "🌙", watching: false, offline: true },
                    { name: "Bilal Ahmed",   app: "Quickbooks · Active", bg: "linear-gradient(135deg,rgba(168,85,247,0.2),rgba(139,92,246,0.1))",  icon: "🔢", watching: false },
                    { name: "Hina Baig",     app: "Chrome · Active",     bg: "linear-gradient(135deg,rgba(239,68,68,0.15),rgba(236,72,153,0.08))", icon: "🌐", watching: false },
                  ].map((l, i) => (
                    <div key={i} className={`live-card${l.watching ? " watching" : ""}`}>
                      <div className="live-screen" style={{ background: l.bg }}>
                        {l.watching && <div className="live-pulse" />}
                        <span style={{ fontSize: 22, opacity: l.offline ? 0.3 : 1 }}>{l.icon}</span>
                      </div>
                      <div className="live-footer">
                        <div>
                          <div className="live-name">{l.name}</div>
                          <div className="live-app" style={l.offline ? { color: "#64748b" } : {}}>{l.app}</div>
                        </div>
                        {l.watching && <span style={{ fontSize: 9, color: "#f87171", fontWeight: 700 }}>● LIVE</span>}
                        {!l.watching && !l.offline && <span style={{ fontSize: 10, color: "var(--muted)" }}>Click to Watch</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reports */}
              <div className={`tab-panel${activeTab === "reports" ? " active" : ""}`}>
                <div className="tp-title">Weekly Report Summary</div>
                <div className="report-kpis">
                  <div className="report-kpi"><div className="report-kpi-val" style={{ color: "#4ade80" }}>84%</div><div className="report-kpi-label">Avg Productivity</div></div>
                  <div className="report-kpi"><div className="report-kpi-val">47h</div><div className="report-kpi-label">Total Work Hours</div></div>
                  <div className="report-kpi"><div className="report-kpi-val" style={{ color: "#f87171" }}>12</div><div className="report-kpi-label">Policy Violations</div></div>
                </div>
                <div className="report-chart">
                  <div className="tp-chart-title">Top Apps by Usage Time</div>
                  <div className="report-bars-h">
                    {[
                      { label: "VS Code", pct: 78, gradient: "linear-gradient(90deg,var(--accent),#a78bfa)" },
                      { label: "Chrome",  pct: 65, gradient: "linear-gradient(90deg,#4ade80,#22d3ee)" },
                      { label: "Slack",   pct: 42, gradient: "linear-gradient(90deg,#f59e0b,#fbbf24)" },
                      { label: "Excel",   pct: 34, gradient: "linear-gradient(90deg,#22d3ee,#6366f1)" },
                      { label: "Zoom",    pct: 22, gradient: "linear-gradient(90deg,#ec4899,#a855f7)" },
                    ].map((r) => (
                      <div key={r.label} className="rbar-row">
                        <div className="rbar-label">{r.label}</div>
                        <div className="rbar-track"><div className="rbar-fill" style={{ width: `${r.pct}%`, background: r.gradient }} /></div>
                        <div className="rbar-val">{r.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── INTELLIGENCE ── */}
      <section className="intel-section">
        <div className="container">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="section-badge">📡 Unified Visibility</div>
            <h2 className="section-title">Complete workforce intelligence,<br />in one place</h2>
            <p className="section-sub" style={{ margin: "0 auto" }}>
              Stop switching between tools. Get a single, unified view of employee activity, productivity and security.
            </p>
          </div>
          <div className="intel-layout reveal">
            {/* Left */}
            <div>
              <div className="intel-col-title"><span>👤</span> Employee Activity Data</div>
              {[
                { icon: "📸", bg: "rgba(108,99,255,0.15)", name: "Screenshot Capture",   sub: "Automatic, interval-based",      val: "Every 5m",  fill: "100%", grad: "linear-gradient(90deg,var(--accent),#818cf8)" },
                { icon: "🌐", bg: "rgba(74,222,128,0.12)",  name: "Browser History",       sub: "All visited sites tracked",      val: "Real-time", fill: "90%",  grad: "linear-gradient(90deg,#4ade80,#22d3ee)" },
                { icon: "⌨️", bg: "rgba(245,158,11,0.12)",  name: "Keylogger",             sub: "Per-app keystroke logging",      val: "All Apps",  fill: "85%",  grad: "linear-gradient(90deg,#f59e0b,#fbbf24)" },
                { icon: "📊", bg: "rgba(59,130,246,0.12)",  name: "Productivity Score",    sub: "Based on active time & apps",    val: "84%",       fill: "84%",  grad: "linear-gradient(90deg,#3b82f6,#6366f1)" },
                { icon: "⏱️", bg: "rgba(168,85,247,0.12)",  name: "Work Hours Tracking",   sub: "Login, logout & idle time",      val: "47h / wk",  fill: "76%",  grad: "linear-gradient(90deg,#a855f7,#ec4899)" },
              ].map((m) => (
                <div key={m.name} className="intel-metric">
                  <div className="intel-metric-left">
                    <div className="intel-metric-icon" style={{ background: m.bg }}>{m.icon}</div>
                    <div><div className="intel-metric-name">{m.name}</div><div className="intel-metric-sub">{m.sub}</div></div>
                  </div>
                  <div className="intel-metric-right">
                    <div className="intel-metric-val">{m.val}</div>
                    <div className="intel-mini-bar"><div className="intel-mini-fill" style={{ width: m.fill, background: m.grad }} /></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Right */}
            <div>
              <div className="intel-col-title"><span>🛡️</span> Security &amp; Control</div>
              {[
                { icon: "🔔", bg: "rgba(248,113,113,0.12)", name: "Smart Alerts",         sub: "USB, idle, after-hours",         val: "7 Active",   mini: "↑ 2 high severity", cls: "warn", valColor: "#f87171" },
                { icon: "🚫", bg: "rgba(239,68,68,0.12)",   name: "Site Blocking",         sub: "Block and unblock instantly",    val: "42 Blocked", mini: "↑ Enforced",        cls: "up",   valColor: "" },
                { icon: "💾", bg: "rgba(250,204,21,0.12)",  name: "File Activity",         sub: "Open, copy, delete, transfer",   val: "319 Events", mini: "Today",             cls: "up",   valColor: "" },
                { icon: "🖥️", bg: "rgba(20,184,166,0.12)",  name: "Live Screen",           sub: "Watch any employee live",        val: "5 Online",   mini: "Streaming",         cls: "up",   valColor: "#4ade80" },
                { icon: "🔒", bg: "rgba(236,72,153,0.12)",  name: "Remote Lock & Shutdown",sub: "Instant remote control",         val: "All PCs",    mini: "Ready",             cls: "up",   valColor: "" },
              ].map((m) => (
                <div key={m.name} className="intel-metric">
                  <div className="intel-metric-left">
                    <div className="intel-metric-icon" style={{ background: m.bg }}>{m.icon}</div>
                    <div><div className="intel-metric-name">{m.name}</div><div className="intel-metric-sub">{m.sub}</div></div>
                  </div>
                  <div className="intel-metric-right">
                    <div className="intel-metric-val" style={m.valColor ? { color: m.valColor } : {}}>{m.val}</div>
                    <div className={`intel-metric-mini ${m.cls}`}>{m.mini}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ background: "var(--bg2)" }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="section-badge">🚀 Simple Setup</div>
            <h2 className="section-title">Up and running in minutes</h2>
            <p className="section-sub" style={{ margin: "0 auto" }}>No IT expertise needed. Just sign up, install, and monitor.</p>
          </div>
          <div className="steps reveal">
            {[
              { num: "1", title: "Sign Up",        desc: "Create your company account and choose a plan that fits your team size." },
              { num: "2", title: "Add Employees",  desc: "Add your employees and generate their unique agent tokens from the dashboard." },
              { num: "3", title: "Install Agent",  desc: "Run EmployeeMonitor.exe once as Administrator on each employee's PC. That's it." },
              { num: "4", title: "Monitor",        desc: "Data flows in automatically. View screenshots, activity, and alerts in real-time." },
            ].map((s) => (
              <div key={s.num} className="step">
                <div className="step-num">{s.num}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANS ── */}
      <section id="plans">
        <div className="container">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="section-badge">💎 Pricing</div>
            <h2 className="section-title">Simple, transparent pricing</h2>
            <p className="section-sub" style={{ margin: "0 auto" }}>Start free. Upgrade as you grow. No hidden fees.</p>
          </div>

          <div className="plans-grid reveal">
            {/* Free */}
            <div className="plan-card">
              <div className="plan-name">Free</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Perfect for small teams</div>
              <div className="plan-price">PKR 0 <span>/month</span></div>
              <div className="plan-desc">Up to 2 employees, 1 admin</div>
              <ul className="plan-features">
                {["Screenshots","Browser History","USB Monitoring","Alerts","Remote Shutdown"].map((f) => (
                  <li key={f} className="has"><span className="pf-check yes">✓</span> {f}</li>
                ))}
                {["Advanced Reports","Keylogger","File Activity","Print Logs","Live Screen","Remote Lock"].map((f) => (
                  <li key={f}><span className="pf-check no">✕</span> {f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn outline">Get Started Free</Link>
            </div>

            {/* Standard */}
            <div className="plan-card popular">
              <div className="popular-badge">Most Popular</div>
              <div className="plan-name">Standard</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>For growing businesses</div>
              <div className="plan-price">PKR 5,000 <span>/month</span></div>
              <div className="plan-desc">Unlimited employees, multiple admins</div>
              <ul className="plan-features">
                {["Screenshots","Browser History","USB Monitoring","Alerts","Remote Shutdown","Advanced Reports","Keylogger","File Activity","Print Logs"].map((f) => (
                  <li key={f} className="has"><span className="pf-check yes">✓</span> {f}</li>
                ))}
                {["Live Screen","Remote Lock"].map((f) => (
                  <li key={f}><span className="pf-check no">✕</span> {f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn primary">Get Started →</Link>
            </div>

            {/* Premium */}
            <div className="plan-card">
              <div className="plan-name">Premium</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Full control &amp; visibility</div>
              <div className="plan-price">PKR 10,000 <span>/month</span></div>
              <div className="plan-desc">Everything in Standard + Live Screen + Lock</div>
              <ul className="plan-features">
                {["All Standard Features","Live Screen Viewing","Remote Lock","Priority Support","Custom Data Retention","API Access"].map((f) => (
                  <li key={f} className="has"><span className="pf-check yes">✓</span> {f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn outline">Get Started →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="testimonials-section">
        <div className="container">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="section-badge">⭐ Reviews</div>
            <h2 className="section-title">Trusted by businesses</h2>
          </div>
          <div className="testimonials-grid reveal">
            {[
              { text: `"MonitorHub gave us complete visibility into our remote team. Setup took 10 minutes and the data started flowing immediately. Absolutely worth it."`, name: "Ahmed Khan",   role: "CEO, TechSolutions PK",  initials: "AK", bg: "#6c63ff", textColor: "white" },
              { text: `"The site blocking feature alone saved us hours of lost productivity. The dashboard is clean and the alerts are spot on. Highly recommend."`,          name: "Sara Rehman",  role: "HR Manager, DigitalCo",   initials: "SR", bg: "#4ade80", textColor: "#000" },
              { text: `"We tried other tools but none matched MonitorHub's simplicity. One install and everything works — screenshots, keylogger, live screen. Perfect."`,  name: "Usman Farooq", role: "IT Director, MediaGroup", initials: "UF", bg: "#f59e0b", textColor: "#000" },
            ].map((t) => (
              <div key={t.name} className="testimonial">
                <div className="t-stars">★★★★★</div>
                <div className="t-text">{t.text}</div>
                <div className="t-author">
                  <div className="t-avatar" style={{ background: t.bg, color: t.textColor }}>{t.initials}</div>
                  <div>
                    <div className="t-name">{t.name}</div>
                    <div className="t-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section" id="contact">
        <div className="cta-box reveal">
          <h2 className="cta-title">Ready to take control<br />of your workforce?</h2>
          <p className="cta-sub">Start with our free plan. No credit card required.</p>
          <div className="cta-actions">
            <Link href="/signup" className="btn-primary btn-large">Start Free Trial →</Link>
            <a href="mailto:support@monitorhub.live" className="btn-outline">Contact Sales</a>
          </div>
          <div className="cta-note">
            <span>✓ Free plan available</span>
            <span>✓ Setup in 10 minutes</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="#" className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" /></svg>
              </div>
              MonitorHub
            </Link>
            <p>Complete employee monitoring platform for modern businesses. Real-time visibility, zero complexity.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#plans">Pricing</a></li>
              <li><a href="#how">How It Works</a></li>
              <li><Link href="/signup">Sign Up</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><a href="https://app.monitorhub.live">Dashboard</a></li>
              <li><a href="https://monitorhub.live">Company Portal</a></li>
              <li><a href="https://admin.monitorhub.live">Master Admin</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <ul>
              <li><a href="mailto:support@monitorhub.live">Contact Us</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 MonitorHub. All rights reserved.</span>
          <span>monitorhub.live</span>
        </div>
      </footer>
    </>
  );
}
