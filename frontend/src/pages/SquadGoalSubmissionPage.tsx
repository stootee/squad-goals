// src/pages/SquadGoalSubmissionPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import "./../styles/global.css";

interface Goal {
  id: string;
  name: string;
  type: string;
  target: number;
}

interface UserEntries {
  [goalId: string]: { [date: string]: number };
}

interface SquadGoalSubmissionPageProps {
  squadId: string;
}

const inputStyle: React.CSSProperties = {
  width: "60px", // restrict width
  padding: "0.25em",
  borderRadius: 4,
  border: "1px solid #ccc",
  textAlign: "center",
};

const SquadGoalSubmissionPage: React.FC<SquadGoalSubmissionPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntries>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");

  const apiURL = window.APP_CONFIG.API_URL;

  const lastSevenDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - 6 + i);
        return d.toISOString().split("T")[0];
      }),
    []
  );

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${apiURL}/user_info`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCurrentUsername(data.username);
        }
      } catch (err) {
        console.error("Failed to fetch current user", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch goals
  const fetchGoals = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load squad goals");
      setGoals(await res.json());
    } catch (err) {
      console.error(err);
      setMessage("Error loading squad goals");
    }
  };

  // Fetch user entries
  const fetchUserEntries = async () => {
    if (!currentUsername) return;

    try {
      const startDate = lastSevenDays[0];
      const res = await fetch(
        `${apiURL}/squads/${squadId}/goals/entries?start_date=${startDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load entries");
      const entriesArray = await res.json();
      const entries: UserEntries = {};
      entriesArray.forEach((entry: any) => {
        if (!entries[entry.goal_id]) entries[entry.goal_id] = {};
        entries[entry.goal_id][entry.date] = entry.value;
      });
      setUserEntries(entries);
    } catch (err) {
      console.error(err);
      setMessage("Error loading your entries");
    }
  };

  useEffect(() => {
    if (!currentUsername) return;

    const fetchData = async () => {
      setLoading(true);
      await fetchGoals();
      await fetchUserEntries();
      setLoading(false);
    };
    fetchData();
  }, [squadId, lastSevenDays, currentUsername]);

  const handleCellChange = async (goalId: string, date: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    setUserEntries((prev) => ({
      ...prev,
      [goalId]: { ...prev[goalId], [date]: numValue },
    }));

    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, values: { [goalId]: numValue } }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.message || "Failed to save entry");
      } else {
        setMessage("Entry saved ✅");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error saving entry");
    }
  };

  if (loading) return <p>Loading your squad data...</p>;

  if (goals.length === 0) {
    return (
      <div className="container">
        <div className="glass-card">
          <h1>Goal Submission</h1>
          <p>The admin has not yet configured any goals for this squad. Progress tracking is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="glass-card" style={{ overflowX: "auto" }}>
        <h1>Daily Progress</h1>
        {message && (
          <p style={{ color: message.includes("✅") ? "green" : "red", fontWeight: "bold" }}>
            {message}
          </p>
        )}
        <table className="squad-table" style={{ borderCollapse: "collapse", minWidth: "600px" }}>
          <thead>
            <tr>
              <th>Goal</th>
              {lastSevenDays.map((d) => (
                <th key={d} style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center" }}>
                  {new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map((goal, rowIndex) => (
              <tr key={goal.id}>
                <td style={{ padding: "0.5em", border: "1px solid #ddd", fontWeight: "bold" }}>
                  {goal.name} ({goal.type})
                </td>
                {lastSevenDays.map((d, colIndex) => {
                  // Compute tabIndex so it goes column by column
                  const tabIndex = colIndex * goals.length + rowIndex + 1;
                  return (
                    <td key={d} style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center" }}>
                      <input
                        type="text"
                        min="0"
                        step="any"
                        value={userEntries[goal.id]?.[d] ?? ""}
                        onChange={(e) => handleCellChange(goal.id, d, e.target.value)}
                        style={inputStyle}
                        tabIndex={tabIndex}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
};

export default SquadGoalSubmissionPage;
