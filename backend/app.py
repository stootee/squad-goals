from flask import Flask, request, jsonify, send_from_directory, current_app
from models import db, User, UserProfile, Squad, SquadInvite, SquadMember, GoalEntry, Goal, GlobalGoal, GoalGroup
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
import os
from datetime import datetime, timedelta, date
import secrets
from functools import wraps
from collections import defaultdict
import logging
import sys
import json
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

app = Flask(__name__)

# Force logs to go to stdout
app.logger.addHandler(logging.StreamHandler(sys.stdout))
app.logger.setLevel(logging.INFO)


# ------------------------
# APP CONFIG
# ------------------------

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# secure session cookie setup
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_SAMESITE'] = "Lax"

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)

# CORS for frontend
CORS(
    app, supports_credentials=True, origins=[
        "http://192.168.0.200:5173",
        "http://squagol:5173"
        ]
    )

@app.errorhandler(405)
def method_not_allowed(e):
    app.logger.error(f"405 Method Not Allowed: {request.method} {request.path}")
    return {"error": "Method Not Allowed"}, 405

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
# GOAL UTILITY AND VALIDATION 
# ------------------------

# Define all valid partition types
VALID_PARTITION_TYPES = [
    'Minute', 'Hourly', 'Daily', 'Weekly', 'BiWeekly', 'Monthly', 'CustomCounter'
]

# Define time-based partition types for filtering history queries
TIME_BASED_PARTITIONS = [
    'Minute', 'Hourly', 'Daily', 'Weekly', 'BiWeekly', 'Monthly'
]

# --- HISTORY HELPER FUNCTIONS (New) ---

def step_boundary_back(current_boundary, step, partition_type):
    """Calculates a boundary key 'step' units backward based on partition type."""
    if partition_type == 'CustomCounter':
        try:
            current_value = int(current_boundary)
            return str(current_value - step)
        except ValueError:
            # If the current_boundary is not a valid int, return it unchanged
            return current_boundary 

    try:
        # Assumes boundary is a date string 'YYYY-MM-DD'
        # Convert to datetime object, ignoring time component for daily/weekly/monthly steps
        date_obj = datetime.strptime(current_boundary, '%Y-%m-%d').date()
        
        if partition_type in ['Daily', 'Hourly', 'Minute']:
            delta = timedelta(days=step)
            new_date = date_obj - delta
        elif partition_type in ['Weekly', 'BiWeekly']:
            # Adjust step for weeks
            delta = timedelta(weeks=step)
            new_date = date_obj - delta
        elif partition_type == 'Monthly':
            # Simplified Month Logic
            new_month = date_obj.month - step
            new_year = date_obj.year
            
            # Handle year wraparound
            while new_month < 1:
                new_month += 12
                new_year -= 1
            
            # Use day 1 of the calculated month to maintain consistency
            new_date = date(new_year, new_month, 1)
        else:
            # Default to daily step if partition type is unknown/non-standard date type
            delta = timedelta(days=step)
            new_date = date_obj - delta
        
        return new_date.strftime('%Y-%m-%d')
    except ValueError:
        # Handle cases where boundary_value isn't a parseable date
        return current_boundary

def calculate_boundary_keys(anchor_boundary, partition_type, page, page_size):
    """
    Generates the list of M boundaries for the current page offset.
    
    Returns boundaries sorted from oldest to newest (left-to-right on the grid).
    """
    boundaries = []
    
    # Total number of steps to skip backward to find the newest boundary of the current page
    total_skip_steps = page * page_size
    
    # 1. Determine the newest boundary that should appear in this page
    # This acts as the anchor for the start of this page's time slice
    newest_boundary_of_page = step_boundary_back(anchor_boundary, total_skip_steps, partition_type)

    # 2. Calculate the page boundaries by stepping back (page_size - 1) times from the newest boundary
    for i in range(page_size):
        # i=0 returns the newest boundary for this page. 
        # i=page_size-1 returns the oldest boundary for this page.
        boundary = step_boundary_back(newest_boundary_of_page, i, partition_type)
        boundaries.append(boundary)

    # 3. Reverse to ensure it is [Oldest Boundary, ..., Newest Boundary] for grid rendering
    return boundaries[::-1]

