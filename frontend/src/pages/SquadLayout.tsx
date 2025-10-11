import React, { useEffect, useState } from "react";
import SquadGoalSubmissionPage from "@pages/SquadGoalSubmissionPage";
import SquadMembersPage from "@pages/SquadMembersPage";
import SquadDailyOverviewPage from "@pages/SquadGoalsOverviewPage";
import SquadGoalsManagerPage from "@pages/SquadGoalsManangerPage";
import SquadGoalEntryPage from "@pages/SquadGoalEntryPage";
import AppLayout from "@components/AppLayout";
import "./../styles/global.css";

interface SquadLayoutProps {
  squadId: string;
}

const SquadLayout: React.FC<SquadLayoutProps> = ({ squadId }) => {
  const [activeTab, setActiveTab] = useState<"today" | "submission" | "progress" | "members" | "goals">("submission");
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
      const res = await fetch(`${apiURL}/logout`, { method: "POST", credentials: "include" });
      if (res.ok) window.location.href = "/login.html";
      else console.error("Logout failed");
    } catch (err) {
      console.error("Error during logout:", err);
    }
  };

  const tabs = [
    { key: "today", label: "Today" },
    { key: "submission", label: "My Stats" },
    { key: "progress", label: "Progress" },
    { key: "members", label: "Members" },
    { key: "goals", label: "Goals" },
  ];

  return (
    <AppLayout title={squadName}>
    <div className="container">

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(({ key, label }) => (
          <div
            key={key}
            className={`nav-btn ${activeTab === key ? "active" : ""}`}
            onClick={() => setActiveTab(key as any)}
          >
            {label}
          </div>
        ))}
      </div>


      {/* Main Content */}
      <div className="glass-card">
        {activeTab === "today" && <SquadGoalEntryPage squadId={squadId} />}
        {activeTab === "submission" && <SquadGoalSubmissionPage squadId={squadId} />}
        {activeTab === "members" && <SquadMembersPage squadId={squadId} />}
        {activeTab === "progress" && <SquadDailyOverviewPage squadId={squadId} />}
        {activeTab === "goals" && <SquadGoalsManagerPage squadId={squadId} />}
      </div>
    </div>
    </AppLayout>
  );
};

export default SquadLayout;
