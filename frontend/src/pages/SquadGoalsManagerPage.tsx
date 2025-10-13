// src/components/SquadGoalsManager.tsx
import React, { useEffect, useState } from "react";
// Removed external CSS imports to resolve compilation errors
import "@styles/global.css"; 
import "@styles/SquadGoalsManagerPage.css"; 

// --- INTERFACE DEFINITIONS ---

interface Goal {
  id?: string;
  name: string;
  type: string;
  target?: number;
  is_private: boolean;
  is_active: boolean;
  squad_id?: string;
}

interface SquadGoalsManagerProps {
  squadId: string;
  // CRITICAL ADDITION: Prop to check user's administrative status
  isAdmin: boolean; 
}

// --- REACT COMPONENT ---

const SquadGoalsManager: React.FC<SquadGoalsManagerProps> = ({ squadId, isAdmin }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ name: "", type: "", target: "" });

  const apiURL = window.APP_CONFIG?.API_URL || "/api";

  useEffect(() => {
    loadGoals();
  }, [squadId, apiURL]); 

  // --- API CALLS ---
  const loadGoals = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
      if (res.ok) setGoals(await res.json());
    } catch (err) {
      console.error("Error loading goals:", err);
    }
  };

  const saveGoal = async (goal: Goal) => {
    // SECURITY CHECK: Only allow admins to save changes
    if (!isAdmin) return; 
    
    if (!goal.name.trim() || !goal.type.trim()) return;
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ goals: [goal] }),
      });
      if (res.ok) return (await res.json())[0];
    } catch (err) {
      console.error("Error saving goal:", err);
    }
  };

  const removeGoal = async (goal: Goal, index: number) => {
    // SECURITY CHECK: Only allow admins to remove goals
    if (!isAdmin) return; 

    if (goal.id) {
      // NOTE: Replace window.confirm with a custom modal in a real application
      if (!window.confirm(`Delete goal: ${goal.name}?`)) return;

      try {
        const res = await fetch(`${apiURL}/squads/${squadId}/goals/${goal.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json();
          // NOTE: Replace alert with a message component.
          alert(data.error || "Failed to delete goal");
          return;
        }
      } catch (err) {
        console.error("Error deleting goal:", err);
        return;
      }
    }
    setGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const addGoal = async () => {
    // SECURITY CHECK: Only allow admins to add goals
    if (!isAdmin) return; 

    if (!newGoal.name.trim() || !newGoal.type.trim()) return;

    const goal: Goal = {
      name: newGoal.name,
      type: newGoal.type,
      target: newGoal.target ? Number(newGoal.target) : undefined,
      is_private: true,
      is_active: true,
      squad_id: squadId,
    };

    const savedGoal = await saveGoal(goal);
    if (savedGoal) setGoals((prev) => [...prev, savedGoal]);
    setNewGoal({ name: "", type: "", target: "" });
  };
  
  // --- HANDLERS ---
  const handleChange = (index: number, field: keyof Goal, value: string | number | undefined) => {
    // SECURITY CHECK: Only allow admins to edit goal fields
    if (!isAdmin) return;
    
    const updated = [...goals];
    (updated[index] as any)[field] = value;
    setGoals(updated);
    if (updated[index].id) saveGoal(updated[index]);
  };

  // Prevents the numeric input from changing values when scrolling
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).blur();
  };

  return (
    <div className="squad-goals-manager"> 
      <h2 className="manager-title">
        {/* Title indicates the current mode */}
        {/* This title will show (Admin) if the prop is true */}
        {isAdmin ? "Manage Squad Goals (Admin)" : "Configured Squad Goals"}
      </h2>

      {/* Container for scrollable content on small screens (overflow-x: auto) */}
      <div className="goals-responsive-area">
        
        {/* List of existing goals */}
        <ul className="goals-list">
          {goals.map((goal, index) => (
            <li key={goal.id || `temp-${index}`} className="goal-list-item">
              <input
                type="text"
                value={goal.name}
                placeholder="Goal name"
                onChange={(e) => handleChange(index, "name", e.target.value)}
                className="input goal-input goal-name-input"
                // Inputs are enabled only for admins (disabled=false)
                disabled={!isAdmin} 
              />
              <input
                type="text"
                value={goal.type}
                placeholder="Type"
                onChange={(e) => handleChange(index, "type", e.target.value)}
                className="input goal-input goal-type-input"
                // Inputs are enabled only for admins
                disabled={!isAdmin}
              />
              <input
                type="number"
                value={goal.target ?? ""}
                placeholder="Target"
                onChange={(e) =>
                  handleChange(index, "target", e.target.value ? Number(e.target.value) : undefined)
                }
                className="input goal-input goal-target-input"
                onWheel={handleWheel}
                inputMode="decimal"
                // Inputs are enabled only for admins
                disabled={!isAdmin}
              />
              
              {/* REMOVE button only renders for admins */}
              {isAdmin && (
                <button
                  onClick={() => removeGoal(goal, index)}
                  className="submit-btn remove-btn danger-btn" 
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      
        {/* New goal form (Only renders for admins) */}
        {isAdmin && (
          <div className="new-goal-form">
            <input
              type="text"
              placeholder="New Goal name"
              value={newGoal.name}
              onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
              className="input goal-input goal-name-input"
            />
            <input
              type="text"
              placeholder="Type (e.g., Count)"
              value={newGoal.type}
              onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value })}
              className="input goal-input goal-type-input"
            />
            <input
              type="number"
              placeholder="Target"
              value={newGoal.target}
              onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
              className="input goal-input goal-target-input"
              onWheel={handleWheel}
              inputMode="decimal"
            />
            <button
              onClick={addGoal}
              className="submit-btn add-btn success-btn" 
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SquadGoalsManager;
