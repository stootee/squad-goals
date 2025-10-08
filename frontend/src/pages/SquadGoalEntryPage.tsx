import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";

interface Goal {
  id: string;
  name: string;
  type: string;
  target: number;
}

interface Entry {
  goal_id: string;
  value: number;
}

interface SquadGoalEntryPageProps {
  squadId: string;
}

const SquadGoalEntryPage: React.FC<SquadGoalEntryPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [values, setValues] = useState<{ [goalId: string]: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const navigate = useNavigate();
  const apiURL = window.APP_CONFIG.API_URL;

  // ==========================
  // Fetch Goals once
  // ==========================
  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
        const data: Goal[] = await res.json();
        setGoals(data);
      } catch {
        setMessage("Error loading goals");
      }
    };
    fetchGoals();
  }, [squadId]);

  // ==========================
  // Fetch entries when date changes
  // ==========================
  useEffect(() => {
    if (goals.length === 0) return;

    const fetchEntries = async () => {
      setLoading(true);
      setValues({}); // clear while loading
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry?date=${currentDate}`, {
          credentials: "include",
        });
        const entriesData: Entry[] = await res.json();

        const prefilledValues: { [goalId: string]: string } = {};
        goals.forEach((goal) => {
          const entry = entriesData.find((e) => e.goal_id === goal.id);
          prefilledValues[goal.id] = entry ? entry.value.toString() : "";
        });
        setValues(prefilledValues);
        setMessage(null);
      } catch (err) {
        console.error(err);
        setMessage("Error fetching entries for this date");
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [currentDate, goals, squadId]);

  // ==========================
  // Handlers
  // ==========================
  const handleChange = (goalId: string, val: string) => {
    setValues((prev) => ({ ...prev, [goalId]: val }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: currentDate, values }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Entries saved ✅");
    } catch {
      setMessage("Error saving entries");
    }
  };

  const changeDate = (delta: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  // ==========================
  // Render
  // ==========================
  if (loading) return <p>Loading...</p>;

  return (
    <div className="container">
      <div className="glass-card" style={{ maxWidth: "480px", margin: "0 auto" }}>
        {/* Date Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1em" }}>
          <button className="submit-btn" onClick={() => changeDate(-1)}>◀ Previous</button>
          <span style={{ fontWeight: "bold" }}>
            {new Date(currentDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <button className="submit-btn" onClick={() => changeDate(1)}>Next ▶</button>
        </div>

        {goals.length === 0 && <p>No goals configured.</p>}

        {goals.map((goal) => (
          <div
            key={goal.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75em",
              gap: "0.5em",
            }}
          >
            <label style={{ fontWeight: "bold", flex: 1 }}>
              {goal.name} ({goal.type})
            </label>
            <input
              type="number"
              value={values[goal.id] ?? ""}
              onChange={(e) => handleChange(goal.id, e.target.value)}
              placeholder="Enter value"
              className="input"
              style={{
                width: "100%",
                maxWidth: "150px",
                textAlign: "center",
                padding: "0.25em 0.5em",
              }}
            />
          </div>
        ))}

        {message && (
          <p style={{ color: message.includes("✅") ? "green" : "red", fontWeight: "bold" }}>
            {message}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5em" }}>
          <button className="submit-btn" onClick={handleSave}>Save</button>
          <button className="submit-btn" onClick={() => navigate(`/squads/${squadId}/summary`)}>
            View Summary
          </button>
        </div>
      </div>
    </div>
  );
};

export default SquadGoalEntryPage;
