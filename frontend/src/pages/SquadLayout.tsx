import React, { useEffect, useState } from "react";
import SquadGoalSubmissionPage from "@pages/SquadGoalSubmissionPage";
import SquadMembersPage from "@pages/SquadMembersPage";
import SquadDailyOverviewPage from "@pages/SquadGoalsOverviewPage";
import SquadGoalsManagerPage from "@pages/SquadGoalsManagerPage";
import SquadGoalEntryPage from "@pages/SquadGoalEntryPage";
import AppLayout from "@components/AppLayout";
import "@styles/global.css";

type SquadTabKey = "today" | "submission" | "progress" | "members" | "goals";

interface SquadLayoutProps {
  squadId: string;
}

const SquadLayout: React.FC<SquadLayoutProps> = ({ squadId }) => {
  const apiURL = window.APP_CONFIG.API_URL;

  // Load the active tab from localStorage on initial render
  const [activeTab, setActiveTab] = useState<SquadTabKey>(() => {
    const savedTab = localStorage.getItem(`squad-${squadId}-activeTab`);
    return (savedTab as SquadTabKey) || "today";
  });

  const [squadName, setSquadName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Fetch squad information including name and admin status
  useEffect(() => {
    const fetchSquadName = async () => {
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}`, { credentials: "include" });
        const data = await res.json();
        setSquadName(data.name || "Squad");

        if (data.is_admin !== undefined) {
          setIsAdmin(data.is_admin);
        } else if (data.admin_id && data.admin_id === data.current_user_id) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error fetching squad info:", err);
        setSquadName("Squad");
        setIsAdmin(false);
      }
    };
    fetchSquadName();
  }, [squadId, apiURL]);

  const tabs = [
    { key: "today" as SquadTabKey, label: "Today" },
    { key: "submission" as SquadTabKey, label: "Recent History" },
    { key: "progress" as SquadTabKey, label: "Squad Progress" },
    { key: "members" as SquadTabKey, label: "Members" },
    { key: "goals" as SquadTabKey, label: "Goals" },
  ];

  // Update active tab and persist it in localStorage
  const handleTabChange = (key: SquadTabKey) => {
    setActiveTab(key);
    localStorage.setItem(`squad-${squadId}-activeTab`, key);
  };

  return (
    <AppLayout title={squadName}>
      <nav className="tabs" aria-label="Squad Views" role="tablist">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`nav-btn ${activeTab === key ? "active" : ""}`}
            onClick={() => handleTabChange(key)}
            role="tab"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Main content area for the selected tab */}
      <div className="glass-card" role="tabpanel">
        {activeTab === "today" && <SquadGoalEntryPage squadId={squadId} />}
        {activeTab === "submission" && <SquadGoalSubmissionPage squadId={squadId} />}
        {activeTab === "members" && <SquadMembersPage squadId={squadId} />}
        {activeTab === "progress" && <SquadDailyOverviewPage squadId={squadId} />}
        {activeTab === "goals" && <SquadGoalsManagerPage squadId={squadId} isAdmin={isAdmin} />}
      </div>
    </AppLayout>
  );
};

export default SquadLayout;
