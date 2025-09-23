from flask import Flask, request, jsonify, send_from_directory
from models import db, User, DailyStats, UserProfile
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
app.config['SESSION_COOKIE_SAMESITE'] = "Lax"

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)

# CORS for frontend at :8000
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:8000"])

# ------------------------
# USER LOADER
# ------------------------
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

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
# FRONTEND SERVING
# ------------------------
# @app.route('/')
# @app.route('/<path:filename>')
# def serve_frontend(filename='index.html'):
#     return send_from_directory('../frontend', filename)


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

        # Update profile fields
        for field in ['name', 'gender', 'age', 'height_cm', 'weight_kg', 'goal_weight_kg']:
            if field in data:
                setattr(profile, field, data[field])

        db.session.commit()

        # Calculate goals
        if profile.gender == 'male':
            bmr = 88.362 + (13.397 * profile.weight_kg) + (4.799 * profile.height_cm) - (5.677 * profile.age)
        else:
            bmr = 447.593 + (9.247 * profile.weight_kg) + (3.098 * profile.height_cm) - (4.330 * profile.age)

        maintenance_calories = bmr * 1.55
        calorie_deficit = maintenance_calories - 500
        protein_intake = profile.goal_weight_kg * 2.2

        return jsonify({
            "message": "Profile saved and goals calculated!",
            "calorie_goal": round(calorie_deficit),
            "protein_goal": round(protein_intake)
        }), 200

    # GET profile
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


@app.route('/api/daily_stats', methods=['POST'])
@login_required
def save_daily_stats():
    data = request.get_json()
    date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()
    daily_stat = DailyStats.query.filter_by(user_id=current_user.id, date=date_obj).first()

    if daily_stat:
        for field in ['steps', 'calories_in', 'water_in', 'sleep', 'exercise', 'protein']:
            if field in data:
                setattr(daily_stat, field, data[field])
    else:
        daily_stat = DailyStats(user_id=current_user.id, date=date_obj, **{
            k: data.get(k, 0) for k in ['steps', 'calories_in', 'water_in', 'sleep', 'exercise', 'protein']
        })
        db.session.add(daily_stat)

    db.session.commit()
    return jsonify({"message": "Daily stats saved successfully"}), 200


@app.route('/api/daily_stats', methods=['GET'])
@login_required
def get_daily_stats():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"message": "Date parameter is required"}), 400

    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Invalid date format"}), 400

    daily_stat = DailyStats.query.filter_by(user_id=current_user.id, date=date_obj).first()
    if not daily_stat:
        return jsonify({}), 200

    return jsonify({
        "steps": daily_stat.steps,
        "calories_in": daily_stat.calories_in,
        "water_in": daily_stat.water_in,
        "sleep": daily_stat.sleep,
        "exercise": daily_stat.exercise,
        "protein": daily_stat.protein
    }), 200



@app.route('/api/weekly_stats', methods=['GET'])
@login_required
def get_weekly_stats():
    today = datetime.now().date()
    start_date = today - timedelta(days=6)  # last 7 days including today

    weekly_stats = DailyStats.query.filter(
        DailyStats.user_id == current_user.id,
        DailyStats.date >= start_date
    ).order_by(DailyStats.date).all()

    return jsonify([{
        "date": stat.date.isoformat(),
        "steps": stat.steps,
        "calories_in": stat.calories_in,
        "water_in": stat.water_in,
        "sleep": stat.sleep,
        "exercise": stat.exercise,
        "protein": stat.protein
    } for stat in weekly_stats])


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
    user.reset_token_exp = None
    db.session.commit()
    return jsonify({"message": "Password has been reset successfully."}), 200


@app.route('/api/reset_password/<token>', methods=['GET'])
def serve_reset_password_page(token):
    return send_from_directory('../frontend', 'reset_password.html')


# ------------------------
# RUN
# ------------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
