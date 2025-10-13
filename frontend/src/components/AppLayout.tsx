import React from "react";
import { useNavigate } from "react-router-dom";
import "@styles/global.css";

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
    // Assuming window.APP_CONFIG is correctly defined globally
    const apiURL = window.APP_CONFIG.API_URL; 
    try {
      const response = await fetch(`${apiURL}/logout`, {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Clear any local storage/session data if necessary
        navigate("/login");
      } else {
        // Handle non-200 responses if needed
        console.warn("Logout failed with status:", response.status);
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };
  
  // Navigate to home on title click
  const handleTitleClick = () => navigate("/");

  return (
    <div className="app-layout">
      <header className="app-header">
        {/* Use a specific wrapper for the content that needs to be 
          organized within the responsive header. 
          The CSS will handle stacking (mobile) vs. side-by-side (desktop).
        */}
        <div className="header-content"> 
          <div className="header-title" onClick={handleTitleClick} role="button" tabIndex={0} onKeyDown={(e) => {if (e.key === 'Enter') handleTitleClick();}}>
            <h1>{title}</h1>
          </div>

          {showMenu && (
            <nav className="header-nav" aria-label="Main Navigation">
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
        </div>
      </header>

      <main className="app-main">
        {/* children is rendered inside the standardized content-wrapper */}
        <div className="content-wrapper">
            {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;