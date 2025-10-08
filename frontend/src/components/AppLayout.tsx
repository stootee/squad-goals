import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";

interface AppLayoutProps {
  title?: string;
  children: React.ReactNode;
  showMenu?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  title = "Squagol",
  children,
  showMenu = true,
}) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const apiURL = window.APP_CONFIG.API_URL;
    try {
      const response = await fetch(`${apiURL}/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-left" onClick={() => navigate("/")}>
          <h1>{title}</h1>
        </div>

        {showMenu && (
          <nav className="header-nav">
            <button className="nav-link" onClick={() => navigate("/squads")}>
              Squads
            </button>
            <button className="nav-link" onClick={() => navigate("/profile")}>
              Profile
            </button>
            <button className="nav-link logout" onClick={handleLogout}>
              Logout
            </button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="content-wrapper">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
