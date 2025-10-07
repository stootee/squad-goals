import React, { useEffect, useState } from "react";

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

const SquadDailyOverviewPage: React.FC<SquadDailyOverviewPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay(); // Sunday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7)); // current week Monday
    return monday.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const monday = new Date(startDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // current week Sunday
    return sunday.toISOString().split("T")[0];
  });

  const apiURL = window.APP_CONFIG.API_URL;

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
      if (res.ok) setGoals(await res.json());
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
      console.error(err);
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

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const copy = new Set(prev);
      copy.has(userId) ? copy.delete(userId) : copy.add(userId);
      return copy;
    });
  };

  if (loading) return <p>Loading squad data...</p>;

  return (
    <div style={{ padding: "2em", background: "#f9f9f9", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: "2em", borderRadius: 8 }}>
        <h1 style={{ color: "#007bff", marginTop: 0 }}>Squad Progress Overview</h1>

        <div style={{ marginBottom: "1em" }}>
          <label style={{ marginRight: "0.5em" }}>Start Date:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label style={{ margin: "0 0.5em" }}>End Date:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#007bff", color: "#fff" }}>
              <th style={{ padding: "0.5em", border: "1px solid #ddd", width: "40px" }}></th>
              <th style={{ padding: "0.5em", border: "1px solid #ddd" }}>User</th>
              {goals.map((goal) => (
                <th key={goal.id} style={{ padding: "0.5em", border: "1px solid #ddd" }}>{goal.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {userEntries.map((user) => {
              const summed: Record<string, number> = {};
              Object.values(user.entries).forEach((dayEntries) => {
                dayEntries.forEach((entry) => {
                  summed[entry.goal_id] = (summed[entry.goal_id] || 0) + entry.value;
                });
              });

              return (
                <React.Fragment key={user.user_id}>
                  <tr>
                    <td style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center", width: "40px" }}>
                      <button
                        onClick={() => toggleExpand(user.user_id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontSize: "1em",
                        }}
                      >
                        {expandedUsers.has(user.user_id) ? "−" : "+"}
                      </button>
                    </td>
                    <td style={{ padding: "0.5em", border: "1px solid #ddd", fontWeight: "bold" }}>{user.username}</td>
                    {goals.map((goal) => (
                      <td key={goal.id} style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center" }}>
                        {summed[goal.id] ?? 0}
                      </td>
                    ))}
                  </tr>

                  {expandedUsers.has(user.user_id) &&
                    Object.keys(user.entries)
                      .sort()
                      .map((date) => (
                        <tr key={date} style={{ background: "#f9f9f9" }}>
                          <td /> {/* empty cell for button column */}
                          <td style={{ padding: "0.5em 1em", border: "1px solid #ddd" }}>{date}</td>
                          {goals.map((goal) => {
                            const dayEntry = user.entries[date].find((e) => e.goal_id === goal.id);
                            return (
                              <td key={goal.id} style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center" }}>
                                {dayEntry ? dayEntry.value : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SquadDailyOverviewPage;
