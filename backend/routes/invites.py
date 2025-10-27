"""
Squad invitation routes for Squad Goals application.

Handles:
- Viewing invites (sent and received)
- Responding to invites (accept/decline)
- Rescinding invites
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import db, User, Squad, SquadInvite, SquadMember

invites_bp = Blueprint('invites', __name__)


@invites_bp.route('/invites', methods=['GET'])
@login_required
def get_invites():
    """
    Get invites for the current user.
    If squad_id parameter is provided, returns outbound invites for that squad (admin only).
    Otherwise, returns inbound invites for the current user.
    """
    squad_id = request.args.get('squad_id')

    if squad_id:
        # Admin view: Get all pending invites sent from this squad
        squad = Squad.query.filter_by(id=squad_id).first()
        if not squad or squad.admin.id != current_user.id:
            return jsonify({"error": "Unauthorized access or squad not found."}), 403

        outbound_invites = SquadInvite.query.filter_by(squad_id=squad_id, status='pending').all()

        result = []
        for i in outbound_invites:
            invited_user = User.query.get(i.invited_user_id)

            result.append({
                "id": i.id,
                "squad_name": squad.name,
                "squad_id": squad_id,
                "invited_username": invited_user.username if invited_user else "Unknown User",
                "status": i.status
            })

        return jsonify(result)

    # User view: Get all pending invites received by the current user
    invites = SquadInvite.query.filter_by(invited_user_id=current_user.id, status='pending').all()
    result = []
    for i in invites:
        if i.squad:
            admin_username = i.squad.admin.username if i.squad.admin else "Unknown Admin"

            result.append({
                "id": i.id,
                "squad": i.squad.name,
                "squad_id": i.squad_id,
                "invited_by": admin_username,
                "status": i.status
            })

    return jsonify(result)


@invites_bp.route('/invites/<int:invite_id>', methods=['DELETE'])
@login_required
def rescind_invite(invite_id):
    """Rescind a pending invite (admin only)."""
    invite = SquadInvite.query.filter_by(id=invite_id, status='pending').first()

    if not invite:
        return jsonify({"message": "Invite not found or already accepted/rejected."}), 404

    # Check if the current user is the admin of the squad that sent the invite
    squad = Squad.query.get(invite.squad_id)
    if not squad or squad.admin.id != current_user.id:
        return jsonify({"error": "Unauthorized to rescind this invite."}), 403

    # Rescind the invite by deleting it from the database
    db.session.delete(invite)
    db.session.commit()

    return jsonify({"message": f"Invite to {invite.invited_user.username} successfully rescinded."}), 200


@invites_bp.route('/invites/<invite_id>/respond', methods=['POST'])
@login_required
def respond_invite(invite_id):
    """Accept or decline an invite."""
    invite = SquadInvite.query.get_or_404(invite_id)
    if invite.invited_user_id != current_user.id:
        return jsonify({"message": "Not authorized"}), 403

    squad = Squad.query.get(invite.squad_id)
    if not squad:
        db.session.delete(invite)
        db.session.commit()
        return jsonify({"message": "This squad no longer exists"}), 400

    data = request.get_json()
    response = data.get("response")

    if response == "accept":
        already_member = SquadMember.query.filter_by(
            squad_id=invite.squad_id, user_id=current_user.id
        ).first()
        if not already_member:
            membership = SquadMember(squad_id=invite.squad_id, user_id=current_user.id)
            db.session.add(membership)
        invite.status = "accepted"
    elif response == "decline":
        invite.status = "declined"
    else:
        return jsonify({"message": "Invalid response"}), 400

    db.session.commit()
    return jsonify({"message": f"Invite {response}ed"}), 200