def check_goal_status(goal_type, target, target_max, entry_value):
    """Determines if the goal is met based on type, target, and value."""
    if entry_value is None or entry_value.strip() == '':
        return {"status": "not entered", "value": None}
    
    status = "unmet"
    
    try:
        # Standard Numeric/Comparison Goals
        if goal_type in ['count', 'above', 'below', 'range', 'threshold', 'ratio']:
            value = float(entry_value)
            target = float(target) if target else None

            if goal_type in ['count', 'above', 'threshold', 'ratio']:
                if target is not None and value >= target:
                    status = "met"
            elif goal_type == 'below':
                if target is not None and value <= target:
                    status = "met"
            elif goal_type == 'range':
                target_max = float(target_max) if target_max else None
                if target is not None and target_max is not None and value >= target and value <= target_max:
                    status = "met"

        # Boolean/Achieved Goals
        elif goal_type in ['boolean', 'achieved']:
            if entry_value.lower() in ['true', '1']:
                status = "met"
        
        # Time Goals (Usually always 'met' if a value is entered)
        elif goal_type == 'time':
            status = "met" 
            
    except (ValueError, TypeError):
        # Data conversion failure, treat as unmet or unparseable
        status = "unmet"
        
    return {"status": status, "value": entry_value}

def generate_boundary_series(start_date, end_date, partition_type):
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


def goal_to_dict(goal):
    """Uses the Goal model's to_dict method which now includes GoalGroup info."""
    return goal.to_dict()

# --- END HELPER FUNCTIONS ---

# ------------------------
# AUTHORIZATION DECORATOR
# ------------------------

def squad_member_required(f):
    """Decorator to ensure the current user is a member of the squad."""
    @wraps(f)
    def decorated_function(squad_id, *args, **kwargs):
        squad = Squad.query.get_or_404(squad_id)
        if current_user not in squad.members:
            return jsonify({"message": "Not a squad member"}), 403
        # Pass the retrieved squad object to the view function for efficiency
        return f(squad_id, squad, *args, **kwargs) 
    return decorated_function

# ------------------------
# GOAL GROUP ENDPOINTS
# ------------------------

@app.route("/api/squads/<squad_id>/groups", methods=["GET"])
@login_required
@squad_member_required
def get_goal_groups(squad_id, squad):
    """Retrieve all goal groups for a squad."""
    # Membership is guaranteed by the decorator
    groups = GoalGroup.query.filter_by(squad_id=squad_id).all()
    return jsonify([group.to_dict() for group in groups])


@app.route("/api/squads/<squad_id>/groups", methods=["POST"])
@login_required
def create_goal_group(squad_id):
    """Create a new Goal Group or update an existing one."""
    data = request.get_json()
    
    squad = Squad.query.get_or_404(squad_id)
    if current_user.id != squad.admin_id:
        return jsonify({"error": "Not authorized to manage goals for this squad"}), 403

    group_id = data.get("id")
    group_name = data.get("group_name")
    partition_type = data.get("partition_type")
    
    # --- PARTITION VALIDATION & DATA EXTRACTION ---
    
    if not group_name or not partition_type:
        return jsonify({"error": "Missing required group fields (group_name, partition_type)"}), 400

    # FIX: Ensure partition type is valid
    if partition_type not in VALID_PARTITION_TYPES:
        return jsonify({"error": f"Invalid partition_type: {partition_type}"}), 400
    
    # Initialize variables for storage. If not set conditionally, they remain None.
    partition_label = None
    start_value = None
    end_value = None
    start_date = None
    end_date = None
    
    is_counter = partition_type == 'CustomCounter'

    if is_counter:
        # 1. CUSTOM COUNTER LOGIC (Uses start_value, end_value)
        partition_label = data.get("partition_label")
        start_value = data.get("start_value")
        end_value = data.get("end_value")

        if not partition_label:
            return jsonify({"error": "CustomCounter partition requires a partition_label"}), 400
        
        # Validate and convert to integer
        try:
            # Note: We ensure conversion to int, with a default of 0 if start_value is None
            start_value = int(start_value) if start_value is not None else 0
            # Note: end_value is optional, only convert if provided and not empty
            # The client side uses an inclusive boundary, so we store the max boundary itself.
            end_value = int(end_value) if end_value is not None and str(end_value).strip() != '' else None
            
            # Optional: Add validation that start_value <= end_value if end_value is set
            if end_value is not None and start_value >= end_value:
                return jsonify({"error": "Start value must be less than or equal to end value."}), 400

        except ValueError:
            return jsonify({"error": "CustomCounter start/end values must be integers."}), 400

    else:
        # 2. STANDARDIZED DATE/TIME LOGIC (All time-based types)
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")

        if not start_date_str or not end_date_str:
            return jsonify({"error": "Missing required group fields (start_date, end_date)"}), 400

        try:
            # Use .replace('Z', '+00:00') for robust UTC ISO 8601 parsing.
            start_dt = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            
            start_date = start_dt
            end_date = end_dt

        except (ValueError, AttributeError):
            return jsonify({"error": "Invalid date/datetime format. Use ISO 8601 (YYYY-MM-DDTHH:MM...). "}), 400

        if start_dt >= end_dt:
            return jsonify({"error": "Start date/time must be before end date/time."}), 400
            
    # --- END PARTITION VALIDATION ---

    if group_id:
        group = GoalGroup.query.filter_by(id=group_id, squad_id=squad_id).first()
        if not group:
            return jsonify({"error": f"Goal Group with id {group_id} not found"}), 404
    else:
        group = GoalGroup(squad_id=squad_id)
        db.session.add(group)
    
    # Store the appropriate data. 
    group.group_name = group_name
    group.partition_type = partition_type
    group.partition_label = partition_label
    
    group.start_value = start_value  
    group.end_value = end_value      
    group.start_date = start_date    
    group.end_date = end_date        
    
    db.session.commit()
    
    return jsonify(group.to_dict()), 201 if not group_id else 200


