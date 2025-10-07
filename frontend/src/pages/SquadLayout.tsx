import React, { useEffect, useState } from "react";
import SquadGoalSubmissionPage from "@pages/SquadGoalSubmissionPage";
import SquadMembersPage from "@pages/SquadMembersPage";
import SquadDailyOverviewPage from "@pages/SquadGoalsOverviewPage";
import SquadGoalsManagerPage from "@pages/SquadGoalsManangerPage";
import "./../styles/global.css";

interface SquadLayoutProps {
  squadId: string;
}

const SquadLayout: React.FC<SquadLayoutProps> = ({ squadId }) => {
  const [activeTab, setActiveTab] = useState<"submission" | "progress" | "members" | "goals">("submission");
  const [menuOpen, setMenuOpen] = useState(false);
  const [squadName, setSquadName] = useState<string>("");

  const apiURL = window.APP_CONFIG.API_URL;

  useEffect(() => {
    const fetchSquadName = async () => {
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSquadName(data.name || "Squad");
        } else {
          setSquadName("Squad");
        }
      } catch (err) {
        console.error("Error fetching squad name:", err);
        setSquadName("Squad");
      }
    };
    fetchSquadName();
  }, [squadId]);

  const handleLogout = async () => {
    try {
      const response = await fetch(`${apiURL}/logout`, { method: "POST", credentials: "include" });
      if (response.ok) window.location.href = "/login.html";
      else console.error("Logout failed");
    } catch (err) {
      console.error("Error during logout:", err);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="glass-card header">
        <h1>{squadName}</h1>
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="glass-card dropdown">
          <ul>
            {[
              { label: "Profile", action: () => (window.location.href = "/profile") },
              { label: "Squads", action: () => (window.location.href = "/squads") },
              { label: "Logout", action: handleLogout, color: "#a00" },
            ].map((item, i) => (
              <li key={i}>
                <button className="dropdown-btn" style={{ color: item.color || undefined }} onClick={item.action}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: "submission", label: "My Stats" },
          { key: "progress", label: "Progress" },
          { key: "members", label: "Members" },
          { key: "goals", label: "Goals" },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? "active" : ""}`}
            onClick={() => setActiveTab(key as any)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="glass-card content">
        {activeTab === "submission" && <SquadGoalSubmissionPage squadId={squadId} />}
        {activeTab === "members" && <SquadMembersPage squadId={squadId} />}
        {activeTab === "progress" && <SquadDailyOverviewPage squadId={squadId} />}
        {activeTab === "goals" && <SquadGoalsManagerPage squadId={squadId} />}
      </div>
    </div>
  );
};

export default SquadLayout;
