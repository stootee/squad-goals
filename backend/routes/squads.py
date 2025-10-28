"""
Squad management routes for Squad Goals application.

Handles:
- Squad CRUD operations
- Member management (add, remove, leave)
- Squad profiles
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import db, User, UserProfile, Squad, SquadMember, SquadInvite
from decorators import squad_member_required, squad_admin_required
from utils import get_user_by_username

squads_bp = Blueprint('squads', __name__)


@squads_bp.route('/squads', methods=['POST'])
@login_required
def create_squad():
    """Create a new squad."""
    data = request.get_json()
    name = data.get('name')

    if Squad.query.filter_by(name=name).first():
        return jsonify({"message": "Squad name already taken"}), 400

    squad = Squad(name=name, admin_id=current_user.id)
    db.session.add(squad)
    db.session.commit()

    # Auto-add creator as member
    membership = SquadMember(squad_id=squad.id, user_id=current_user.id)
    db.session.add(membership)
    db.session.commit()

    return jsonify({"message": "Squad created!", "squad_id": squad.id}), 201


@squads_bp.route('/squads', methods=['GET'])
@login_required
def get_user_squads():
    """Get all squads for the current user."""
    squads = current_user.squads
    result = []
    for squad in squads:
        result.append({
            "id": squad.id,
            "name": squad.name,
            "admin": squad.admin.username,
            "is_admin": squad.admin_id == current_user.id,
            "members": len(squad.members)
        })
    return jsonify(result), 200


@squads_bp.route('/squads/<squad_id>', methods=['GET'])
@login_required
@squad_member_required
def get_squad(squad_id, squad):
    """Get squad details."""
    members_list = []
    for member in squad.members:
        members_list.append({"username": member.username, "name": member.username})

    return jsonify({
        "id": squad.id,
        "name": squad.name,
        "admin": squad.admin.username,
        "members": members_list,
        "is_admin": squad.admin_id == current_user.id
    })


@squads_bp.route('/squads/<squad_id>', methods=['DELETE'])
@login_required
@squad_admin_required
def delete_squad(squad_id, squad):
    """Delete a squad (admin only)."""
    SquadMember.query.filter_by(squad_id=squad.id).delete()
    SquadInvite.query.filter_by(squad_id=squad.id).delete()

    # Deletion of Goals, GoalGroups, and GoalEntries is handled by cascade delete on the Squad model
    db.session.delete(squad)
    db.session.commit()

    return jsonify({"message": "Squad deleted"}), 200


@squads_bp.route('/squads/<squad_id>/members', methods=['GET'])
@login_required
@squad_member_required
def squad_profiles(squad_id, squad):
    """Get profiles for all squad members."""
    member_usernames = [member.username for member in squad.members]
    users = User.query.filter(User.username.in_(member_usernames)).all()
    user_ids = [u.id for u in users]

    profiles = UserProfile.query.filter(UserProfile.user_id.in_(user_ids)).all()

    profile_data_list = []

    user_map = {u.id: u.username for u in users}
    profile_map = {p.user_id: p.name for p in profiles}

    for user_id, username in user_map.items():
        configured_name = profile_map.get(user_id)

        profile_entry = {
            "username": username,
            "configured_name": configured_name if configured_name else None
        }
        profile_data_list.append(profile_entry)

    return jsonify(profile_data_list), 200


@squads_bp.route('/squads/<squad_id>/invite', methods=['POST'])
@login_required
@squad_admin_required
def invite_user(squad_id, squad):
    """Invite a user to join the squad (admin only)."""
    data = request.get_json()
    username = data.get("username")

    user, error = get_user_by_username(username)
    if error:
        return error

    if user in squad.members:
        return jsonify({"message": f"{username} is already a member of this squad."}), 400

    existing_invite = SquadInvite.query.filter_by(
        squad_id=squad.id, invited_user_id=user.id, status="pending"
    ).first()
    if existing_invite:
        return jsonify({"message": "User already invited"}), 400

    invite = SquadInvite(squad_id=squad.id, invited_user_id=user.id)
    db.session.add(invite)
    db.session.commit()

    return jsonify({"message": f"Invite sent to {username}!"}), 201


@squads_bp.route('/squads/<squad_id>/leave', methods=['POST'])
@login_required
@squad_member_required
def leave_squad(squad_id, squad):
    """Leave a squad."""
    membership = SquadMember.query.filter_by(squad_id=squad_id, user_id=current_user.id).first()
    if not membership:
        return jsonify({"message": "You are not a member of this squad"}), 404

    db.session.delete(membership)
    db.session.commit()
    return jsonify({"message": "You left the squad"}), 200


@squads_bp.route('/squads/<squad_id>/members/<username>', methods=['DELETE'])
@login_required
@squad_admin_required
def delete_member(squad_id, squad, username):
    """Remove a member from the squad (admin only)."""

    # Prevent admin from removing themselves
    if username == squad.admin.username:
        return jsonify({"message": "Cannot remove the squad administrator"}), 400

    # Look up the user
    user_to_remove, error = get_user_by_username(username)
    if error:
        return error  # get_user_by_username likely returns a tuple (user, response)

    # Check membership
    membership = SquadMember.query.filter_by(
        squad_id=squad_id,
        user_id=user_to_remove.id
    ).first()

    if not membership:
        return jsonify({"message": f"{username} is not a member of this squad"}), 404

    # Remove membership and any pending invites
    db.session.delete(membership)
    SquadInvite.query.filter_by(
        squad_id=squad_id,
        invited_user_id=user_to_remove.id,
        status='pending'
    ).delete()

    db.session.commit()
    return jsonify({"message": f"{username} has been removed from the squad"}), 200


@squads_bp.route('/squads/<squad_id>/remove_member', methods=['POST'])
@login_required
@squad_admin_required
def remove_member(squad_id, squad):
    """Remove a member from the squad (admin only)."""
    data = request.get_json()
    username_to_remove = data.get("username")

    if username_to_remove == squad.admin.username:
        return jsonify({"message": "Cannot remove the squad administrator"}), 400

    user_to_remove, error = get_user_by_username(username_to_remove)
    if error:
        return error

    membership = SquadMember.query.filter_by(
        squad_id=squad_id,
        user_id=user_to_remove.id
    ).first()

    if not membership:
        return jsonify({"message": f"{username_to_remove} is not a member of this squad"}), 404

    db.session.delete(membership)

    SquadInvite.query.filter_by(
        squad_id=squad_id,
        invited_user_id=user_to_remove.id,
        status='pending'
    ).delete()

    db.session.commit()
    return jsonify({"message": f"{username_to_remove} has been removed from the squad"}), 200
