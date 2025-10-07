// src/components/AppLayout.tsx
import React, { useState } from "react";

interface AppLayoutProps {
  title?: string;
  children: React.ReactNode;
  showMenu?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({ title = "Squagol", children, showMenu = true }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    const apiURL = window.APP_CONFIG.API_URL;
    try {
      const response = await fetch(`${apiURL}/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        window.location.href = "/login.html";
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const glassStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.25)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e5e5e5 0%, #bdbdbd 100%)",
        color: "#222",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          ...glassStyle,
          margin: "1em",
          padding: "1em 1.5em",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4em" }}>{title}</h1>
        {showMenu && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "transparent",
              border: "none",
              color: "#333",
              fontSize: "1.6em",
              cursor: "pointer",
            }}
          >
            ☰
          </button>
        )}
      </header>

      {/* Dropdown Menu */}
      {menuOpen && (
        <nav
          style={{
            ...glassStyle,
            margin: "0 1em 1em",
            padding: "1em",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li>
              <button onClick={() => (window.location.href = "/profile")} style={menuBtnStyle}>
                Profile
              </button>
            </li>
            <li>
              <button onClick={() => (window.location.href = "/squads")} style={menuBtnStyle}>
                Squads
              </button>
            </li>
            <li>
              <button onClick={handleLogout} style={{ ...menuBtnStyle, color: "#a00" }}>
                Logout
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Main content */}
      <main style={{ flex: 1, padding: "1em 1.5em", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {children}
      </main>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

const menuBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: "none",
  textAlign: "left",
  fontSize: "1em",
  padding: "0.5em 0",
  cursor: "pointer",
  color: "#222",
};

export default AppLayout;
