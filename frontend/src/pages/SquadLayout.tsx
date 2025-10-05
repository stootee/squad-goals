// src/components/SquadLayout.tsx
import React, { useState } from "react";
import SquadGoalSubmissionPage from "@pages/SquadGoalSubmissionPage";
import SquadDetailPage from "@pages/SquadDetailPage";
import SquadDailyOverviewPage from "./SquadGoalsOverviewPage";

interface SquadLayoutProps {
  squadId: string;
}

const SquadLayout: React.FC<SquadLayoutProps> = ({ squadId }) => {
  const [activeTab, setActiveTab] = useState<"submission" | "squad" | "details">("submission");

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", background: "#f9f9f9" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2em" }}>
        <nav style={{ marginBottom: "2em", display: "flex", gap: "1em" }}>
          <button 
            style={{ padding: "0.5em 1em", background: activeTab === "submission" ? "#007bff" : "#e0e0e0", color: activeTab === "submission" ? "#fff" : "#000", border: "none", borderRadius: 4 }}
            onClick={() => setActiveTab("submission")}
          >
            Daily Submission
          </button>
          <button 
            style={{ padding: "0.5em 1em", background: activeTab === "squad" ? "#007bff" : "#e0e0e0", color: activeTab === "squad" ? "#fff" : "#000", border: "none", borderRadius: 4 }}
            onClick={() => setActiveTab("squad")}
          >
            Squad Stats
          </button>
          <button 
            style={{ padding: "0.5em 1em", background: activeTab === "details" ? "#007bff" : "#e0e0e0", color: activeTab === "details" ? "#fff" : "#000", border: "none", borderRadius: 4 }}
            onClick={() => setActiveTab("details")}
          >
            Squad Details
          </button>
        </nav>

        {activeTab === "submission" && <SquadGoalSubmissionPage squadId={squadId} />}
        {activeTab === "details" && <SquadDetailPage squadId={squadId} />}
        {activeTab === "squad" && <SquadDailyOverviewPage squadId={squadId} />}
      </div>
    </div>
  );
};

export default SquadLayout;
