import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/SquadGoalEntryPage.css"; 

// ====================================================
// Interfaces
// ====================================================
interface Goal {
  id: string;
  name: string;
  type: string;
  target: number;
}

interface Entry {
  goal_id: string;
  value: number | null; 
}

interface SquadGoalEntryPageProps {
  squadId: string;
}

// ====================================================
// Date Navigator Component (UPDATED)
// ====================================================
interface DateNavigatorProps {
  currentDate: string;
  changeDate: (delta: number) => void;
}

const DateNavigator: React.FC<DateNavigatorProps> = ({ currentDate, changeDate }) => {
  const formattedDate = new Date(currentDate).toLocaleDateString(undefined, { 
    weekday: "short", 
    month: "short", 
    day: "numeric" 
  });
  
  const todayString = new Date().toISOString().split("T")[0];
  const isToday = currentDate === todayString;

  return (
    <div className="date-navigator">
      <button className="nav-btn secondary-btn" onClick={() => changeDate(-1)}>
      ◀
      </button>
      <span className="date-display">{formattedDate}</span>
      <button 
        className="nav-btn secondary-btn" 
        onClick={() => changeDate(1)} 
        disabled={isToday} 
      >
        ▶
      </button>
    </div>
  );
};


// ====================================================
// Main Component
// ====================================================
const SquadGoalEntryPage: React.FC<SquadGoalEntryPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  // Values stores user input as strings
  const [values, setValues] = useState<{ [goalId: string]: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const navigate = useNavigate();
  // Ensure we check for the global config
  const apiURL = window.APP_CONFIG?.API_URL; 
  
  const apiDependencies = [squadId, apiURL];

  // ==========================
  // 1. Fetch Goals
  // ==========================
  useEffect(() => {
    if (!apiURL) return;
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
  }, apiDependencies);

  // ==========================
  // 2. Fetch Entries for selected date
  // ==========================
  useEffect(() => {
    if (goals.length === 0 || !apiURL) return;

    const fetchEntries = async () => {
      setLoading(true);
      setValues({}); 
      try {
        const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry?date=${currentDate}`, {
          credentials: "include",
        });
        
        const entriesData: Entry[] = res.ok ? await res.json() : [];

        const prefilledValues: { [goalId: string]: string } = {};
        goals.forEach((goal) => {
          const entry = entriesData.find((e) => e.goal_id === goal.id);
          
          // Robustly handle null/undefined values from the API
          const value = entry?.value;
          prefilledValues[goal.id] = (value !== undefined && value !== null) ? value.toString() : "";
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
  }, [currentDate, goals, ...apiDependencies]); 

  // ==========================
  // Handlers
  // ==========================
  const handleChange = (goalId: string, val: string) => {
    // Basic validation to only allow digits and one decimal point
    setValues((prev) => ({ ...prev, [goalId]: val.replace(/[^\d.]/g, '') }));
  };

  /**
   * FIX: Clean the 'values' object to convert empty strings (which cause 
   * the backend ValueError) to null, while keeping the API's expected 
   * payload structure: { date: currentDate, values: { goal1: value } }.
   */
  const handleSave = async () => {
    try {
      // 1. Create a cleaned payload object
      const cleanedValues = Object.entries(values).reduce((acc, [goalId, value]) => {
        // If the string is empty or contains only whitespace, replace it with null.
        // Otherwise, send the string value as is (the API will handle parsing it).
        acc[goalId] = value.trim() === '' ? null : value;
        return acc;
      }, {} as { [goalId: string]: string | null }); 

      // 2. Send the cleaned payload
      const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Sending the cleaned payload object
        body: JSON.stringify({ date: currentDate, values: cleanedValues }), 
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Save failed: ${errorText}`);
      }
      
      setMessage("Entries saved ✅");
    } catch (error: any) {
      console.error(error);
      setMessage(`Error saving entries: ${error.message || 'Check console.'}`);
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
    <>
      <div className="goal-entry-page glass-card">
        
        <h1 className="page-title">Goal Entry</h1>
        
        <DateNavigator currentDate={currentDate} changeDate={changeDate} />

        {goals.length === 0 && <p>No goals configured for this squad.</p>}
        <div className="goal-list">
          {goals.map((goal) => (
            <div key={goal.id} className="goal-entry-row">
              <label className="goal-label">
                {goal.name} ({goal.type})
              </label>
              <input
                type="number"
                value={values[goal.id] ?? ""}
                onChange={(e) => handleChange(goal.id, e.target.value)}
                placeholder="0"
                className="input goal-input"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>

        {message && (
          <p className={message.includes("✅") ? "success-message" : "error-message"}>
            {message}
          </p>
        )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1em" }}>
        <button
          className="success-btn"
          onClick={handleSave}
          disabled={loading}
        >
          Save
        </button>
      </div>
      </div>
    </>
  );
};

export default SquadGoalEntryPage;