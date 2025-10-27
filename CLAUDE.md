# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Squad Goals is a collaborative goal tracking application with a Flask backend and React/TypeScript frontend. Users create "squads" (teams) and track shared goals with flexible time-based or custom counter partitions.

## Development Commands

### Backend (Flask)
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server
python app.py
# Server runs on http://0.0.0.0:5050
```

### Frontend (React + Vite)
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
# Dev server runs on http://localhost:5173

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Docker Development
```bash
# Start both frontend and backend
docker-compose -f docker-compose-dev.yml up

# Rebuild containers
docker-compose -f docker-compose-dev.yml up --build

# Stop containers
docker-compose -f docker-compose-dev.yml down
```

The Docker setup includes:
- Backend: `squagol-backend` on port 5050
- Frontend: `squagol-frontend` on port 5173
- Shared network: `squagol-dev-net`
- Volume mounts for live reloading

## Architecture

### Backend Architecture (Flask)

**Database Models** (`backend/models.py`):
- `User`: Authentication with Flask-Login, UUID primary keys
- `UserProfile`: Optional user metadata (name, age, weight, etc.)
- `Squad`: Groups of users with an admin
- `SquadMember`: Many-to-many relationship between users and squads
- `SquadInvite`: Pending invitations with status tracking
- `GoalGroup`: Defines time partitions (Daily/Weekly/Monthly) or custom counters for goals
- `Goal`: Can be private (custom) or linked to `GlobalGoal`
- `GoalEntry`: Individual user entries with `boundary_value` (date string or counter number)
- `GlobalGoal`: Shared canonical goals across squads

**Key Architecture Patterns**:
- Session-based authentication with `flask-login`
- SQLite database (`users.db`)
- Decorator `@squad_member_required` for authorization checks
- CORS configured for `http://192.168.0.200:5173` and `http://squagol:5173`
- Goals are organized into `GoalGroups` with partition types that control time boundaries

**Partition System**:
Goals are grouped by partition type stored in `GoalGroup`:
- Time-based: `Minute`, `Hourly`, `Daily`, `Weekly`, `BiWeekly`, `Monthly`
- Counter-based: `CustomCounter` (uses integer start/end values instead of dates)
- `boundary_value` column in `GoalEntry` stores either date strings (`YYYY-MM-DD`) or counter strings
- Helper functions `step_boundary_back()` and `calculate_boundary_keys()` handle pagination across partitions

**Goal Entry History**:
- Endpoint `/api/squads/<squad_id>/goals/history` returns all entries with gaps filled
- Entries sorted chronologically (oldest → newest)
- Filtering by `TIME_BASED_PARTITIONS` prevents date-range queries on counter goals

### Frontend Architecture (React + TypeScript)

**Tech Stack**:
- React 19 + TypeScript
- Vite build tool with React Compiler enabled
- Mantine UI component library (v8.3.5)
- Chakra UI (v3.27.1) for some components
- React Router DOM for navigation
- Framer Motion for animations
- Axios for API requests

**Project Structure**:
- `src/pages/`: Page components (HomePage, SquadsPage, ProfilePage, SquadLayout)
- `src/components/`: Reusable components (AppLayout, SquadGoalsManager, BoundaryNavigator)
- `src/hooks/`: Custom React hooks (useSquadGoalsManager)
- `src/types/`: TypeScript definitions
- `src/constants/`: Shared constants like partition types
- `src/styles/`: Global CSS

**Path Aliases** (configured in vite.config.ts and tsconfig.json):
- `@components/*` → `src/components/*`
- `@pages/*` → `src/pages/*`
- `@styles/*` → `src/styles/*`

**Routing Structure**:
- `/` - Home/login page
- `/profile` - User profile
- `/squads` - List of user's squads
- `/squads/:id/*` - Squad-specific routes (nested in SquadLayout)
- `/squads/:id/daily` - Daily overview page

**API Proxy**:
Vite dev server proxies `/api` requests to `http://squagol:5050` (backend)

### Data Flow

1. **Authentication**: Session cookies maintained by Flask-Login
2. **Squad Management**: Admin creates squad → invites users → users accept
3. **Goal Setup**: Admin creates `GoalGroup` with partition type → adds `Goal` instances to group
4. **Goal Tracking**: Members submit `GoalEntry` records with `boundary_value` matching the partition
5. **History Viewing**: Frontend fetches entries, backend fills gaps based on partition logic

### Key Implementation Details

**Database Notes**:
- Uses SQLAlchemy with SQLite
- Cascade deletes configured on Squad → Goals → Entries
- UUID strings used for User, Squad, Goal, and GoalGroup IDs
- `boundary_value` is stored as String(50) to support both dates and counters
- Unique constraint on `(user_id, goal_id, boundary_value)`

**Frontend State Management**:
- No global state library (Redux/Zustand)
- Component-level state with hooks
- Custom hook `useSquadGoalsManager` likely handles goal management logic

**API Authentication**:
- Credentials must be included in requests (`credentials: 'include'` for fetch/axios)
- Unauthorized requests return 401 JSON response (not redirects)

## Database Initialization

The database is auto-created on first request via `@app.before_request` hook. To manually recreate:
```bash
cd backend
rm users.db  # Delete existing database
python app.py  # Creates fresh database on startup
```

## Environment Variables

**Backend**:
- `SECRET_KEY`: Flask session secret (defaults to 'a_secret_key')
- `FLASK_ENV`: Set to 'development' for debug mode

**Frontend**:
- `VITE_API_URL`: Backend URL (set in docker-compose, defaults to proxy in dev)

## Important Implementation Notes

1. **Partition Type Changes**: Once a `GoalGroup` is created, its partition type cannot be changed. This ensures data consistency in `GoalEntry.boundary_value`.

2. **Goal Groups**: Goals must belong to a `GoalGroup`. When creating goals, always provide an existing `group_id`.

3. **Boundary Value Format**:
   - Time partitions: `YYYY-MM-DD` format
   - Counter partitions: Integer strings like `"1"`, `"2"`, `"3"`

4. **Goal Status Calculation**: Helper function `check_goal_status()` determines if entries meet targets based on goal type (count, above, below, range, boolean, time).

5. **React Compiler**: Enabled on frontend, may impact Vite dev/build performance but optimizes React rendering.
