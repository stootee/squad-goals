import React, { useEffect, useState } from "react";
import "./../styles/global.css";

// ==========================
// Interfaces
// ==========================
interface Entry {
  goal_id: string;
  value: number;
  date: string;
}

interface UserEntryGroup {
  user_id: string;
  username: string;
  entries: Record<string, Entry[]>; // date -> entries
}

interface Goal {
  id: string;
  name: string;
}

interface SquadDailyOverviewPageProps {
  squadId: string;
}

// ==========================
// Main Component
// ==========================
const SquadDailyOverviewPage: React.FC<SquadDailyOverviewPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [startDate, setStartDate] = useState<string>(() => getCurrentWeekMonday());
  const [endDate, setEndDate] = useState<string>(() => getCurrentWeekSunday(getCurrentWeekMonday()));

  const apiURL = window.APP_CONFIG.API_URL;

  // ==========================
  // Helpers for week dates
  // ==========================
  function getCurrentWeekMonday(): string {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    return monday.toISOString().split("T")[0];
  }

  function getCurrentWeekSunday(monday: string): string {
    const date = new Date(monday);
    date.setDate(date.getDate() + 6);
    return date.toISOString().split("T")[0];
  }

  // ==========================
  // API Calls
  // ==========================
  const fetchGoals = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
      if (res.ok) {
        setGoals(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch goals", err);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/squads/${squadId}/goals/entries/day?start_date=${startDate}&end_date=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load entries");
      const data: UserEntryGroup[] = await res.json();
      setUserEntries(data);
    } catch (err) {
      console.error("Failed to fetch entries", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [squadId]);

  useEffect(() => {
    fetchEntries();
  }, [squadId, startDate, endDate]);

  // ==========================
  // UI Logic
  // ==========================
  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const updated = new Set(prev);
      updated.has(userId) ? updated.delete(userId) : updated.add(userId);
      return updated;
    });
  };

  const renderUserRows = (user: UserEntryGroup) => {
    // Calculate total per goal
    const summed: Record<string, number> = {};
    Object.values(user.entries).forEach((dayEntries) => {
      dayEntries.forEach((entry) => {
        summed[entry.goal_id] = (summed[entry.goal_id] || 0) + entry.value;
      });
    });

    return (
      <React.Fragment key={user.user_id}>
        {/* Summary Row */}
        <tr>
          <td className="expand-btn-cell">
            <button className="expand-btn" onClick={() => toggleExpand(user.user_id)}>
              {expandedUsers.has(user.user_id) ? "−" : "+"}
            </button>
          </td>
          <td className="user-name-cell">{user.username}</td>
          {goals.map((goal) => (
            <td key={goal.id} className="goal-value-cell">
              {summed[goal.id] ?? 0}
            </td>
          ))}
        </tr>

        {/* Expanded Detail Rows */}
        {expandedUsers.has(user.user_id) &&
          Object.keys(user.entries)
            .sort()
            .map((date) => (
              <tr key={date} className="detail-row">
                <td />
                <td className="date-cell">{date}</td>
                {goals.map((goal) => {
                  const dayEntry = user.entries[date].find((e) => e.goal_id === goal.id);
                  return (
                    <td key={goal.id} className="goal-value-cell">
                      {dayEntry ? dayEntry.value : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
      </React.Fragment>
    );
  };

  // ==========================
  // Render
  // ==========================
  if (loading) return <p>Loading squad data...</p>;

  return (
    <div className="container">
      <div className="glass-card">
        <h1>Squad Progress Overview</h1>

        {/* Date Filters */}
        <div className="date-filters">
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <table className="squad-table">
            <thead>
              <tr>
                <th />
                <th>User</th>
                {goals.map((goal) => (
                  <th key={goal.id}>{goal.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>{userEntries.map(renderUserRows)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SquadDailyOverviewPage;