@app.route("/api/squads/<squad_id>/groups/<group_id>", methods=["DELETE"])
@login_required
def delete_goal_group(squad_id, group_id):
    """Delete a Goal Group and cascade delete all associated Goals and GoalEntries."""
    squad = Squad.query.get_or_404(squad_id)
    if current_user.id != squad.admin_id:
        return jsonify({"error": "Not authorized to manage goals for this squad"}), 403

    group = GoalGroup.query.filter_by(id=group_id, squad_id=squad_id).first_or_404()
    
    # The 'cascade="all, delete-orphan"' handles deletion of related Goals and Entries.
    db.session.delete(group)
    db.session.commit()

    return jsonify({"message": f"Goal Group {group_id} and all contained goals deleted"}), 200


# ------------------------
# API ENDPOINTS 
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
    # Assuming the frontend handles this
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
    squad = Squad.query.get_or_404(squad_id)
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
        squad = Squad.query.filter_by(id=squad_id).first()
        if not squad or squad.admin.id != current_user.id:
            return jsonify({"error": "Unauthorized access or squad not found."}), 403

        # 2. Fetch all PENDING invites SENT FROM this squad
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

    # This is for users to see who has invited them
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
@squad_member_required
def get_squad(squad_id, squad):
    # Membership is guaranteed by the decorator
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
@squad_member_required
def api_squad_profiles(squad_id, squad):
    # Membership is guaranteed by the decorator

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


@app.route('/api/squads/<squad_id>/leave', methods=['POST'])
@login_required
@squad_member_required
def leave_squad(squad_id, squad):
    membership = SquadMember.query.filter_by(squad_id=squad_id, user_id=current_user.id).first()
    if not membership:
        # Should be caught by the decorator, but double-check in case of race condition
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
    
    # Deletion of Goals, GoalGroups, and GoalEntries is handled by cascade delete on the Squad model

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
@squad_member_required
def submit_squad_goal_entry(squad_id, squad):
    # Membership is guaranteed by the decorator

    data = request.get_json()
    # Boundary value (date string or counter string) is expected in the "date" field
    boundary_value_input = data.get("date")
    entries_data = data.get("entries", {}) 

    # Treat the input as a string for consistent storage
    if not boundary_value_input:
        return jsonify({"message": "Invalid or missing entry boundary value."}), 400
    
    boundary_value_str = str(boundary_value_input) 

    valid_goal_ids = {str(g.id) for g in Goal.query.filter_by(squad_id=squad.id).all()}

    for goal_id_str, entry_obj in entries_data.items():
        if goal_id_str not in valid_goal_ids:
            print(f"Skipping unknown goal ID: {goal_id_str}")
            continue
        
        value = entry_obj.get("value")
        note = entry_obj.get("note") 

        entry = GoalEntry.query.filter_by(
            user_id=current_user.id,
            squad_id=squad.id,
            goal_id=goal_id_str,
            # Query using the new column name
            boundary_value=boundary_value_str 
        ).first()

        if entry:
            entry.value = value
            entry.note = note
        else:
            db.session.add(GoalEntry(
                user_id=current_user.id,
                squad_id=squad.id,
                goal_id=goal_id_str,
                # Create using the new column name
                boundary_value=boundary_value_str,
                value=value,
                note=note
            ))

    db.session.commit()

    # Return updated entries for the boundary
    entries = GoalEntry.query.filter_by(
        user_id=current_user.id,
        squad_id=squad.id,
        # Query using the new column name
        boundary_value=boundary_value_str 
    ).all()
    return jsonify([entry.to_dict() for entry in entries]), 200


