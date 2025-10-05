// src/pages/HomePage.tsx
import React from "react";
import { Link } from "react-router-dom";

const HomePage: React.FC = () => {
  return (
    <div style={{ padding: "2em", fontFamily: "sans-serif" }}>
      <h1>Welcome to Squad Goals!</h1>
      <p>Track your squads, invite friends, and achieve your goals together.</p>
      <div style={{ marginTop: "1em" }}>
        <a href="/login.html" style={{ color: "#007bff", textDecoration: "none", fontSize: "1.25em" }}>
            Log In
        </a>
      </div>
    </div>
  );
};

export default HomePage;
