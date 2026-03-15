"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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

        nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 60px;
          background: rgba(8,11,18,0.85);
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

        .nav-cta { display: flex; align-items: center; gap: 12px; }

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
          font-size: clamp(42px, 6vw, 80px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin-bottom: 24px;
          animation: fadeUp 0.6s 0.1s ease both;
        }

        .accent { color: var(--accent); }
        .accent2 { color: var(--accent2); }

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

        .btn-large { padding: 14px 32px; font-size: 16px; border-radius: 10px; }

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

        .stat-number {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          color: var(--text);
        }

        .stat-label { font-size: 13px; color: var(--muted); }
        .stat-divider { width: 1px; height: 40px; background: var(--border); }

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

        .sidebar-logo-icon {
          width: 24px; height: 24px;
          background: var(--accent);
          border-radius: 6px;
        }

        .sidebar-logo-text {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
        }

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

        .si-icon {
          width: 20px; height: 20px;
          border-radius: 4px;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        .mockup-main { padding: 20px; }

        .mockup-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

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
          overflow: hidden;
        }

        .mg-title { font-size: 11px; color: var(--muted); margin-bottom: 12px; }

        .graph-bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 130px;
        }

        .bar {
          flex: 1;
          border-radius: 4px 4px 0 0;
          background: rgba(108,99,255,0.3);
          transition: background 0.2s;
        }
        .bar:hover { background: rgba(108,99,255,0.6); }
        .bar.highlight { background: var(--accent); }

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
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }

        .section-sub { font-size: 17px; color: var(--muted); max-width: 520px; line-height: 1.7; }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          margin-top: 64px;
        }

        .feature-card {
          background: var(--bg);
          padding: 36px 32px;
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
          margin-bottom: 20px;
          font-size: 20px;
        }

        .fc-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; margin-bottom: 10px; color: var(--text); }
        .fc-desc { font-size: 14px; color: var(--muted); line-height: 1.65; }

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

        .plan-price {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 800;
          line-height: 1;
          margin: 20px 0 4px;
        }

        .plan-price span { font-size: 16px; font-weight: 400; color: var(--muted); }

        .plan-desc {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 28px;
          padding-bottom: 28px;
          border-bottom: 1px solid var(--border);
        }

        .plan-features { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }

        .plan-features li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted); }
        .plan-features li.has { color: var(--text); }

        .pf-check {
          width: 18px; height: 18px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 10px;
        }

        .pf-check.yes { background: rgba(74,222,128,0.15); color: var(--accent2); }
        .pf-check.no  { background: rgba(255,255,255,0.04); color: var(--muted); }

        .plan-btn {
          width: 100%;
          padding: 13px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-display);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          text-decoration: none;
          display: block;
          border: none;
        }

        .plan-btn.primary { background: var(--accent); color: white; }
        .plan-btn.primary:hover { background: #5a52e0; }
        .plan-btn.outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .plan-btn.outline:hover { border-color: rgba(255,255,255,0.2); }

        .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-top: 64px;
        }

        .step { text-align: center; padding: 32px 20px; position: relative; }

        .step::after {
          content: '→';
          position: absolute;
          right: -12px; top: 32px;
          color: var(--border);
          font-size: 20px;
        }

        .step:last-child::after { display: none; }

        .step-num {
          width: 48px; height: 48px;
          border-radius: 12px;
          background: rgba(108,99,255,0.1);
          border: 1px solid rgba(108,99,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: var(--accent);
          margin: 0 auto 20px;
        }

        .step-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .step-desc { font-size: 13px; color: var(--muted); line-height: 1.6; }

        .testimonials-section { background: var(--bg2); }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 56px;
        }

        .testimonial {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 28px;
        }

        .t-stars { color: #f59e0b; font-size: 14px; margin-bottom: 16px; }
        .t-text { font-size: 14px; color: #94a3b8; line-height: 1.7; margin-bottom: 20px; }
        .t-author { display: flex; align-items: center; gap: 12px; }

        .t-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          color: white;
        }

        .t-name { font-size: 14px; font-weight: 600; }
        .t-role { font-size: 12px; color: var(--muted); }

        .cta-section { text-align: center; padding: 120px 24px; }

        .cta-box {
          max-width: 700px;
          margin: 0 auto;
          background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(74,222,128,0.05));
          border: 1px solid rgba(108,99,255,0.2);
          border-radius: 24px;
          padding: 72px 48px;
          position: relative;
          overflow: hidden;
        }

        .cta-box::before {
          content: '';
          position: absolute;
          top: -60px; left: 50%; transform: translateX(-50%);
          width: 300px; height: 300px;
          background: radial-gradient(ellipse, rgba(108,99,255,0.2), transparent 70%);
          pointer-events: none;
        }

        .cta-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }

        .cta-sub { font-size: 16px; color: var(--muted); margin-bottom: 36px; }

        .cta-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        .cta-note {
          margin-top: 20px;
          font-size: 13px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .cta-note span { display: flex; align-items: center; gap: 6px; }

        footer {
          background: var(--bg2);
          border-top: 1px solid var(--border);
          padding: 60px 24px 32px;
        }

        .footer-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          padding-bottom: 48px;
          border-bottom: 1px solid var(--border);
        }

        .footer-brand p { font-size: 14px; color: var(--muted); margin-top: 14px; max-width: 260px; line-height: 1.65; }

        .footer-col h4 {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }

        .footer-col ul a { font-size: 14px; color: var(--muted); text-decoration: none; transition: color 0.2s; }
        .footer-col ul a:hover { color: var(--text); }

        .footer-bottom {
          max-width: 1100px;
          margin: 32px auto 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: var(--muted);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }

        @media (max-width: 900px) {
          nav { padding: 16px 24px; }
          nav ul { display: none; }
          .features-grid { grid-template-columns: 1fr 1fr; }
          .plans-grid { grid-template-columns: 1fr; max-width: 400px; margin-left: auto; margin-right: auto; }
          .steps { grid-template-columns: 1fr 1fr; }
          .testimonials-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 1fr 1fr; }
          .mockup-cards { grid-template-columns: repeat(2,1fr); }
        }

        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr; }
          .steps { grid-template-columns: 1fr; }
          .step::after { display: none; }
          .footer-grid { grid-template-columns: 1fr; }
          .cta-box { padding: 48px 24px; }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <Link href="/" className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
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
          <Link href="http://app.monitorhub.live/login" className="btn-ghost">Login</Link>
          <Link href="/signup" className="btn-primary">Get Started →</Link>
        </div>
      </nav>

      {/* HERO */}
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
              <div className="dot dot-r" />
              <div className="dot dot-y" />
              <div className="dot dot-g" />
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
                  { label: "ACTIVE EMPLOYEES", value: "24", sub: "↑ 3 online now", red: false },
                  { label: "SCREENSHOTS TODAY", value: "1,247", sub: "↑ 12% vs yesterday", red: false },
                  { label: "ALERTS", value: "7", sub: "↑ 2 high severity", red: true },
                  { label: "PRODUCTIVITY", value: "84%", sub: "↑ 4% this week", red: false },
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
                    <div key={i} className={`bar${i === 7 || i === 13 ? " highlight" : ""}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="container">
          <div className="reveal">
            <div className="section-badge">⚡ Features</div>
            <h2 className="section-title">Everything you need to<br />monitor your team</h2>
            <p className="section-sub">Powerful tools that give you complete visibility — without complexity.</p>
          </div>
          <div className="features-grid reveal">
            {[
              { icon: "📸", bg: "rgba(108,99,255,0.12)", title: "Screenshots", desc: "Automatic screenshots at customizable intervals. See exactly what employees are working on in real-time." },
              { icon: "🌐", bg: "rgba(74,222,128,0.12)", title: "Browser History", desc: "Track all websites visited. Identify time wasters and ensure company policies are followed." },
              { icon: "🚫", bg: "rgba(251,191,36,0.12)", title: "Site Blocking", desc: "Block distracting or harmful websites automatically. Changes apply instantly to all employees." },
              { icon: "🔔", bg: "rgba(239,68,68,0.12)", title: "Smart Alerts", desc: "Get notified for idle time, after-hours activity, USB connections, and blocked site visits." },
              { icon: "🖥️", bg: "rgba(59,130,246,0.12)", title: "Live Screen", desc: "Watch employee screens in real-time. Perfect for remote teams and sensitive work environments." },
              { icon: "📊", bg: "rgba(168,85,247,0.12)", title: "Advanced Reports", desc: "Detailed productivity reports, app usage analytics, and work hour summaries for every employee." },
              { icon: "⌨️", bg: "rgba(20,184,166,0.12)", title: "Keylogger", desc: "Record keystrokes per application. Understand exactly how time is spent across tools." },
              { icon: "💾", bg: "rgba(245,158,11,0.12)", title: "File Activity", desc: "Monitor file opens, copies, deletions, and transfers. Protect sensitive company data." },
              { icon: "🔒", bg: "rgba(236,72,153,0.12)", title: "Remote Lock & Shutdown", desc: "Lock or shut down any employee PC remotely from the dashboard — instantly and silently." },
            ].map((f) => (
              <div key={f.title} className="feature-card">
                <div className="fc-icon" style={{ background: f.bg }}>{f.icon}</div>
                <div className="fc-title">{f.title}</div>
                <div className="fc-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ background: "var(--bg2)" }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="section-badge">🚀 Simple Setup</div>
            <h2 className="section-title">Up and running in minutes</h2>
            <p className="section-sub" style={{ margin: "0 auto" }}>No IT expertise needed. Just sign up, install, and monitor.</p>
          </div>
          <div className="steps reveal">
            {[
              { n: "1", title: "Sign Up", desc: "Create your company account and choose a plan that fits your team size." },
              { n: "2", title: "Add Employees", desc: "Add your employees and generate their unique agent tokens from the dashboard." },
              { n: "3", title: "Install Agent", desc: "Run EmployeeMonitor.exe once as Administrator on each employee's PC. That's it." },
              { n: "4", title: "Monitor", desc: "Data flows in automatically. View screenshots, activity, and alerts in real-time." },
            ].map((s) => (
              <div key={s.n} className="step">
                <div className="step-num">{s.n}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
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
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>Perfect for small teams</div>
              <div className="plan-price">PKR 0 <span>/month</span></div>
              <div className="plan-desc">Up to 2 employees, 1 admin</div>
              <ul className="plan-features">
                {["Screenshots","Browser History","USB Monitoring","Alerts","Remote Shutdown"].map(f => (
                  <li key={f} className="has"><span className="pf-check yes">✓</span>{f}</li>
                ))}
                {["Advanced Reports","Keylogger","Live Screen","Remote Lock"].map(f => (
                  <li key={f}><span className="pf-check no">✕</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn outline">Get Started Free</Link>
            </div>
            {/* Standard */}
            <div className="plan-card popular">
              <div className="popular-badge">Most Popular</div>
              <div className="plan-name">Standard</div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>For growing businesses</div>
              <div className="plan-price">PKR 5,000 <span>/month</span></div>
              <div className="plan-desc">Unlimited employees, multiple admins</div>
              <ul className="plan-features">
                {["Screenshots","Browser History","USB Monitoring","Alerts","Remote Shutdown","Advanced Reports","Keylogger","File Activity","Print Logs"].map(f => (
                  <li key={f} className="has"><span className="pf-check yes">✓</span>{f}</li>
                ))}
                {["Live Screen","Remote Lock"].map(f => (
                  <li key={f}><span className="pf-check no">✕</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn primary">Get Started →</Link>
            </div>
            {/* Premium */}
            <div className="plan-card">
              <div className="plan-name">Premium</div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>Full control & visibility</div>
              <div className="plan-price">PKR 10,000 <span>/month</span></div>
              <div className="plan-desc">Everything in Standard + Live Screen + Lock</div>
              <ul className="plan-features">
                {["All Standard Features","Live Screen Viewing","Remote Lock","Priority Support","Custom Retention","API Access"].map(f => (
                  <li key={f} className="has"><span className="pf-check yes">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="plan-btn outline">Get Started →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials-section">
        <div className="container">
          <div className="reveal" style={{ textAlign: "center" }}>
            <div className="section-badge">⭐ Reviews</div>
            <h2 className="section-title">Trusted by businesses</h2>
          </div>
          <div className="testimonials-grid reveal">
            {[
              { text: '"MonitorHub gave us complete visibility into our remote team. Setup took 10 minutes and the data started flowing immediately. Absolutely worth it."', name: "Ahmed Khan", role: "CEO, TechSolutions PK", initials: "AK", bg: "#6c63ff", color: "white" },
              { text: '"The site blocking feature alone saved us hours of lost productivity. The dashboard is clean and the alerts are spot on. Highly recommend."', name: "Sara Rehman", role: "HR Manager, DigitalCo", initials: "SR", bg: "#4ade80", color: "#000" },
              { text: '"We tried other tools but none matched MonitorHub\'s simplicity. One install and everything works — screenshots, keylogger, live screen. Perfect."', name: "Usman Farooq", role: "IT Director, MediaGroup", initials: "UF", bg: "#f59e0b", color: "#000" },
            ].map((t) => (
              <div key={t.name} className="testimonial">
                <div className="t-stars">★★★★★</div>
                <div className="t-text">{t.text}</div>
                <div className="t-author">
                  <div className="t-avatar" style={{ background: t.bg, color: t.color }}>{t.initials}</div>
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

      {/* CTA */}
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

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
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
              <li><a href="http://app.monitorhub.live">Dashboard</a></li>
              <li><a href="http://portal.monitorhub.live">Company Portal</a></li>
              <li><a href="http://admin.monitorhub.live">Master Admin</a></li>
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
