// src/components/SquadGoalsManager.tsx
import React, { useEffect, useState } from "react";

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
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.75em",
  borderRadius: 6,
  border: "1px solid #ccc",
  textAlign: "center",
  fontSize: "1em",
  outline: "none",
  MozAppearance: "textfield",
  WebkitAppearance: "none",
  appearance: "none",
};

const SquadGoalsManager: React.FC<SquadGoalsManagerProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ name: "", type: "", target: "" });

  useEffect(() => {
    loadGoals();
  }, [squadId]);

  const loadGoals = async () => {
    try {
      const res = await fetch(`/api/squads/${squadId}/goals`, { credentials: "include" });
      if (res.ok) {
        const data: Goal[] = await res.json();
        setGoals(data);
      }
    } catch (err) {
      console.error("Error loading goals:", err);
    }
  };

  const saveGoal = async (goal: Goal) => {
    if (!goal.name.trim() || !goal.type.trim()) return; 
    try {
      const res = await fetch(`/api/squads/${squadId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ goals: [goal] }),
      });
      if (res.ok) {
        const saved = await res.json();
        return saved[0];
      }
    } catch (err) {
      console.error("Error saving goal:", err);
    }
  };

  const handleChange = (index: number, field: keyof Goal, value: string | number) => {
    const updated = [...goals];
    (updated[index] as any)[field] = value;
    setGoals(updated);

    if (updated[index].id) saveGoal(updated[index]);
  };

  const removeGoal = async (goal: Goal, index: number) => {
    if (goal.id) {
      try {
        const res = await fetch(`/api/squads/${squadId}/goals/${goal.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to delete goal");
          return;
        }
      } catch (err) {
        console.error("Error deleting goal:", err);
        return;
      }
    }
    setGoals(prev => prev.filter((_, i) => i !== index));
  };

  const addGoal = async () => {
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
    if (savedGoal) setGoals(prev => [...prev, savedGoal]);
    setNewGoal({ name: "", type: "", target: "" });
  };

  return (
    <div style={{ padding: "1em", border: "1px solid #ddd", borderRadius: 8, background: "#fefefe" }}>
      <h2 style={{ marginBottom: "1em" }}>Squad Goals</h2>

      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5em" }}>
        {goals.map((goal, index) => (
          <li key={goal.id || `temp-${index}`} style={{ display: "flex", gap: "0.5em" }}>
            <input
              type="text"
              value={goal.name}
              placeholder="Goal name"
              onChange={e => handleChange(index, "name", e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              value={goal.type}
              placeholder="Type"
              onChange={e => handleChange(index, "type", e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              value={goal.target ?? ""}
              placeholder="Target"
              onChange={e => handleChange(index, "target", e.target.value ? Number(e.target.value) : undefined)}
              style={inputStyle}
              onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
            />
            <button
              onClick={() => removeGoal(goal, index)}
              style={{
                padding: "0.5em 1em",
                color: "#fff",
                background: "#dc3545",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: "0.5em", marginTop: "1em" }}>
        <input
          type="text"
          placeholder="Goal name"
          value={newGoal.name}
          onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Type"
          value={newGoal.type}
          onChange={e => setNewGoal({ ...newGoal, type: e.target.value })}
          style={inputStyle}
        />
        <input
          type="number"
          placeholder="Target"
          value={newGoal.target}
          onChange={e => setNewGoal({ ...newGoal, target: e.target.value })}
          style={inputStyle}
          onWheel={e => (e.currentTarget as HTMLInputElement).blur()}
        />
        <button
          onClick={addGoal}
          style={{
            padding: "0.5em 1em",
            color: "#fff",
            background: "#28a745",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
};

export default SquadGoalsManager;
