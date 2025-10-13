// src/pages/HomePage.tsx
import React from "react";
import "@styles/global.css";

const HomePage: React.FC = () => {
  return (
    <div className="container" style={{ padding: "2em" }}>
      <div className="glass-card" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <h1>Welcome to Squad Goals!</h1>
        <p>Track your squads, invite friends, and achieve your goals together.</p>
        <div style={{ marginTop: "1.5em" }}>
          <a
            href="/login.html"
            className="btn"
            style={{ backgroundColor: "#007bff", color: "#fff", padding: "0.75em 1.5em", borderRadius: 6, textDecoration: "none", fontSize: "1em" }}
          >
            Log In
          </a>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
