// src/pages/SquadGoalSubmissionPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import "@styles/global.css";
import "@styles/SquadGoalSubmissionPage.css"; // Dedicated CSS for table layout

interface Goal {
  id: string;
  name: string;
  type: string;
  target: number;
}

interface UserEntries {
  [goalId: string]: { [date: string]: number | string };
}

interface SquadGoalSubmissionPageProps {
  squadId: string;
}

// Helper to format date for display (e.g., 10/12)
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, { 
    month: "numeric", 
    day: "numeric" 
  });
};

const SquadGoalSubmissionPage: React.FC<SquadGoalSubmissionPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntries>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");

  // Use optional chaining for safer access
  const apiURL = window.APP_CONFIG?.API_URL; 
  
  // Dependencies array for effects
  const apiDependencies = [squadId, apiURL, currentUsername];

  const lastSevenDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        // Calculate the date for the last 7 days (index 0 is 6 days ago, index 6 is today)
        d.setDate(d.getDate() - 6 + i);
        return d.toISOString().split("T")[0];
      }),
    []
  );

  // ==========================
  // Fetch current user
  // ==========================
  useEffect(() => {
    if (!apiURL) return;
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
  }, [apiURL]);


  // ==========================
  // Data Fetching Functions
  // ==========================
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
      
      // Transform the flat array response into the desired { goalId: { date: value } } structure
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
  
  // ==========================
  // Main Data Effect
  // ==========================
  useEffect(() => {
    if (!currentUsername || !apiURL) return;

    const fetchData = async () => {
      setLoading(true);
      await fetchGoals();
      await fetchUserEntries();
      setLoading(false);
    };
    fetchData();
  }, [squadId, currentUsername, apiURL]); // Removed lastSevenDays as dependency as it's a fixed memo

  // ==========================
  // Handler
  // ==========================
  const handleCellChange = async (goalId: string, date: string, value: string) => {
    // Basic validation and state update (optimistic UI)
    const numericValue = parseFloat(value);
    
    // Update local state immediately with the raw string for input control
    setUserEntries((prev) => ({
      ...prev,
      [goalId]: { ...prev[goalId], [date]: value === "" ? "" : value },
    }));

    // If value is empty, don't send API call, or send 0 if backend expects it.
    // Assuming we only send if it's a valid, positive number for submission.
    if (isNaN(numericValue) || numericValue < 0 || value === "") {
        // You might clear the entry in the DB here if value is empty, depending on API.
        return; 
    }

    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, values: { [goalId]: numericValue } }),
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

  // ==========================
  // Render
  // ==========================
  if (loading) return <p>Loading your squad data...</p>;

  if (goals.length === 0) {
    // Removed redundant `container` wrapper. `glass-card` stands alone.
    return (
      <div className="glass-card">
        <h1>Goal Submission</h1>
        <p>The admin has not yet configured any goals for this squad. Progress tracking is not available.</p>
      </div>
    );
  }

  return (
    // Removed redundant `container` wrapper.
    <div className="glass-card goal-submission-card">
      <h1 className="card-title">My Progress History</h1>
      
      {/* Use standardized message classes */}
      {message && (
        <p className={message.includes("✅") ? "success-message" : "error-message"}>
          {message}
        </p>
      )}
      
      {/* Wrapper for responsive table scrolling */}
      <div className="responsive-table-wrapper"> 
        <table className="squad-table" cellPadding={0} cellSpacing={0}>
          <thead>
            <tr>
              <th className="goal-header">Goal</th>
              {lastSevenDays.map((d) => (
                <th key={d} className="date-header">
                  {formatDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => (
              <tr key={goal.id}>
                <td className="goal-name-cell">
                  {goal.name} ({goal.type})
                </td>
                {lastSevenDays.map((d) => (
                  <td key={d} className="entry-cell">
                    <input
                      type="number" // Changed to number to use the native mobile numeric keyboard
                      min="0"
                      step="any"
                      placeholder="0"
                      // Use the local state value. The state now stores strings for inputs.
                      value={userEntries[goal.id]?.[d] ?? ""} 
                      onChange={(e) => handleCellChange(goal.id, d, e.target.value)}
                      className="table-input"
                      inputMode="decimal" // Ensures correct mobile keyboard
                      // Removed manual tabIndex calculation, relying on browser's natural flow
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