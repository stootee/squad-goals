// src/pages/SquadGoalsManagerPage.tsx
import React from "react";
import SquadGoalsManager from "@components/SquadGoalsManager";

interface SquadGoalsManagerPageProps {
  squadId: string;
}

const SquadGoalsManagerPage: React.FC<SquadGoalsManagerPageProps> = ({ squadId }) => {
  return (
    <div style={{ padding: "2em" }}>
      <h1 style={{ color: "#007bff" }}>Manage Squad Goals</h1>
      <SquadGoalsManager squadId={squadId} />
    </div>
  );
};

export default SquadGoalsManagerPage;
