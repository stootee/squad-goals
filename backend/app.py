from flask import Flask, request, jsonify, send_from_directory
from models import db, User, UserProfile, Squad, SquadInvite, SquadMember, GoalEntry, Goal, GlobalGoal
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
import os
from datetime import datetime, timedelta
import secrets

# ------------------------
# APP CONFIG
# ------------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# secure session cookie setup
app.config['SESSION_COOKIE_HTTPONLY'] = True
# app.config['SESSION_COOKIE_SAMESITE'] = "None"
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = "Lax"


db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)

# CORS for frontend
CORS(
    app, supports_credentials=True, origins=[
        "http://127.0.0.1:5173", 
        "http://localhost:5173", 
        "http://0.0.0.0:5173", 
        "http://192.168.0.200:5173",
        "http://squagol:5173"
        ]
    )

# ------------------------
# USER LOADER
# ------------------------
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

# Return JSON 401 instead of redirect
@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized"}), 401

# ------------------------
# AUTO-CREATE DB
# ------------------------
@app.before_request
def create_tables():
    if not os.path.exists('users.db'):
        with app.app_context():
            db.create_all()

# ------------------------
# API ENDPOINTS (Non-squad endpoints omitted for brevity, assuming they are unchanged)
# ------------------------
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 409

    new_user = User(username=username)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Account created successfully!"}), 201


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        login_user(user, remember=data.get('remember-me', False))
        return jsonify({"message": "Login successful"}), 200
    return jsonify({"message": "Invalid username or password."}), 401


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200


@app.route('/api/profile', methods=['GET', 'POST'])
@login_required
def api_profile():
    if request.method == 'POST':
        data = request.get_json()
        profile = UserProfile.query.filter_by(user_id=current_user.id).first()
        if not profile:
            profile = UserProfile(user_id=current_user.id)
            db.session.add(profile)

        for field in ['name', 'gender', 'age', 'height_cm', 'weight_kg', 'goal_weight_kg']:
            if field in data:
                setattr(profile, field, data[field])

        db.session.commit()

        return jsonify({
            "message": "Profile saved and goals calculated!",
            "calorie_goal": 0,
            "protein_goal": 0
        }), 200

    profile = UserProfile.query.filter_by(user_id=current_user.id).first()
    if profile:
        return jsonify({
            "name": profile.name,
            "gender": profile.gender,
            "age": profile.age,
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "goal_weight_kg": profile.goal_weight_kg
        }), 200
    return jsonify({}), 200


@app.route('/api/user_info', methods=['GET'])
@login_required
def api_user_info():
    return jsonify({'username': current_user.username}), 200


# ------------------------
# PASSWORD RESET
# ------------------------
@app.route('/api/forgot_password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expiration = datetime.now() + timedelta(minutes=15)
        db.session.commit()
        return jsonify({
            "message": "Password reset token generated.",
            "token": token
        }), 200
    return jsonify({"message": "User not found."}), 404


@app.route('/api/reset_password/<token>', methods=['POST'])
def reset_password(token):
    user = User.query.filter_by(reset_token=token).first()
    if not user or user.reset_token_expiration < datetime.now():
        return jsonify({"message": "Invalid or expired token."}), 400

    data = request.get_json()
    user.set_password(data.get('password'))
    user.reset_token = None
    user.reset_token_expiration = None
    db.session.commit()
    return jsonify({"message": "Password has been reset successfully."}), 200


@app.route('/api/reset_password/<token>', methods=['GET'])
def serve_reset_password_page(token):
    return send_from_directory('../frontend', 'reset_password.html')


# ------------------------
# SQUADS
# ------------------------
@app.route('/api/squads', methods=['POST'])
@login_required
def create_squad():
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


@app.route('/api/squads/<squad_id>/invite', methods=['POST'])
@login_required
def invite_user(squad_id):
    squad = Squad.query.get(squad_id)
    if not squad:
        return jsonify({"message": "Squad not found"}), 404

    if squad.admin_id != current_user.id:
        return jsonify({"message": "Only the admin can invite"}), 403

    data = request.get_json()
    username = data.get("username")
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"message": "User not found"}), 404
    
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


