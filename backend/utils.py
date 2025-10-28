"""
Utility functions for the Squad Goals application.

This module contains helper functions for:
- Date and datetime parsing
- Validation (boundaries, counters, partitions)
- Database queries (users, goal entries)
"""

from datetime import datetime, date
from typing import Optional, Tuple, Dict, Any, List, Union
from flask import jsonify, Response
from models import User, GoalEntry

# Type aliases for clarity
ErrorMessage = Optional[str]
JsonResponse = Tuple[Response, int]
PartitionData = Dict[str, Optional[Union[str, int, datetime]]]

# --- DATE & TIME HELPERS ---

def parse_date_range(
    start_str: Optional[str] = None,
    end_str: Optional[str] = None,
    single_date: Optional[str] = None,
    default_to_today: bool = True
) -> Tuple[Optional[date], Optional[date], ErrorMessage]:
    """
    Parse date range with flexible input formats.

    Args:
        start_str: Start date string in YYYY-MM-DD format
        end_str: End date string in YYYY-MM-DD format
        single_date: Single date string in YYYY-MM-DD format
        default_to_today: Whether to default to today if no dates provided

    Returns:
        Tuple of (start_date, end_date, error_message)
    """
    try:
        if start_str and end_str:
            return (
                datetime.strptime(start_str, "%Y-%m-%d").date(),
                datetime.strptime(end_str, "%Y-%m-%d").date(),
                None
            )
        elif single_date:
            date_obj = datetime.strptime(single_date, "%Y-%m-%d").date()
            return date_obj, date_obj, None
        elif default_to_today:
            today = datetime.utcnow().date()
            return today, today, None
        return None, None, "No date provided"
    except ValueError:
        return None, None, "Invalid date format. Must be YYYY-MM-DD"


def parse_iso_datetime_range(
    start_str: str,
    end_str: str
) -> Tuple[Optional[datetime], Optional[datetime], ErrorMessage]:
    """
    Parse ISO 8601 datetime strings and validate range.

    Args:
        start_str: Start datetime in ISO 8601 format
        end_str: End datetime in ISO 8601 format

    Returns:
        Tuple of (start_datetime, end_datetime, error_message)
    """
    try:
        start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
        if start_dt >= end_dt:
            return None, None, "Start date/time must be before end date/time"
        return start_dt, end_dt, None
    except (ValueError, AttributeError):
        return None, None, "Invalid date/datetime format. Use ISO 8601 (YYYY-MM-DDTHH:MM...)"


# --- VALIDATION HELPERS ---

def validate_counter_range(
    start_value: Any,
    end_value: Any
) -> Tuple[Optional[int], Optional[int], ErrorMessage]:
    """
    Validate and convert counter range values.

    Args:
        start_value: Start counter value (can be int, str, or None)
        end_value: End counter value (can be int, str, or None)

    Returns:
        Tuple of (start_int, end_int, error_message)
    """
    try:
        start = int(start_value) if start_value is not None else 0
        end = int(end_value) if end_value is not None and str(end_value).strip() != '' else None

        if end is not None and start >= end:
            return None, None, "Start value must be less than or equal to end value"

        return start, end, None
    except ValueError:
        return None, None, "CustomCounter start/end values must be integers"


def validate_boundary_value(boundary_input: Any) -> Tuple[Optional[str], ErrorMessage]:
    """
    Validate and normalize boundary value input.

    Args:
        boundary_input: Boundary value (date string or counter)

    Returns:
        Tuple of (boundary_string, error_message)
    """
    if not boundary_input:
        return None, "Invalid or missing entry boundary value"
    return str(boundary_input), None


def validate_partition_data(
    partition_type: str,
    data: Dict[str, Any],
    valid_partition_types: List[str]
) -> Tuple[Optional[PartitionData], ErrorMessage]:
    """
    Validate partition-specific data based on type.

    Args:
        partition_type: The partition type (e.g., 'Daily', 'CustomCounter')
        data: Dictionary containing partition configuration
        valid_partition_types: List of valid partition type strings

    Returns:
        Tuple of (validated_data_dict, error_message)
    """
    if partition_type not in valid_partition_types:
        return None, f"Invalid partition_type: {partition_type}"

    if partition_type == 'CustomCounter':
        return validate_counter_partition(data)
    else:
        return validate_time_partition(data)