@app.route("/api/squads/<squad_id>/goals/entry", methods=['GET'])
@login_required
@squad_member_required
def get_user_goal_entry_for_date(squad_id, squad):
    # Membership is guaranteed by the decorator

    # Expecting the boundary value (date or counter)
    boundary_value_input = request.args.get("date")
    if not boundary_value_input:
        return jsonify({"message": "Boundary value (date or counter) parameter is required"}), 400

    # Ensure it's a string for querying
    boundary_value_str = str(boundary_value_input)

    # Note: No join is strictly necessary here as we query by exact boundary_value string
    entries = GoalEntry.query.filter_by(
        user_id=current_user.id,
        squad_id=squad.id,
        # Query using the new column name
        boundary_value=boundary_value_str
    ).all()

    return jsonify([entry.to_dict() for entry in entries]), 200

@app.route("/api/squads/<squad_id>/goals/history", methods=["GET"])
@app.route("/api/squads/<squad_id>/goals/history/<group_id>", methods=["GET"])
@login_required
@squad_member_required
def get_goal_history(squad_id, squad, *, group_id=None):
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


@app.route("/api/squads/<squad_id>/goals", methods=["GET"])
@login_required
@squad_member_required
def get_goals(squad_id, squad):
    goals = [goal.to_dict() for goal in squad.goals]
    return jsonify(goals)


@app.route("/api/squads/<squad_id>/goals", methods=["POST"])
@login_required
def update_goals(squad_id):
    """
    Create or update a single goal. New goals MUST specify an existing group_id. 
    Group management is handled by separate group endpoints.
    """
    data = request.get_json()
    g_data = data.get("goals", [None])[0] 

    if not g_data:
        return jsonify({"error": "No goal data provided"}), 400

    squad = Squad.query.get_or_404(squad_id)
    if current_user.id != squad.admin_id:
        return jsonify({"error": "Not authorized to manage goals for this squad"}), 403

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


@app.route("/api/squads/<squad_id>/goals/<goal_id>", methods=["DELETE"])
@login_required
def delete_goal(squad_id, goal_id):
    squad = Squad.query.get_or_404(squad_id)
    if current_user.id != squad.admin_id:
        return jsonify({"error": "Not authorized to manage goals for this squad"}), 403

    goal = Goal.query.filter_by(id=goal_id, squad_id=squad_id).first_or_404()

    db.session.delete(goal)
    db.session.commit()

    return jsonify({"message": f"Goal {goal_id} deleted"}), 200

@app.route('/api/squads/<squad_id>/goals/entries/day', methods=['GET'])
@login_required
@squad_member_required
def get_squad_entries_for_day(squad_id, squad):

    date_str = request.args.get("date")
    start_date_str_in = request.args.get("start_date")
    end_date_str_in = request.args.get("end_date")

    try:
        if start_date_str_in and end_date_str_in:
            start_date_obj = datetime.strptime(start_date_str_in, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date_str_in, "%Y-%m-%d").date()
        elif date_str:
            start_date_obj = end_date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            start_date_obj = end_date_obj = datetime.utcnow().date()
    except ValueError:
        return jsonify({"message": "Invalid date format. Must be YYYY-MM-DD"}), 400

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

# ------------------------
# RUN
# ------------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5050, debug=True)
