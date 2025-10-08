// src/pages/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@components/AppLayout";
import "./../styles/global.css";

interface Profile {
  name?: string;
  gender?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  goal_weight_kg?: number;
}

interface SaveResponse {
  message: string;
  calorie_goal?: number;
  protein_goal?: number;
}

const ProfilePage: React.FC = () => {
  const apiURL = window.APP_CONFIG.API_URL;
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [proteinGoal, setProteinGoal] = useState<number | null>(null);

  // Fetch existing profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${apiURL}/profile`, { credentials: "include" });
        if (res.status === 401) return navigate("/login");
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data: Profile = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    fetchProfile();
  }, [apiURL, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiURL}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });
      const result: SaveResponse = await res.json();

      if (res.ok) {
        setMessage(result.message || "Profile saved successfully!");
        setMessageType("success");
        setCalorieGoal(result.calorie_goal || null);
        setProteinGoal(result.protein_goal || null);
      } else {
        setMessage(result.message || "Failed to save profile.");
        setMessageType("error");
        setCalorieGoal(null);
        setProteinGoal(null);
      }
    } catch (err) {
      console.error("Error saving profile:", err);
      setMessage("Unable to reach server. Please try again later.");
      setMessageType("error");
      setCalorieGoal(null);
      setProteinGoal(null);
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const logout = () => {
    document.cookie = "session=; Max-Age=0; path=/;";
    navigate("/login");
  };

  return (
    <AppLayout title="Profile">
    <div className="container" style={{ padding: "2em" }}>
      <div className="glass-card">

        {message && (
          <div className={`message-container ${messageType}`} role="alert">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {[
            { label: "Name", name: "name", type: "text", placeholder: "Enter your name" },
            { label: "Age", name: "age", type: "number", placeholder: "Enter your age" },
            { label: "Height (cm)", name: "height_cm", type: "number", placeholder: "Enter your height" },
            { label: "Weight (kg)", name: "weight_kg", type: "number", placeholder: "Enter your weight" },
            { label: "Goal Weight (kg)", name: "goal_weight_kg", type: "number", placeholder: "Enter your goal weight" },
          ].map((field) => (
            <div key={field.name} className="form-group">
              <label htmlFor={field.name}>{field.label}:</label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                value={profile[field.name as keyof Profile] || ""}
                onChange={handleChange}
                placeholder={field.placeholder}
              />
            </div>
          ))}

          <div className="form-group">
            <label htmlFor="gender">Gender:</label>
            <select
              id="gender"
              name="gender"
              value={profile.gender || ""}
              onChange={handleChange}
              aria-label="Gender"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <button type="submit">Save Profile</button>
        </form>

        {(calorieGoal || proteinGoal) && (
          <div className="goals-display" style={{ marginTop: "1em" }}>
            <h3>Your Goals</h3>
            {calorieGoal && <p>Daily Calorie Goal: {calorieGoal} kcal</p>}
            {proteinGoal && <p>Daily Protein Goal: {proteinGoal} g</p>}
          </div>
        )}

      </div>
    </div>
    </AppLayout>
  );
};

export default ProfilePage;
