"""
Goal entry routes for Squad Goals application.

Handles:
- Goal entry submission
- Goal entry retrieval
- Goal history tracking
- Squad-wide goal entry views
"""

from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from collections import defaultdict

from models import db, User, Goal, GoalEntry, GoalGroup
from decorators import squad_member_required
from utils import (
    validate_boundary_value,
    get_goal_entries,
    upsert_goal_entry,
    parse_date_range
)

goal_entries_bp = Blueprint('goal_entries', __name__)

# Import constants from app context
TIME_BASED_PARTITIONS = [
    'Minute', 'Hourly', 'Daily', 'Weekly', 'BiWeekly', 'Monthly'
]


def generate_boundary_series(start_date, end_date, partition_type):
    """Generate a series of boundary dates based on partition type."""
    from datetime import timedelta
    from dateutil.relativedelta import relativedelta

    boundaries = []
    current = start_date

    while current <= end_date:
        boundaries.append(current.strftime("%Y-%m-%d"))

        if partition_type == "Daily":
            current += timedelta(days=1)
        elif partition_type == "Weekly":
            current += timedelta(weeks=1)
        elif partition_type == "BiWeekly":
            current += timedelta(weeks=2)
        elif partition_type == "Monthly":
            current += relativedelta(months=1)
        else:
            raise ValueError(f"Unsupported partition type: {partition_type}")

    return boundaries


@goal_entries_bp.route('/squads/<squad_id>/goals/entry', methods=['POST'])
@login_required
@squad_member_required
def submit_squad_goal_entry(squad_id, squad):
    """Submit goal entries for a specific boundary (date or counter)."""
    data = request.get_json()
    boundary_value_input = data.get("date")
    entries_data = data.get("entries", {})

    # Validate boundary value using helper
    boundary_value_str, error = validate_boundary_value(boundary_value_input)
    if error:
        return jsonify({"message": error}), 400

    valid_goal_ids = {str(g.id) for g in Goal.query.filter_by(squad_id=squad.id).all()}

    for goal_id_str, entry_obj in entries_data.items():
        if goal_id_str not in valid_goal_ids:
            print(f"Skipping unknown goal ID: {goal_id_str}")
            continue

        value = entry_obj.get("value")
        note = entry_obj.get("note")

        # Use upsert helper
        upsert_goal_entry(
            current_user.id,
            squad.id,
            goal_id_str,
            boundary_value_str,
            value,
            note
        )

    db.session.commit()

    # Return updated entries for the boundary using query helper
    entries = get_goal_entries(current_user.id, squad.id, boundary_value_str)
    return jsonify([entry.to_dict() for entry in entries]), 200


@goal_entries_bp.route("/squads/<squad_id>/goals/entry", methods=['GET'])
@login_required
@squad_member_required
def get_user_goal_entry_for_date(squad_id, squad):
    """Get goal entries for a specific boundary (date or counter)."""
    boundary_value_input = request.args.get("date")

    # Validate boundary value using helper
    boundary_value_str, error = validate_boundary_value(boundary_value_input)
    if error:
        return jsonify({"message": "Boundary value (date or counter) parameter is required"}), 400

    # Use query helper
    entries = get_goal_entries(current_user.id, squad.id, boundary_value_str)
    return jsonify([entry.to_dict() for entry in entries]), 200


