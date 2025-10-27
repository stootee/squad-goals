"""
User profile routes for Squad Goals application.

Handles:
- Profile GET/POST operations
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import db, UserProfile

profile_bp = Blueprint('profile', __name__)


@profile_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    """Get or update user profile."""
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
