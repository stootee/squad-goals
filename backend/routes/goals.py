"""
Goal and goal group routes for Squad Goals application.

Handles:
- Goal group CRUD operations
- Goal CRUD operations
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required

from models import db, Goal, GlobalGoal, GoalGroup
from decorators import squad_member_required, squad_admin_required
from utils import validate_partition_data

goals_bp = Blueprint('goals', __name__)

# Valid partition types - imported from app context
VALID_PARTITION_TYPES = [
    'Minute', 'Hourly', 'Daily', 'Weekly', 'BiWeekly', 'Monthly', 'CustomCounter'
]


@goals_bp.route("/squads/<squad_id>/groups", methods=["GET"])
@login_required
@squad_member_required
def get_goal_groups(squad_id, squad):
    """Retrieve all goal groups for a squad."""
    groups = GoalGroup.query.filter_by(squad_id=squad_id).all()
    return jsonify([group.to_dict() for group in groups])


@goals_bp.route("/squads/<squad_id>/groups", methods=["POST"])
@login_required
@squad_admin_required
def create_goal_group(squad_id, squad):
    """Create a new Goal Group or update an existing one."""
    data = request.get_json()

    group_id = data.get("id")
    group_name = data.get("group_name")
    partition_type = data.get("partition_type")

    if not group_name or not partition_type:
        return jsonify({"error": "Missing required group fields (group_name, partition_type)"}), 400

    # Validate partition data using helper
    validated_data, error = validate_partition_data(partition_type, data, VALID_PARTITION_TYPES)
    if error:
        return jsonify({"error": error}), 400

    if group_id:
        group = GoalGroup.query.filter_by(id=group_id, squad_id=squad_id).first()
        if not group:
            return jsonify({"error": f"Goal Group with id {group_id} not found"}), 404
    else:
        group = GoalGroup(squad_id=squad_id)
        db.session.add(group)

    # Store the data
    group.group_name = group_name
    group.partition_type = partition_type
    group.partition_label = validated_data['partition_label']
    group.start_value = validated_data['start_value']
    group.end_value = validated_data['end_value']
    group.start_date = validated_data['start_date']
    group.end_date = validated_data['end_date']

    db.session.commit()

    return jsonify(group.to_dict()), 201 if not group_id else 200


@goals_bp.route("/squads/<squad_id>/groups/<group_id>", methods=["DELETE"])
@login_required
@squad_admin_required
def delete_goal_group(squad_id, squad, group_id):
    """Delete a Goal Group and cascade delete all associated Goals and GoalEntries."""
    group = GoalGroup.query.filter_by(id=group_id, squad_id=squad_id).first_or_404()

    # The 'cascade="all, delete-orphan"' handles deletion of related Goals and Entries.
    db.session.delete(group)
    db.session.commit()

    return jsonify({"message": f"Goal Group {group_id} and all contained goals deleted"}), 200


@goals_bp.route("/squads/<squad_id>/goals", methods=["GET"])
@login_required
@squad_member_required
def get_goals(squad_id, squad):
    """Get all goals for a squad."""
    goals = [goal.to_dict() for goal in squad.goals]
    return jsonify(goals)


@goals_bp.route("/squads/<squad_id>/goals", methods=["POST"])
@login_required
@squad_admin_required
def update_goals(squad_id, squad):
    """
    Create or update a single goal. New goals MUST specify an existing group_id.
    Group management is handled by separate group endpoints.
    """
    data = request.get_json()
    g_data = data.get("goals", [None])[0]

    if not g_data:
        return jsonify({"error": "No goal data provided"}), 400

    goal_id = g_data.get("id", None)
    group_id = g_data.get("group_id")
    is_private = g_data.get("is_private", True)

    goal = None
    if goal_id:
        goal = Goal.query.filter_by(id=goal_id, squad_id=squad_id, is_active=True).first()
        if not goal:
            return jsonify({"error": f"Goal with id {goal_id} not found"}), 404
        if group_id and goal.group_id != group_id:
             return jsonify({"error": "Goal group_id cannot be changed after creation."}), 400

    else:
        if not group_id:
            return jsonify({"error": "New goals must provide an existing group_id."}), 400

        group = GoalGroup.query.filter_by(id=group_id, squad_id=squad_id).first()
        if not group:
            return jsonify({"error": f"Goal Group with id {group_id} not found for this squad"}), 404

        goal = Goal(squad_id=squad_id, is_active=True, group_id=group_id)
        db.session.add(goal)

    goal.is_private = is_private

    if is_private:
        goal.global_goal_id = None
        goal.name = g_data["name"]
        goal.type = g_data["type"]
        goal.target = g_data.get("target")
        goal.target_max = g_data.get("target_max")
    else:
        global_id = g_data.get("global_goal_id")
        if not global_id:
            return jsonify({"error": "Global goal ID required for global goals"}), 400
        global_goal = GlobalGoal.query.get(global_id)
        if not global_goal:
            return jsonify({"error": f"Global Goal ID {global_id} not found"}), 400
        goal.global_goal_id = global_id

        goal.name = None
        goal.type = None
        goal.target = g_data.get("target")
        goal.target_max = g_data.get("target_max")

    db.session.commit()

    return jsonify([goal.to_dict()]), 200


@goals_bp.route("/squads/<squad_id>/goals/<goal_id>", methods=["DELETE"])
@login_required
@squad_admin_required
def delete_goal(squad_id, squad, goal_id):
    """Delete a goal."""
    goal = Goal.query.filter_by(id=goal_id, squad_id=squad_id).first_or_404()

    db.session.delete(goal)
    db.session.commit()

    return jsonify({"message": f"Goal {goal_id} deleted"}), 200
