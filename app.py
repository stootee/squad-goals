# In app.py
from flask import Flask, render_template, redirect, url_for, flash, request, jsonify
from models import db, User, DailyStats  # NEW: Import DailyStats
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'a_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.before_request
def create_tables():
    if not os.path.exists('users.db'):
        with app.app_context():
            db.create_all()


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists. Please choose a different one.', 'danger')
            return redirect(url_for('signup'))
        new_user = User(username=username)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        flash('Account created successfully! Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('profile'))
        else:
            flash('Invalid username or password.', 'danger')
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


@app.route('/profile')
@login_required
def profile():
    return f'Hello, {current_user.username}! This is your profile page.'


# NEW: API endpoint to save daily stats
@app.route('/api/daily_stats', methods=['POST'])
@login_required
def save_daily_stats():
    data = request.get_json()

    date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()

    daily_stat = DailyStats.query.filter_by(user_id=current_user.id, date=date_obj).first()

    if daily_stat:
        # Update existing record
        daily_stat.steps = data.get('steps', daily_stat.steps)
        daily_stat.calories_in = data.get('calories_in', daily_stat.calories_in)
        daily_stat.water_in = data.get('water_in', daily_stat.water_in)
        daily_stat.sleep = data.get('sleep', daily_stat.sleep)
        daily_stat.exercise = data.get('exercise', daily_stat.exercise)
        daily_stat.protein = data.get('protein', daily_stat.protein)
    else:
        # Create a new record
        daily_stat = DailyStats(
            user_id=current_user.id,
            date=date_obj,  # Use the converted date object
            steps=data.get('steps', 0),
            calories_in=data.get('calories_in', 0),
            water_in=data.get('water_in', 0),
            sleep=data.get('sleep', 0.0),
            exercise=data.get('exercise', 0),
            protein=data.get('protein', 0)
        )
        db.session.add(daily_stat)

    db.session.commit()
    return jsonify({"message": "Daily stats saved successfully"}), 200


# NEW: API endpoint to get weekly stats
@app.route('/api/weekly_stats', methods=['GET'])
@login_required
def get_weekly_stats():
    # Calculate the start of the week (e.g., Sunday)
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())  # Monday as start of week

    weekly_stats = DailyStats.query.filter(
        DailyStats.user_id == current_user.id,
        DailyStats.date >= start_of_week
    ).order_by(DailyStats.date).all()

    stats_list = [{
        "date": stat.date.isoformat(),
        "steps": stat.steps,
        "calories_in": stat.calories_in,
        "water_in": stat.water_in,
        "sleep": stat.sleep,
        "exercise": stat.exercise,
        "protein": stat.protein
    } for stat in weekly_stats]

    return jsonify(stats_list)


if __name__ == '__main__':
    app.run(debug=True)