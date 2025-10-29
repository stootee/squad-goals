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


# --- GOAL STATUS CALCULATION ---

def is_boundary_valid_for_partition(
    boundary_value: str,
    partition_type: str,
    start_value: Union[str, int, datetime]
) -> bool:
    """
    Check if a boundary value is valid for the given partition type.

    For time-based partitions, checks if the boundary aligns with the partition
    interval from the start date.

    For counter-based partitions, always returns True.

    Args:
        boundary_value: The boundary value to check (date string or counter)
        partition_type: The partition type (Daily, Weekly, BiWeekly, Monthly, CustomCounter)
        start_value: The start date/datetime or counter value

    Returns:
        True if the boundary is valid for this partition type, False otherwise
    """
    # Counter-based partitions: all integer boundaries are valid
    is_counter = partition_type is not None and "counter" in str(partition_type).lower()
    if is_counter:
        try:
            int(boundary_value)
            return True
        except ValueError:
            return False

    # Time-based partitions: check alignment with partition interval
    try:
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta

        boundary_date = datetime.fromisoformat(boundary_value)

        # Convert start_value to datetime if it's a string
        if isinstance(start_value, str):
            start_date = datetime.fromisoformat(start_value)
        elif isinstance(start_value, datetime):
            start_date = start_value
        else:
            # Can't validate without proper start date
            return True

        # Calculate the difference
        if partition_type == "Daily":
            # Every day is valid
            return True
        elif partition_type == "Weekly":
            # Check if difference is a multiple of 7 days
            delta_days = (boundary_date - start_date).days
            return delta_days % 7 == 0
        elif partition_type == "BiWeekly":
            # Check if difference is a multiple of 14 days
            delta_days = (boundary_date - start_date).days
            return delta_days % 14 == 0
        elif partition_type == "Monthly":
            # Check if the day matches the start day (same day of month)
            return boundary_date.day == start_date.day
        else:
            # Unknown partition type, accept all boundaries
            return True

    except (ValueError, TypeError, AttributeError):
        # If we can't parse, accept the boundary
        return True


def check_goal_status(
    goal_type: str,
    target: Optional[str],
    target_max: Optional[str],
    entry_value: Optional[str]
) -> str:
    """
    Determines if the goal is met, unmet, or blank based on type, target, and value.

    Args:
        goal_type: The type of goal (count, above, below, range, boolean, achieved, time)
        target: The target value for the goal
        target_max: The maximum target (for range goals)
        entry_value: The actual entry value

    Returns:
        Status string: "met", "unmet", or "blank"
    """
    if entry_value is None or entry_value.strip() == '':
        return "blank"

    status = "unmet"

    try:
        # Standard Numeric/Comparison Goals
        if goal_type in ['count', 'above', 'below', 'range', 'between', 'threshold', 'ratio']:
            value = float(entry_value)
            target_num = float(target) if target else None

            if goal_type in ['count', 'above', 'threshold', 'ratio']:
                if target_num is not None and value >= target_num:
                    status = "met"
            elif goal_type == 'below':
                if target_num is not None and value <= target_num:
                    status = "met"
            elif goal_type in ['range', 'between']:
                target_max_num = float(target_max) if target_max else None
                if target_num is not None and target_max_num is not None:
                    if value >= target_num and value <= target_max_num:
                        status = "met"

        # Boolean/Achieved Goals
        elif goal_type in ['boolean', 'achieved']:
            if entry_value.lower() in ['true', '1', 'yes']:
                status = "met"

        # Time Goals (Usually always 'met' if a value is entered)
        elif goal_type == 'time':
            if entry_value.strip():
                status = "met"

    except (ValueError, TypeError):
        # If conversion fails, mark as unmet
        status = "unmet"

    return status
