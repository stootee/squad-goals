// src/pages/ProfilePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const apiURL = import.meta.env.VITE_API_URL;
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
        if (res.status === 401) {
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data: Profile = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    fetchProfile();
  }, [apiURL, navigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
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
    <div className="container">
      <h1>User Profile</h1>

      {message && (
        <div className={`message-container ${messageType}`} role="alert">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            name="name"
            type="text"
            value={profile.name || ""}
            onChange={handleChange}
            placeholder="Enter your name"
          />
        </div>

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

        <div className="form-group">
          <label htmlFor="age">Age:</label>
          <input
            id="age"
            name="age"
            type="number"
            value={profile.age || ""}
            onChange={handleChange}
            placeholder="Enter your age"
          />
        </div>

        <div className="form-group">
          <label htmlFor="height_cm">Height (cm):</label>
          <input
            id="height_cm"
            name="height_cm"
            type="number"
            value={profile.height_cm || ""}
            onChange={handleChange}
            placeholder="Enter your height"
          />
        </div>

        <div className="form-group">
          <label htmlFor="weight_kg">Weight (kg):</label>
          <input
            id="weight_kg"
            name="weight_kg"
            type="number"
            value={profile.weight_kg || ""}
            onChange={handleChange}
            placeholder="Enter your weight"
          />
        </div>

        <div className="form-group">
          <label htmlFor="goal_weight_kg">Goal Weight (kg):</label>
          <input
            id="goal_weight_kg"
            name="goal_weight_kg"
            type="number"
            value={profile.goal_weight_kg || ""}
            onChange={handleChange}
            placeholder="Enter your goal weight"
          />
        </div>

        <button type="submit">Save Profile</button>
      </form>

      {(calorieGoal || proteinGoal) && (
        <div className="goals-display">
          <h3>Your Goals</h3>
          {calorieGoal && <p>Daily Calorie Goal: {calorieGoal} kcal</p>}
          {proteinGoal && <p>Daily Protein Goal: {proteinGoal} g</p>}
        </div>
      )}

      <div className="nav-links">
        <a href="/weekly-stats">Weekly Stats</a> |{" "}
        <a href="/daily-input">Daily Input</a> |{" "}
        <button onClick={logout}>Log Out</button>
      </div>
    </div>
  );
};

export default ProfilePage;
