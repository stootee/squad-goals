// src/components/SquadsPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@components/AppLayout";
import "./../styles/global.css";

interface Squad {
  id: string;
  name: string;
  admin: string;
  is_admin: boolean;
  members: number;
}

interface Invite {
  id: string;
  squad: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
}

const SquadsPage: React.FC = () => {
  // Use optional chaining for safer access to window.APP_CONFIG
  const apiURL = window.APP_CONFIG?.API_URL || "/api";
  const navigate = useNavigate();

  const [squads, setSquads] = useState<Squad[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newSquadName, setNewSquadName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Load squads and invites
  const loadInvites = async () => {
    try {
      const res = await fetch(`${apiURL}/invites`, { credentials: "include" });
      const data = await res.json();
      setInvites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSquads = async () => {
    try {
      const res = await fetch(`${apiURL}/squads`, { credentials: "include" });
      const data = await res.json();
      setSquads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  // Create new squad
  const createSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim()) return;

    try {
      const res = await fetch(`${apiURL}/squads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newSquadName }),
      });

      const data = await res.json();
      if (!res.ok) console.error(data.message);
      
      if (res.ok) {
        setNewSquadName("");
        loadSquads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Respond to squad invite
  const respondInvite = async (inviteId: string, response: "accept" | "decline") => {
    try {
      const res = await fetch(`${apiURL}/invites/${inviteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response }),
      });

      // Using console.error for non-breaking error reports
      if (!res.ok) {
        const data = await res.json();
        console.error(data.message || "Failed to respond");
        return;
      }

      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        if (response === "accept") loadSquads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInvites();
    loadSquads();
    const interval = setInterval(loadInvites, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout title="Squads">
      {/* Create New Squad Dialog */}
      <div style={{ marginBottom: "1em" }}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="submit-btn"
          style={{ marginBottom: "0.5em" }}
        >
          {menuOpen ? "Cancel" : "Create New Squad"}
        </button>

        {menuOpen && (
          <form onSubmit={createSquad} className="form-inline" style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Squad name"
              value={newSquadName}
              onChange={(e) => setNewSquadName(e.target.value)}
              required
              style={{ flexGrow: 1, maxWidth: '300px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <button type="submit" className="submit-btn" style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: '#3f51b5', color: 'white' }}>
              Create
            </button>
          </form>
        )}
      </div>

      {/* Content Grid */}
      <div className="container grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Pending Invites */}
        {invites.map((invite) => (
          <div key={invite.id} className="glass-card" style={{ padding: '15px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2em' }}>{invite.squad}</h3>
            <span style={{ fontSize: '0.9em', color: '#666' }}>Invited by {invite.invited_by}</span>
            {invite.status === "pending" && (
              // FIX: Ensures equal size (flex: 1) and color-coding (red/green) for buttons
              <div 
                className="form-inline" 
                style={{ 
                  marginTop: "15px", 
                  display: 'flex', 
                  gap: '10px' // Space between buttons
                }}
              >
                <button
                  onClick={() => respondInvite(invite.id, "accept")}
                  className="success-btn"
                >
                  Accept
                </button>
                <button
                  onClick={() => respondInvite(invite.id, "decline")}
                  className="danger-btn"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Squads */}
        {squads.map((squad) => (
          <div
            key={squad.id}
            className="glass-card"
            onClick={() => navigate(`/squads/${squad.id}/submit`)}
            style={{ 
              padding: '15px', 
              borderRadius: '8px', 
              border: '1px solid #3f51b5', 
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s'
            }}
          >
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2em', color: '#3f51b5' }}>{squad.name}</h3>
            <span className="text-break" style={{ display: 'block', margin: '5px 0' }}>
              <b>Admin:</b> {squad.admin}
            </span>
            <span className="text-break" style={{ display: 'block' }}>
              <b>Members:</b> {squad.members ?? 1}
            </span>
          </div>
        ))}
      </div>
    </AppLayout>

  );
};

export default SquadsPage;