@app.route('/api/invites', methods=['GET'])
@login_required
def api_invites():
    # This is for admins to see who they've invited from a specific squad
    squad_id = request.args.get('squad_id')
    
    if squad_id:
        # 1. Verify the current user is an admin of the requested squad
        # Assuming your Squad model has a relationship to the admin User object
        squad = Squad.query.filter_by(id=squad_id).first()
        if not squad or squad.admin.id != current_user.id:
            return jsonify({"error": "Unauthorized access or squad not found."}), 403

        # 2. Fetch all PENDING invites SENT FROM this squad
        outbound_invites = SquadInvite.query.filter_by(squad_id=squad_id, status='pending').all()
        
        result = []
        for i in outbound_invites:
            # Need to look up the invited user's username
            invited_user = User.query.get(i.invited_user_id) 
            
            result.append({
                "id": i.id,
                "squad_name": squad.name,
                "squad_id": squad_id,
                "invited_username": invited_user.username if invited_user else "Unknown User",
                "status": i.status
            })
        
        return jsonify(result)

    # This is for users to see who has invited them
    invites = SquadInvite.query.filter_by(invited_user_id=current_user.id, status='pending').all()
    result = []
    for i in invites:
        if i.squad:
            # Note: Checking for i.squad.admin ensures the squad still exists and has an admin
            admin_username = i.squad.admin.username if i.squad.admin else "Unknown Admin"

            result.append({
                "id": i.id,
                "squad": i.squad.name,
                "squad_id": i.squad_id,
                "invited_by": admin_username,
                "status": i.status
            })
            
    return jsonify(result)


@app.route('/api/invites/<int:invite_id>', methods=['DELETE'])
@login_required
def rescind_invite(invite_id):
    # Retrieve the pending invite by its ID
    invite = SquadInvite.query.filter_by(id=invite_id, status='pending').first()
    
    if not invite:
        return jsonify({"message": "Invite not found or already accepted/rejected."}), 404
    
    # Check if the current user is the admin of the squad that sent the invite
    squad = Squad.query.get(invite.squad_id)
    if not squad or squad.admin.id != current_user.id:
        # 403 Forbidden is the correct status here
        return jsonify({"error": "Unauthorized to rescind this invite."}), 403
    
    # Rescind the invite by deleting it from the database
    db.session.delete(invite)
    db.session.commit()
    
    return jsonify({"message": f"Invite to {invite.invited_user.username} successfully rescinded."}), 200


@app.route('/api/invites/<invite_id>/respond', methods=['POST'])
@login_required
def respond_invite(invite_id):
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


