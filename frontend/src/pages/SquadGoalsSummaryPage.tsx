import React, { useEffect, useState, useMemo } from "react";
import "./../styles/global.css";

interface Goal {
  id: string;
  name: string;
  type: string;
  target: number;
}

interface Entry {
  goal_id: string;
  date: string;
  value: number;
}

interface SquadGoalSummaryProps {
  squadId: string;
}

const SquadGoalSummary: React.FC<SquadGoalSummaryProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

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

  // Fetch goals + entries
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [goalsRes, entriesRes] = await Promise.all([
          fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" }),
          fetch(`${apiURL}/squads/${squadId}/goals/entries`, { credentials: "include" }),
        ]);

        if (!goalsRes.ok || !entriesRes.ok) throw new Error("Failed to load summary data");

        setGoals(await goalsRes.json());
        setEntries(await entriesRes.json());
      } catch (err) {
        console.error(err);
        setMessage("Error loading summary data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [squadId]);

  const getGoalProgress = (goalId: string, date: string) => {
    const entry = entries.find((e) => e.goal_id === goalId && e.date === date);
    return entry ? entry.value : "";
  };

  const getGoalTotal = (goalId: string) => {
    return entries
      .filter((e) => e.goal_id === goalId)
      .reduce((sum, e) => sum + e.value, 0);
  };

  if (loading) return <p>Loading summary...</p>;

  if (goals.length === 0)
    return (
      <div className="container">
        <div className="glass-card">
          <h1>Squad Summary</h1>
          <p>No goals have been configured for this squad yet.</p>
        </div>
      </div>
    );

  return (
    <div className="container">
      <div className="glass-card" style={{ overflowX: "auto" }}>
        <h1>Weekly Summary</h1>
        {message && <p style={{ color: "red" }}>{message}</p>}
        <table className="squad-table" style={{ minWidth: "600px", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Goal</th>
              {lastSevenDays.map((d) => (
                <th key={d} style={{ padding: "0.5em", border: "1px solid #ddd" }}>
                  {new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                </th>
              ))}
              <th>Total</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => {
              const total = getGoalTotal(goal.id);
              const success = total >= goal.target;
              return (
                <tr key={goal.id}>
                  <td style={{ fontWeight: "bold", border: "1px solid #ddd", padding: "0.5em" }}>
                    {goal.name} ({goal.type})
                  </td>
                  {lastSevenDays.map((d) => (
                    <td
                      key={d}
                      style={{
                        border: "1px solid #ddd",
                        textAlign: "center",
                        padding: "0.5em",
                      }}
                    >
                      {getGoalProgress(goal.id, d)}
                    </td>
                  ))}
                  <td
                    style={{
                      border: "1px solid #ddd",
                      textAlign: "center",
                      fontWeight: "bold",
                      color: success ? "green" : "red",
                    }}
                  >
                    {total}
                  </td>
                  <td style={{ border: "1px solid #ddd", textAlign: "center" }}>{goal.target}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SquadGoalSummary;
