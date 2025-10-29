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
    check_goal_status,
    upsert_goal_entry,
    parse_date_range,
    is_boundary_valid_for_partition
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
    Supports pagination with page and page_size query parameters.
    """
    # Get pagination parameters
    page = request.args.get('page', 0, type=int)
    page_size = request.args.get('page_size', 7, type=int)

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
            "groups": [],
            "total_pages": 0
        }), 200

    grouped = defaultdict(lambda: {
        "goal_id": None,
        "goal_name": None,
        "goal_type": None,
        "goal_target": None,
        "goal_target_max": None,
        "partition_type": None,
        "start_value": None,
        "boundaries": {}
    })

    # --- Step 1: Collect all entries and goal metadata, filtering by valid boundaries ---
    for entry in entries:
        goal = entry.goal
        if not goal:
            continue
        gid = goal.id

        if grouped[gid]["goal_id"] is None:
            grouped[gid]["goal_id"] = gid
            grouped[gid]["goal_name"] = goal.name
            grouped[gid]["goal_type"] = goal.type
            grouped[gid]["goal_target"] = goal.target
            grouped[gid]["goal_target_max"] = goal.target_max
            grouped[gid]["partition_type"] = goal.goal_group.partition_type if goal.goal_group else None

            # Safely extract start_value based on partition type
            if goal.goal_group:
                partition_type_str = str(goal.goal_group.partition_type).lower() if goal.goal_group.partition_type else ""
                if "counter" in partition_type_str:
                    grouped[gid]["start_value"] = goal.goal_group.start_value
                else:
                    grouped[gid]["start_value"] = goal.goal_group.start_date.isoformat() if goal.goal_group.start_date else None
            else:
                grouped[gid]["start_value"] = None

        # FILTER: Only include entries with boundaries valid for current partition type
        partition_type = grouped[gid]["partition_type"]
        start_value = grouped[gid]["start_value"]

        if not is_boundary_valid_for_partition(
            str(entry.boundary_value),
            partition_type,
            start_value
        ):
            # Skip this entry - it doesn't align with the current partition type
            continue

        # Calculate status using check_goal_status
        status = check_goal_status(
            goal.type,
            goal.target,
            goal.target_max,
            entry.value
        )

        grouped[gid]["boundaries"][str(entry.boundary_value)] = {
            "entry_id": entry.id,
            "boundary": str(entry.boundary_value),
            "value": entry.value,
            "note": entry.note,
            "status": status
        }

    # --- Step 2: Generate boundary lists from group start/end dates ---
    # All goals in the same group should share the same boundary range
    for goal_data in grouped.values():
        # Skip if this goal has no group information
        if goal_data["goal_id"] is None:
            continue

        # Get the goal's group to access start/end dates
        goal = Goal.query.get(goal_data["goal_id"])
        if not goal or not goal.goal_group:
            continue

        goal_group = goal.goal_group
        partition_type = goal_data["partition_type"]
        start_value = goal_data["start_value"]

        is_counter = partition_type is not None and "counter" in str(partition_type).lower()

        # DEBUG: Log partition detection
        print(f"\n=== Processing goal: {goal_data.get('goal_name')} ===")
        print(f"Partition type: {partition_type}")
        print(f"Is counter: {is_counter}")
        print(f"Start value: {start_value}")
        print(f"Group end value: {goal_group.end_value if is_counter else goal_group.end_date}")

        # Store is_counter flag for use in pagination step
        goal_data["is_counter"] = is_counter

        # Generate all boundaries from group start to group end
        if is_counter:
            try:
                start = int(start_value or goal_group.start_value or 1)

                # If no end_value is configured, use the maximum boundary from existing entries
                if goal_group.end_value is not None:
                    end = int(goal_group.end_value)
                else:
                    # Use the max boundary from existing entries, or default to start
                    existing_boundaries = [int(b) for b in goal_data["boundaries"].keys() if b.isdigit()]
                    end = max(existing_boundaries) if existing_boundaries else start

                all_boundaries = [str(i) for i in range(start, end + 1)]
                print(f"Counter boundaries: {start} to {end} ({len(all_boundaries)} total)")
            except (ValueError, TypeError) as e:
                # If conversion fails, use existing boundaries only
                print(f"ERROR: Cannot parse counter values for goal '{goal_data.get('goal_name')}': {e}")
                all_boundaries = sorted(goal_data["boundaries"].keys())
                is_counter = False
                goal_data["is_counter"] = False
        else:
            try:
                start_date = datetime.fromisoformat(start_value)
                # Use group's end_date, but cap at today's date to exclude future dates
                end_date = goal_group.end_date
                today = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)

                if end_date:
                    # Use the earlier of: group end date or today
                    effective_end_date = min(end_date, today)

                    # Only generate boundaries if start is not in the future
                    if start_date <= today:
                        all_boundaries = generate_boundary_series(start_date, effective_end_date, partition_type)
                        print(f"Date boundaries: {start_date.date()} to {effective_end_date.date()} ({len(all_boundaries)} total)")
                    else:
                        # Start date is in the future, no history to show
                        all_boundaries = []
                        print(f"Start date {start_date.date()} is in the future - no boundaries to display")
                else:
                    # No end date specified, use only existing boundaries
                    all_boundaries = sorted(goal_data["boundaries"].keys())
                    print(f"No end date - using {len(all_boundaries)} existing boundaries")
            except (ValueError, TypeError) as e:
                print(f"ERROR: Cannot parse dates for goal '{goal_data.get('goal_name')}': {e}")
                all_boundaries = sorted(goal_data["boundaries"].keys())

        # Fill missing boundaries with blanks
        for boundary in all_boundaries:
            if boundary not in goal_data["boundaries"]:
                goal_data["boundaries"][boundary] = {
                    "entry_id": None,
                    "boundary": boundary,
                    "value": None,
                    "note": None,
                    "status": "blank"
                }

        # Sort by boundary ascending (latest last)
        goal_data["boundaries"] = dict(sorted(
            goal_data["boundaries"].items(),
            key=lambda x: (
                int(x[0]) if is_counter else datetime.fromisoformat(x[0])
            )
        ))

    # --- Step 3: Apply pagination ---
    for goal_data in grouped.values():
        all_boundary_keys = list(goal_data["boundaries"].keys())
        total_boundaries = len(all_boundary_keys)
        total_pages = (total_boundaries + page_size - 1) // page_size if page_size > 0 else 1

        # Calculate slice indices (newest first, so reverse)
        # Page 0 = newest entries
        all_boundary_keys.reverse()
        start_idx = page * page_size
        end_idx = start_idx + page_size
        paginated_keys = all_boundary_keys[start_idx:end_idx]

        # Filter boundaries to only include paginated keys
        goal_data["boundaries"] = {k: goal_data["boundaries"][k] for k in reversed(paginated_keys) if k in goal_data["boundaries"]}
        goal_data["total_pages"] = total_pages

        # Clean up temporary flag (only if it exists)
        if "is_counter" in goal_data:
            del goal_data["is_counter"]

    response_groups = list(grouped.values())

    # Get total pages from first group (all should be same)
    total_pages = response_groups[0]["total_pages"] if response_groups else 0

    return jsonify({
        "user_id": current_user.id,
        "squad_id": squad_id,
        "groups": response_groups,
        "total_pages": total_pages
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
