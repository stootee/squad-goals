import React, { useEffect, useState, useMemo } from "react";
import "./../styles/global.css";
import "./../styles/SquadDailyOverviewPage.css"; 

interface Entry {
  goal_id: string;
  value: number;
  date: string;
}

interface UserEntryGroup {
  user_id: string;
  username: string;
  entries: Record<string, Entry[]>; // date -> entries
}

interface Goal {
  id: string;
  name: string;
}

interface SquadDailyOverviewPageProps {
  squadId: string;
}

function getCurrentWeekMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return monday.toISOString().split("T")[0];
}

function getCurrentWeekSunday(monday: string): string {
  const date = new Date(monday);
  date.setDate(date.getDate() + 6);
  return date.toISOString().split("T")[0];
}

const SquadDailyOverviewPage: React.FC<SquadDailyOverviewPageProps> = ({ squadId }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [startDate, setStartDate] = useState<string>(() => getCurrentWeekMonday());
  const [endDate, setEndDate] = useState<string>(() => getCurrentWeekSunday(getCurrentWeekMonday()));

  const apiURL = window.APP_CONFIG.API_URL;

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${apiURL}/squads/${squadId}/goals`, { credentials: "include" });
      if (res.ok) {
        setGoals(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch goals", err);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/squads/${squadId}/goals/entries/day?start_date=${startDate}&end_date=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load entries");
      const data: UserEntryGroup[] = await res.json();
      setUserEntries(data);
    } catch (err) {
      console.error("Failed to fetch entries", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [squadId]);

  useEffect(() => {
    fetchEntries();
  }, [squadId, startDate, endDate]);

  const getGoalSummary = (user: UserEntryGroup) => {
    const summed: Record<string, number> = {};
    Object.values(user.entries).forEach((dayEntries) => {
      dayEntries.forEach((entry) => {
        summed[entry.goal_id] = (summed[entry.goal_id] || 0) + entry.value;
      });
    });
    return summed;
  };

  const summarizedEntries = useMemo(() => {
    return userEntries.map(user => {
      const summary = getGoalSummary(user);
      const total = Object.values(summary).reduce((acc, val) => acc + val, 0);
      
      const daysCount = Object.keys(user.entries).length; 
      
      return { ...user, summary, total, daysCount };
    }).sort((a, b) => b.total - a.total);
  }, [userEntries]);

  const toggleExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const updated = new Set(prev);
      updated.has(userId) ? updated.delete(userId) : updated.add(userId);
      return updated;
    });
  };

  const getGoalName = (goalId: string) => {
    return goals.find(g => g.id === goalId)?.name || `Goal ${goalId}`;
  };

  const renderDesktopUserRows = (user: typeof summarizedEntries[0]) => {
    const isExpanded = expandedUsers.has(user.user_id);
    const sortedDates = Object.keys(user.entries).sort();
    
    return (
      <React.Fragment key={user.user_id}>
        <tr className="summary-row-desktop">
          <td className="expand-btn-cell">
            <button className="expand-btn" onClick={() => toggleExpand(user.user_id)}>
              {isExpanded ? "−" : "+"}
            </button>
          </td>
          <td className="user-name-cell">
            <strong>{user.username}</strong>
          </td>
          {goals.map((goal) => (
            <td key={goal.id} className="goal-value-cell">
              {user.summary[goal.id] ?? 0}
            </td>
          ))}
          <td className="total-value-cell">
            <strong>{user.total}</strong>
          </td>
        </tr>

        {isExpanded && sortedDates.map((date) => (
            <tr key={date} className="detail-row">
              <td />
              <td className="date-cell">
                {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </td>
              {goals.map((goal) => {
                const dayEntry = user.entries[date].find((e) => e.goal_id === goal.id);
                return (
                  <td key={goal.id} className="goal-value-cell">
                    {dayEntry ? dayEntry.value : "-"}
                  </td>
                );
              })}
              <td />
            </tr>
          ))}
      </React.Fragment>
    );
  };

  const renderMobileUserCard = (user: typeof summarizedEntries[0]) => {
    const isExpanded = expandedUsers.has(user.user_id);
    const sortedDates = Object.keys(user.entries).sort();

    const daysLogged = user.daysCount;

    return (
      <div 
        key={user.user_id} 
        className={`user-card glass-card ${isExpanded ? 'is-expanded' : ''}`}
        onClick={() => toggleExpand(user.user_id)}
      >
        <div className="card-header">
          <span className="user-name">{user.username}</span>
          <div className="summary-stats">
            <span className="count-label">Days Logged:</span> 
            <strong className="count-value">{daysLogged}</strong> 
            <span className="toggle-icon">{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="card-details">
            <h4 className="detail-heading">Goal Totals (Total Progress: {user.total})</h4>
            
            <ul className="goal-summary-list">
              {Object.entries(user.summary)
                .filter(([, value]) => value > 0)
                .map(([goalId, value]) => (
                <li key={goalId} className="goal-summary-item">
                  <span className="goal-name">{getGoalName(goalId)}</span>
                  <strong className="goal-total">{value}</strong>
                </li>
              ))}
            </ul>

            <h4 className="detail-heading date-detail-heading">Daily Entries</h4>

            {sortedDates.map(date => (
                <div key={date} className="day-entries">
                    <strong className="entry-date">
                        {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                    </strong>
                    <ul className="day-goal-list">
                        {goals.map(goal => {
                            const dayEntry = user.entries[date].find(e => e.goal_id === goal.id);
                            return (
                                <li key={goal.id}>
                                    <span className="goal-name-small">{goal.name}:</span>
                                    <span className={`goal-value-small ${dayEntry?.value ? 'has-value' : 'no-value'}`}>
                                        {dayEntry ? dayEntry.value : "-"}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  if (loading) return <p>Loading squad data...</p>;

  const currentWeekDisplay = `${new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="container squad-daily-overview">
      <div className="glass-card main-card">
        <h1>Squad Progress Overview</h1>

        <div className="date-filters">
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <div className="desktop-table-view">
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <table className="squad-table">
              <thead>
                <tr>
                  <th className="expand-btn-cell" />
                  <th className="user-name-cell">User</th>
                  {goals.map((goal) => (
                    <th key={goal.id} className="goal-header">
                      {goal.name}
                    </th>
                  ))}
                  <th className="total-header">Total</th>
                </tr>
              </thead>
              <tbody>{summarizedEntries.map(renderDesktopUserRows)}</tbody>
            </table>
          </div>
        </div>
        
        <div className="mobile-card-view">
            {summarizedEntries.map(renderMobileUserCard)}
        </div>

      </div>
    </div>
  );
};

export default SquadDailyOverviewPage;