def validate_counter_partition(data: Dict[str, Any]) -> Tuple[Optional[PartitionData], ErrorMessage]:
    """
    Validate CustomCounter partition data.

    Args:
        data: Dictionary containing partition configuration

    Returns:
        Tuple of (validated_data_dict, error_message)
    """
    partition_label = data.get("partition_label")
    if not partition_label:
        return None, "CustomCounter partition requires a partition_label"

    start_value, end_value, error = validate_counter_range(
        data.get("start_value"),
        data.get("end_value")
    )
    if error:
        return None, error

    return {
        'partition_label': partition_label,
        'start_value': start_value,
        'end_value': end_value,
        'start_date': None,
        'end_date': None
    }, None


def validate_time_partition(data: Dict[str, Any]) -> Tuple[Optional[PartitionData], ErrorMessage]:
    """
    Validate time-based partition data.

    Args:
        data: Dictionary containing partition configuration

    Returns:
        Tuple of (validated_data_dict, error_message)
    """
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")

    if not start_date_str or not end_date_str:
        return None, "Missing required group fields (start_date, end_date)"

    start_dt, end_dt, error = parse_iso_datetime_range(start_date_str, end_date_str)
    if error:
        return None, error

    return {
        'partition_label': None,
        'start_value': None,
        'end_value': None,
        'start_date': start_dt,
        'end_date': end_dt
    }, None


# --- DATABASE QUERY HELPERS ---

def get_user_by_username(username: Optional[str]) -> Tuple[Optional[User], Optional[JsonResponse]]:
    """
    Get user by username.

    Args:
        username: The username to search for

    Returns:
        Tuple of (user_object, error_response)
        If error_response is not None, return it immediately from calling function
    """
    if not username:
        return None, (jsonify({"message": "Username required"}), 400)
    user = User.query.filter_by(username=username).first()
    if not user:
        return None, (jsonify({"message": "User not found"}), 404)
    return user, None


def get_goal_entries(
    user_id: int,
    squad_id: int,
    boundary_value: str,
    goal_id: Optional[str] = None,
    first_only: bool = False
) -> Union[GoalEntry, List[GoalEntry], None]:
    """
    Query goal entries with common filters.

    Args:
        user_id: ID of the user
        squad_id: ID of the squad
        boundary_value: Boundary value (date or counter)
        goal_id: Optional goal ID to filter by
        first_only: Return only first result if True

    Returns:
        Single GoalEntry, list of GoalEntry objects, or None
    """
    query = GoalEntry.query.filter_by(
        user_id=user_id,
        squad_id=squad_id,
        boundary_value=boundary_value
    )
    if goal_id:
        query = query.filter_by(goal_id=goal_id)
    return query.first() if first_only else query.all()


def upsert_goal_entry(
    user_id: int,
    squad_id: int,
    goal_id: str,
    boundary_value: str,
    value: Optional[str],
    note: Optional[str]
) -> GoalEntry:
    """
    Create or update a goal entry.

    Args:
        user_id: ID of the user
        squad_id: ID of the squad
        goal_id: ID of the goal
        boundary_value: Boundary value (date or counter)
        value: Entry value
        note: Entry note

    Returns:
        The created or updated GoalEntry object
    """
    entry = GoalEntry.query.filter_by(
        user_id=user_id,
        squad_id=squad_id,
        goal_id=goal_id,
        boundary_value=boundary_value
    ).first()

    if entry:
        entry.value = value
        entry.note = note
    else:
        entry = GoalEntry(
            user_id=user_id,
            squad_id=squad_id,
            goal_id=goal_id,
            boundary_value=boundary_value,
            value=value,
            note=note
        )
        from models import db
        db.session.add(entry)

    return entry
