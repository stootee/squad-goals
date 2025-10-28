// src/App.tsx
import React from "react";
import { Routes, Route, useParams } from "react-router-dom";
import ProfilePage from "@pages/ProfilePage";
import SquadsPage from "@pages/SquadsPage";
import HomePage from "@pages/HomePage";
import SquadLayout from "@pages/SquadLayout";
import SquadDailyOverviewPage from "@pages/SquadGoalsOverviewPage";
import ErrorBoundary from "@components/ErrorBoundary";

const SquadLayoutWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return <p>Squad ID not found.</p>; // or navigate to error page

  return <SquadLayout squadId={id} />;
};

const App: React.FC = () => (
  <ErrorBoundary>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/squads" element={<SquadsPage />} />
      <Route path="/squads/:id/daily" element={<SquadDailyOverviewPage squadId={useParams().id!} />} />
      <Route path="/squads/:id/*" element={<SquadLayoutWrapper />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  </ErrorBoundary>
);

export default App;

