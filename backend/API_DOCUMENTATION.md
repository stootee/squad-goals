# Squad Goals API Documentation

## Overview

Squad Goals is a collaborative goal tracking application. This document describes the REST API endpoints, request/response formats, and authentication mechanisms.

**Base URL:** `/api`
**Authentication:** Session-based (Flask-Login)
**Response Format:** JSON

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Profile](#user-profile)
3. [Squads](#squads)
4. [Invitations](#invitations)
5. [Goals & Goal Groups](#goals--goal-groups)
6. [Goal Entries](#goal-entries)
7. [Error Responses](#error-responses)

---

## Authentication

### POST `/signup`
Create a new user account.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Responses:**
- `201 Created`: Account created successfully
- `400 Bad Request`: Missing username or password
- `409 Conflict`: Username already exists

---

### POST `/login`
Authenticate and create session.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "remember-me": boolean (optional)
}
```

**Responses:**
- `200 OK`: Login successful
- `401 Unauthorized`: Invalid credentials

---

### POST `/logout`
End current session.

**Authentication:** Required

**Responses:**
- `200 OK`: Logged out successfully

---

### GET `/user_info`
Get current user information.

**Authentication:** Required

**Response:**
```json
{
  "username": "string"
}
```

---

### POST `/forgot_password`
Generate password reset token.

**Request Body:**
```json
{
  "username": "string"
}
```

**Response:**
```json
{
  "message": "Password reset token generated.",
  "token": "string"
}
```

---

### POST `/reset_password/<token>`
Reset password with token.

**Request Body:**
```json
{
  "password": "string"
}
```

**Responses:**
- `200 OK`: Password reset successful
- `400 Bad Request`: Invalid or expired token

---

## User Profile

### GET `/profile`
Get user profile.

**Authentication:** Required

**Response:**
```json
{
  "name": "string",
  "gender": "string",
  "age": number,
  "height_cm": number,
  "weight_kg": number,
  "goal_weight_kg": number
}
```

---

### POST `/profile`
Update user profile.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string",
  "gender": "string",
  "age": number,
  "height_cm": number,
  "weight_kg": number,
  "goal_weight_kg": number
}
```

---

## Squads

### POST `/squads`
Create a new squad.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string"
}
```

**Response:**
```json
{
  "message": "Squad created!",
  "squad_id": number
}
```

---

### GET `/squads`
Get all squads for current user.

**Authentication:** Required

**Response:**
```json
[
  {
    "id": number,
    "name": "string",
    "admin": "string",
    "is_admin": boolean,
    "members": number
  }
]
```

---

### GET `/squads/<squad_id>`
Get squad details.

**Authentication:** Required
**Authorization:** Squad member

**Response:**
```json
{
  "id": number,
  "name": "string",
  "admin": "string",
  "members": [
    {
      "username": "string",
      "name": "string"
    }
  ],
  "is_admin": boolean
}
```

---

### DELETE `/squads/<squad_id>`
Delete a squad.

**Authentication:** Required
**Authorization:** Squad admin

**Response:**
```json
{
  "message": "Squad deleted"
}
```

---

### POST `/squads/<squad_id>/invite`
Invite user to squad.

**Authentication:** Required
**Authorization:** Squad admin

**Request Body:**
```json
{
  "username": "string"
}
```

---

### POST `/squads/<squad_id>/leave`
Leave a squad.

**Authentication:** Required
**Authorization:** Squad member

---

### POST `/squads/<squad_id>/remove_member`
Remove member from squad.

**Authentication:** Required
**Authorization:** Squad admin

**Request Body:**
```json
{
  "username": "string"
}
```

---

### GET `/squads/<squad_id>/profiles`
Get profiles of squad members.

**Authentication:** Required
**Authorization:** Squad member

**Response:**
```json
[
  {
    "username": "string",
    "configured_name": "string"
  }
]
```

---

## Invitations

### GET `/invites`
Get invites for current user or sent from a squad.

**Authentication:** Required

**Query Parameters:**
- `squad_id` (optional): Get invites sent from this squad (admin only)

**Response (user invites):**
```json
[
  {
    "id": number,
    "squad": "string",
    "squad_id": number,
    "invited_by": "string",
    "status": "pending"
  }
]
```

---

### DELETE `/invites/<invite_id>`
Rescind an invite.

**Authentication:** Required
**Authorization:** Squad admin

---

### POST `/invites/<invite_id>/respond`
Accept or decline an invite.

**Authentication:** Required

**Request Body:**
```json
{
  "response": "accept" | "decline"
}
```

---

## Goals & Goal Groups

### GET `/squads/<squad_id>/groups`
Get all goal groups for a squad.

**Authentication:** Required
**Authorization:** Squad member

---

### POST `/squads/<squad_id>/groups`
Create or update goal group.

**Authentication:** Required
**Authorization:** Squad admin

**Request Body (CustomCounter):**
```json
{
  "id": number (optional),
  "group_name": "string",
  "partition_type": "CustomCounter",
  "partition_label": "string",
  "start_value": number,
  "end_value": number (optional)
}
```

**Request Body (Time-based):**
```json
{
  "id": number (optional),
  "group_name": "string",
  "partition_type": "Daily" | "Weekly" | "BiWeekly" | "Monthly",
  "start_date": "ISO 8601 datetime",
  "end_date": "ISO 8601 datetime"
}
```

---

### DELETE `/squads/<squad_id>/groups/<group_id>`
Delete goal group (cascades to goals and entries).

**Authentication:** Required
**Authorization:** Squad admin

---

### GET `/squads/<squad_id>/goals`
Get all goals for a squad.

**Authentication:** Required
**Authorization:** Squad member

---

### POST `/squads/<squad_id>/goals`
Create or update a goal.

**Authentication:** Required
**Authorization:** Squad admin

**Request Body:**
```json
{
  "goals": [
    {
      "id": number (optional),
      "group_id": number,
      "is_private": boolean,
      "name": "string",
      "type": "count" | "above" | "below" | "range" | "boolean",
      "target": number,
      "target_max": number (for range type)
    }
  ]
}
```

---

### DELETE `/squads/<squad_id>/goals/<goal_id>`
Delete a goal.

**Authentication:** Required
**Authorization:** Squad admin

---

## Goal Entries

### POST `/squads/<squad_id>/goals/entry`
Submit goal entries for a boundary.

**Authentication:** Required
**Authorization:** Squad member

**Request Body:**
```json
{
  "date": "string" (boundary value),
  "entries": {
    "goal_id": {
      "value": "string",
      "note": "string"
    }
  }
}
```

---

### GET `/squads/<squad_id>/goals/entry`
Get entries for a specific boundary.

**Authentication:** Required
**Authorization:** Squad member

**Query Parameters:**
- `date`: Boundary value (date or counter)

---

### GET `/squads/<squad_id>/goals/history`
### GET `/squads/<squad_id>/goals/history/<group_id>`
Get goal entry history for current user.

**Authentication:** Required
**Authorization:** Squad member

**Response:**
```json
{
  "user_id": number,
  "squad_id": number,
  "groups": [
    {
      "goal_id": number,
      "goal_name": "string",
      "partition_type": "string",
      "start_value": "string",
      "boundaries": {
        "boundary_key": {
          "entry_id": number,
          "boundary": "string",
          "value": "string",
          "note": "string"
        }
      }
    }
  ]
}
```

---

### GET `/squads/<squad_id>/goals/entries/day`
Get all squad members' entries for a day/date range.

**Authentication:** Required
**Authorization:** Squad member

**Query Parameters:**
- `date`: Single date (YYYY-MM-DD)
- OR `start_date` + `end_date`: Date range

**Response:**
```json
[
  {
    "user_id": number,
    "username": "string",
    "entries": {
      "date": [
        {
          "goal_id": number,
          "value": "string",
          "note": "string"
        }
      ]
    }
  }
]
```

---

## Error Responses

All error responses follow this format:

```json
{
  "message": "Error description"
}
```
or
```json
{
  "error": "Error description"
}
```

### Common Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists

---

## Authentication Flow

1. **Sign up:** POST `/api/signup`
2. **Log in:** POST `/api/login` (creates session cookie)
3. **Make authenticated requests:** Include session cookie
4. **Log out:** POST `/api/logout` (destroys session)

All authenticated endpoints require a valid session cookie obtained from the login endpoint.

---

## Data Types

### Partition Types
- `Minute`: Minute-based tracking
- `Hourly`: Hour-based tracking
- `Daily`: Daily tracking
- `Weekly`: Weekly tracking
- `BiWeekly`: Bi-weekly tracking
- `Monthly`: Monthly tracking
- `CustomCounter`: Custom numeric counter

### Goal Types
- `count`: Count-based goals (≥ target)
- `above`: Value above target
- `below`: Value below target
- `range`: Value within range
- `boolean`: Yes/no goals
- `achieved`: Achievement-based
- `time`: Time-based goals
- `threshold`: Threshold goals
- `ratio`: Ratio-based goals

---

For more information or support, please refer to the project repository.
