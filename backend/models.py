from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, datetime
import uuid 

db = SQLAlchemy()

# Function to generate UUID string
def generate_uuid():
    return str(uuid.uuid4())

class User(UserMixin, db.Model):
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    reset_token = db.Column(db.String(128), nullable=True, unique=True)
    reset_token_expiration = db.Column(db.DateTime, nullable=True)

    profile = db.relationship('UserProfile', backref='user', uselist=False, lazy=True)
    squads = db.relationship(
        'Squad',
        secondary='squad_members',
        back_populates='members'
    )
    goal_entries_received = db.relationship('GoalEntry', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class UserProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    gender = db.Column(db.String(10), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    goal_weight_kg = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            'name': self.name,
            'gender': self.gender,
            'age': self.age,
            'height_cm': self.height_cm,
            'weight_kg': self.weight_kg,
            'goal_weight_kg': self.goal_weight_kg
        }


class Squad(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), unique=True, nullable=False)
    admin_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)

    admin = db.relationship('User', backref='admin_of_squads', foreign_keys=[admin_id])

    members = db.relationship(
        'User',
        secondary='squad_members',
        back_populates='squads'
    )

    invites = db.relationship(
        'SquadInvite',
        back_populates='squad',
        cascade="all, delete-orphan"
    )
    goal_entries = db.relationship("GoalEntry", back_populates="squad", cascade="all, delete-orphan")


class SquadInvite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), nullable=False)
    invited_user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    squad = db.relationship('Squad', back_populates='invites')
    invited_user = db.relationship('User', backref='invites_received')


class SquadMember(db.Model):
    __tablename__ = 'squad_members'
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), primary_key=True)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)


class GlobalGoal(db.Model):
    """Defines canonical, shared goals that can be used across multiple squads."""
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), unique=True, nullable=False)
    type = db.Column(db.String(20), nullable=False) # e.g. 'quantity', 'duration'
    target = db.Column(db.Integer, nullable=True) # Default target
    

class GoalEntry(db.Model):
    __tablename__ = "goal_entries"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), nullable=False)
    goal_id = db.Column(db.String(36), db.ForeignKey('goal.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    value = db.Column(db.Float, default=0.0)

    squad = db.relationship("Squad", back_populates="goal_entries")
    
    __table_args__ = (db.UniqueConstraint(
        'user_id', 'goal_id', 'date', name='_user_goal_date_uc'
    ),)

    # ------------------ Serializer ------------------
    def to_dict(self):
        """Return a dictionary representation of the goal entry."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "squad_id": self.squad_id,
            "goal_id": self.goal_id,
            "goal_name": self.goal.name if self.goal else (self.goal.global_goal.name if self.goal and self.goal.global_goal else None),
            "goal_type": self.goal.type if self.goal else (self.goal.global_goal.type if self.goal and self.goal.global_goal else None),
            "date": self.date.isoformat(),
            "value": self.value
        }


class Goal(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    
    # ------------------ Goal Type Configuration ------------------
    global_goal_id = db.Column(db.String(36), db.ForeignKey('global_goal.id'), nullable=True)
    is_private = db.Column(db.Boolean, nullable=False, default=True) 

    global_goal = db.relationship('GlobalGoal', backref='squad_goals')

    # If is_private=True, these local properties define the goal
    name = db.Column(db.String(100), nullable=True) 
    type = db.Column(db.String(20), nullable=True) 
    target = db.Column(db.Integer, nullable=True) 
    
    # ------------------ Squad and Status ------------------
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True) 

    squad = db.relationship('Squad', backref=db.backref('goals', lazy=True))
    
    entries = db.relationship(
        "GoalEntry", 
        backref="goal", 
        lazy=True, 
        cascade="all, delete-orphan" 
    ) 

    # ------------------ Serializer ------------------
    def to_dict(self):
        """Return a dict representation of the goal, whether global or private."""
        if self.global_goal:
            return {
                "id": self.id,
                "global_goal_id": self.global_goal_id,
                "name": self.global_goal.name,
                "type": self.global_goal.type,
                "target": self.global_goal.target,
                "squad_id": self.squad_id,
                "is_active": self.is_active,
                "is_private": False,
            }
        else:
            return {
                "id": self.id,
                "global_goal_id": None,
                "name": self.name,
                "type": self.type,
                "target": self.target,
                "squad_id": self.squad_id,
                "is_active": self.is_active,
                "is_private": True,
            }