@goal_entries_bp.route("/squads/<squad_id>/goals/history", methods=["GET"])
@goal_entries_bp.route("/squads/<squad_id>/goals/history/<group_id>", methods=["GET"])
@login_required
@squad_member_required
def get_goal_history(squad_id, squad, group_id=None):
    """
    Returns all goal entries for the current user in this squad,
    filling missing boundaries up to the latest recorded entry.
    Entries are returned in chronological order (oldest → newest).
    """
    query = (
        GoalEntry.query
        .join(Goal)
        .filter(
            GoalEntry.user_id == current_user.id,
            GoalEntry.squad_id == squad_id
        )
    )

    if group_id:
        query = query.filter(Goal.group_id == group_id)

    entries = query.all()
    if not entries:
        return jsonify({
            "user_id": current_user.id,
            "squad_id": squad_id,
            "groups": []
        }), 200

    grouped = defaultdict(lambda: {
        "goal_id": None,
        "goal_name": None,
        "partition_type": None,
        "start_value": None,
        "boundaries": {}
    })

    # --- Step 1: Collect all entries ---
    for entry in entries:
        goal = entry.goal
        if not goal:
            continue
        gid = goal.id

        if grouped[gid]["goal_id"] is None:
            grouped[gid]["goal_id"] = gid
            grouped[gid]["goal_name"] = goal.name
            grouped[gid]["partition_type"] = goal.goal_group.partition_type if goal.goal_group else None
            grouped[gid]["start_value"] = (
                goal.goal_group.start_value if "counter" in goal.goal_group.partition_type.lower() else goal.goal_group.start_date.isoformat()
            )

        grouped[gid]["boundaries"][str(entry.boundary_value)] = {
            "entry_id": entry.id,
            "boundary": str(entry.boundary_value),
            "value": entry.value,
            "note": entry.note
        }

    # --- Step 2: Generate full boundary list + fill gaps ---
    for goal_data in grouped.values():
        partition_type = goal_data["partition_type"]
        start_value = goal_data["start_value"]
        existing_boundaries = list(goal_data["boundaries"].keys())
        if not existing_boundaries:
            continue

        if "counter" in partition_type.lower():
            start = int(start_value)
            end = max(int(b) for b in existing_boundaries)
            all_boundaries = [str(i) for i in range(start, end + 1)]

        else:
            start_date = datetime.fromisoformat(start_value)
            max_date = max(datetime.fromisoformat(b) for b in existing_boundaries)
            all_boundaries = generate_boundary_series(start_date, max_date, partition_type)

        # Fill missing with blanks
        for boundary in all_boundaries:
            if boundary not in goal_data["boundaries"]:
                goal_data["boundaries"][boundary] = {
                    "entry_id": None,
                    "boundary": boundary,
                    "value": None,
                    "note": None
                }

        # Sort by boundary ascending (latest last)
        goal_data["boundaries"] = dict(sorted(
            goal_data["boundaries"].items(),
            key=lambda x: (
                int(x[0]) if "counter" in partition_type.lower() else datetime.fromisoformat(x[0])
            )
        ))

    response_groups = list(grouped.values())

    return jsonify({
        "user_id": current_user.id,
        "squad_id": squad_id,
        "groups": response_groups
    })


@goal_entries_bp.route('/squads/<squad_id>/goals/entries/day', methods=['GET'])
@login_required
@squad_member_required
def get_squad_entries_for_day(squad_id, squad):
    """Get all squad members' entries for a specific day or date range."""
    date_str = request.args.get("date")
    start_date_str_in = request.args.get("start_date")
    end_date_str_in = request.args.get("end_date")

    # Use parse_date_range helper
    start_date_obj, end_date_obj, error = parse_date_range(
        start_str=start_date_str_in,
        end_str=end_date_str_in,
        single_date=date_str,
        default_to_today=True
    )
    if error:
        return jsonify({"message": error}), 400

    start_date_str = start_date_obj.isoformat()
    end_date_str = end_date_obj.isoformat()

    entries = (
        GoalEntry.query
        .join(User)
        .join(Goal)
        .join(GoalGroup)
        .filter(
            GoalEntry.squad_id == squad.id,
            GoalGroup.partition_type.in_(TIME_BASED_PARTITIONS),
            GoalEntry.boundary_value.between(start_date_str, end_date_str)
        )
        .all()
    )

    grouped = {}
    for entry in entries:
        user_id = entry.user.id
        date_key = entry.boundary_value
        if user_id not in grouped:
            grouped[user_id] = {
                "user_id": user_id,
                "username": entry.user.username,
                "entries": {}
            }

        if date_key not in grouped[user_id]["entries"]:
            grouped[user_id]["entries"][date_key] = []

        grouped[user_id]["entries"][date_key].append(entry.to_dict())

    return jsonify(list(grouped.values())), 200
