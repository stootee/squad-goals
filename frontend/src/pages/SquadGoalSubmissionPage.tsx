import React, { useEffect, useState, useMemo } from "react";

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

const SquadGoalSubmissionPage: React.FC<SquadGoalSubmissionPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntries>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");

  const apiURL = import.meta.env.VITE_API_URL;

  const lastSevenDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return d.toISOString().split("T")[0];
    });
  }, []);

  // Fetch logged-in user
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
      const data: Goal[] = await res.json();
      setGoals(data);
    } catch (err) {
      console.error(err);
      setMessage("Error loading squad goals");
    }
  };

  // Fetch entries for current user
  const fetchUserEntries = async () => {
    if (!currentUsername) return;

    try {
      const startDate = lastSevenDays[0];
      const res = await fetch(
        `${apiURL}/squads/${squadId}/goals/entries?start_date=${startDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load entries");
      const entriesArray = await res.json(); // [{goal_id, date, value}]
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

  // Fetch goals + entries whenever squadId, currentUsername, or lastSevenDays change
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

  // Handle cell change
  const handleCellChange = async (goalId: string, date: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    // Optimistically update state
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
      <div style={{ padding: "2em", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ color: "#007bff" }}>Goal Submission</h1>
        <p>The admin has not yet configured any goals for this squad. Progress tracking is not available.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f9f9f9", minHeight: "100vh", padding: "2em" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: "2em", borderRadius: 8, boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>
        <h1 style={{ marginTop: 0, color: "#007bff" }}>Submit Daily Progress</h1>

        {message && <p style={{ color: message.includes("✅") ? "green" : "red", fontWeight: "bold" }}>{message}</p>}

        <h2>Progress Grid (Last 7 Days)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#007bff", color: "#fff" }}>
              <th style={{ padding: "0.5em", border: "1px solid #ddd" }}>Goal</th>
              {lastSevenDays.map((d) => (
                <th key={d} style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center" }}>
                  {new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => (
              <tr key={goal.id}>
                <td style={{ padding: "0.5em", border: "1px solid #ddd", fontWeight: "bold" }}>
                  {goal.name} ({goal.type})
                </td>
                {lastSevenDays.map((d) => (
                  <td key={d} style={{ padding: "0.5em", border: "1px solid #ddd", textAlign: "center" }}>
                    <input
                      type="text"
                      min="0"
                      step="any"
                      value={userEntries[goal.id]?.[d] ?? ""}
                      onChange={(e) => handleCellChange(goal.id, d, e.target.value)}
                      style={{
                        width: "50px",
                        height: "50px",
                        textAlign: "center",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        fontSize: "1em",
                        outline: "none",
                        appearance: "none",
                        MozAppearance: "textfield",
                        WebkitAppearance: "none",
                        backgroundColor: "#f7f9fc",
                        transition: "0.2s",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#007bff")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SquadGoalSubmissionPage;