@app.route('/api/squads/<squad_id>', methods=['GET'])
@login_required
def get_squad(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    
    if current_user not in squad.members:
        return jsonify({"message": "You are not a member of this squad and cannot view its details."}), 403
    
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


@app.route('/api/squads/<squad_id>/profiles', methods=['GET'])
@login_required
def api_squad_profiles(squad_id):
    squad = Squad.query.filter_by(id=squad_id).first()
    if not squad:
        return jsonify({"error": "Squad not found."}), 404

    member_usernames = [member.username for member in squad.members]
    if current_user.username not in member_usernames:
        return jsonify({"error": "Access denied. Not a member of this squad."}), 403

    # 2. Get the list of all usernames in the squad
    # We already have member_usernames from the check above

    # 3. Find the User records matching the usernames
    # The 'User' model is required here to link username to user_id
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


@app.route('/api/squads/<squad_id>/leave', methods=['POST'])
@login_required
def leave_squad(squad_id):
    membership = SquadMember.query.filter_by(squad_id=squad_id, user_id=current_user.id).first()
    if not membership:
        return jsonify({"message": "You are not a member of this squad"}), 404

    db.session.delete(membership)
    db.session.commit()
    return jsonify({"message": "You left the squad"}), 200


@app.route('/api/squads/<squad_id>/remove_member', methods=['POST'])
@login_required
def remove_member(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    
    if squad.admin_id != current_user.id:
        return jsonify({"message": "Only the admin can remove members"}), 403

    data = request.get_json()
    username_to_remove = data.get("username")
    
    if username_to_remove == squad.admin.username:
        return jsonify({"message": "Cannot remove the squad administrator"}), 400

    user_to_remove = User.query.filter_by(username=username_to_remove).first()
    if not user_to_remove:
        return jsonify({"message": "User not found"}), 404

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


@app.route('/api/squads/<squad_id>', methods=['DELETE'])
@login_required
def delete_squad(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    if squad.admin_id != current_user.id:
        return jsonify({"message": "Only the admin can delete the squad"}), 403

    SquadMember.query.filter_by(squad_id=squad.id).delete()
    SquadInvite.query.filter_by(squad_id=squad.id).delete()
    
    Goal.query.filter_by(squad_id=squad.id).delete()
    GoalEntry.query.filter_by(squad_id=squad.id).delete() 

    db.session.delete(squad)
    db.session.commit()

    return jsonify({"message": "Squad deleted"}), 200


@app.route('/api/squads', methods=['GET'])
@login_required
def get_user_squads():
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


# ----------------------------------------------
# GOAL ENTRY & HISTORY
# ----------------------------------------------
@app.route('/api/squads/<squad_id>/goals/entry', methods=['POST'])
@login_required
def submit_squad_goal_entry(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403

    data = request.get_json()
    date_str = data.get("date")
    values = data.get("values", {})  # keys should now be goal IDs

    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return jsonify({"message": "Invalid date format"}), 400

    # Fetch all valid goal IDs for this squad
    valid_goal_ids = {str(g.id) for g in Goal.query.filter_by(squad_id=squad.id).all()}

    for goal_id_str, value in values.items():
        if goal_id_str not in valid_goal_ids:
            print(f"Skipping unknown goal ID: {goal_id_str}")
            continue

        entry = GoalEntry.query.filter_by(
            user_id=current_user.id,
            squad_id=squad.id,
            goal_id=goal_id_str,
            date=date_obj
        ).first()

        if entry:
            entry.value = value
        else:
            db.session.add(GoalEntry(
                user_id=current_user.id,
                squad_id=squad.id,
                goal_id=goal_id_str,
                date=date_obj,
                value=value
            ))

    db.session.commit()

    # Return updated entries for the date
    entries = GoalEntry.query.filter_by(
        user_id=current_user.id,
        squad_id=squad.id,
        date=date_obj
    ).all()
    return jsonify([entry.to_dict() for entry in entries]), 200


@app.route('/api/squads/<squad_id>/goals/entries', methods=['GET'])
@login_required
def get_squad_goal_history(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403

    week_start = request.args.get("start_date")
    if week_start:
        try:
            start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"message": "Invalid start_date"}), 400
    else:
        start_date = datetime.now().date() - timedelta(days=6)

    end_date = start_date + timedelta(days=6)

    entries = GoalEntry.query.join(Goal).filter(
        GoalEntry.squad_id == squad.id,
        GoalEntry.user_id == current_user.id,
        GoalEntry.date >= start_date,
        GoalEntry.date <= end_date
    ).all()

    return jsonify([entry.to_dict() for entry in entries]), 200


@app.route("/api/squads/<squad_id>/goals/entry", methods=['GET'])
@login_required
def get_user_goal_entry_for_date(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403

    date_str = request.args.get("date")
    if not date_str:
        return jsonify({"message": "Date parameter is required"}), 400

    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "Invalid date format"}), 400

    entries = GoalEntry.query.filter_by(
        user_id=current_user.id,
        squad_id=squad.id,
        date=date_obj
    ).all()

    return jsonify([entry.to_dict() for entry in entries]), 200


@app.route("/api/squads/<squad_id>/goals", methods=["GET"])
@login_required
def get_goals(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403
    goals = [g.to_dict() for g in squad.goals]
    return jsonify(goals)


@app.route("/api/squads/<squad_id>/goals", methods=["POST"])
@login_required
def update_goals(squad_id):
    """
    Create or update a single goal for a squad.
    - If `id` is provided, the goal is updated.
    - Otherwise, a new goal is created.
    """
    data = request.get_json()
    g_data = data.get("goals")[0] # expect a single goal object

    if not g_data:
        return jsonify({"error": "No goal data provided"}), 400

    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403

    if current_user.id != squad.admin_id:
        return jsonify({"error": "Not authorized to manage goals for this squad"}), 403

    goal_id = g_data.get("id", None)
    is_private = g_data.get("is_private", True)

    if goal_id:
        goal = Goal.query.filter_by(id=goal_id, squad_id=squad_id, is_active=True).first()
        if not goal:
            return jsonify({"error": f"Goal with id {goal_id} not found"}), 404
    else:
        goal = Goal(squad_id=squad_id, is_active=True)
        db.session.add(goal)

    goal.is_private = is_private

    if is_private:
        goal.global_goal_id = None
        goal.name = g_data["name"]
        goal.type = g_data["type"]
        goal.target = g_data.get("target")
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

    db.session.commit()

    return jsonify([goal.to_dict()]), 200


@app.route("/api/squads/<squad_id>/goals/<goal_id>", methods=["DELETE"])
@login_required
def delete_goal(squad_id, goal_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403

    if current_user.id != squad.admin_id:
        return jsonify({"error": "Not authorized to manage goals for this squad"}), 403

    goal = Goal.query.filter_by(id=goal_id, squad_id=squad_id).first_or_404()

    db.session.delete(goal)
    db.session.commit()

    return jsonify({"message": f"Goal {goal_id} deleted"}), 200


@app.route('/api/squads/<squad_id>/goals/entries/day', methods=['GET'])
@login_required
def get_squad_entries_for_day(squad_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user not in squad.members:
        return jsonify({"message": "Not a squad member"}), 403

    date_str = request.args.get("date")
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    try:
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        elif date_str:
            start_date = end_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            # Default to current date
            start_date = end_date = datetime.utcnow().date()
    except ValueError:
        return jsonify({"message": "Invalid date format"}), 400

    entries = (
        GoalEntry.query
        .join(User)
        .filter(
            GoalEntry.squad_id == squad.id,
            GoalEntry.date.between(start_date, end_date)
        )
        .all()
    )

    grouped = {}
    for entry in entries:
        user_id = entry.user.id
        date_key = entry.date.isoformat()

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

# ------------------------
# RUN
# ------------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5050, debug=True)