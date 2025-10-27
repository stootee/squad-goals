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
    goal_entries_received = db.relationship('GoalEntry', back_populates='user', lazy=True)

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

    goals = db.relationship("Goal", back_populates="squad", cascade="all, delete-orphan")
    
    goal_groups = db.relationship("GoalGroup", back_populates="squad", cascade="all, delete-orphan")


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
    
    
# ------------------ Goal Group Model (FIXED) ------------------
class GoalGroup(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), nullable=False)

    # Grouping/Partition Fields
    group_name = db.Column(db.String(255), nullable=False) 
    partition_type = db.Column(db.String(50), nullable=False) 
    partition_label = db.Column(db.String(255), nullable=True) 
    
    # 🌟 FIXED: Date/Time Fields (made nullable for CustomCounter)
    start_date = db.Column(db.DateTime, nullable=True, default=datetime.utcnow) 
    end_date = db.Column(db.DateTime, nullable=True, default=lambda: datetime.utcnow().replace(year=datetime.utcnow().year + 1))
    
    # 🆕 ADDED: Custom Counter Fields
    start_value = db.Column(db.Integer, nullable=True)
    end_value = db.Column(db.Integer, nullable=True)
    
    squad = db.relationship('Squad', back_populates='goal_groups', foreign_keys=[squad_id])
    goals = db.relationship("Goal", back_populates="goal_group", cascade="all, delete-orphan")
    
    def to_dict(self):
        data = {
            "id": self.id,
            "squad_id": self.squad_id,
            "group_name": self.group_name,
            "partition_type": self.partition_type,
            "partition_label": self.partition_label,
            "goal_ids": [g.id for g in self.goals]
        }
        
        # 🌟 FIXED: Conditional serialization based on partition type
        if self.partition_type == 'CustomCounter':
            # Serialize integer values as is
            data["start_value"] = self.start_value
            data["end_value"] = self.end_value
            data["start_date"] = None 
            data["end_date"] = None
        else:
            # Serialize date/time as ISO string with 'Z'
            data["start_date"] = self.start_date.isoformat() + 'Z' if self.start_date else None
            data["end_date"] = self.end_date.isoformat() + 'Z' if self.end_date else None
            data["start_value"] = None
            data["end_value"] = None
            
        return data


class Goal(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    
    # ------------------ Link to Group ------------------
    group_id = db.Column(db.String(36), db.ForeignKey('goal_group.id'), nullable=False)
    goal_group = db.relationship('GoalGroup', back_populates='goals', foreign_keys=[group_id])

    # ------------------ Goal Type Configuration ------------------
    global_goal_id = db.Column(db.String(36), db.ForeignKey('global_goal.id'), nullable=True)
    is_private = db.Column(db.Boolean, nullable=False, default=True) 

    global_goal = db.relationship('GlobalGoal', backref='squad_goals')

    name = db.Column(db.String(100), nullable=True) 
    type = db.Column(db.String(20), nullable=True) 
    
    target = db.Column(db.String(255), nullable=True) 
    target_max = db.Column(db.String(255), nullable=True) 
    
    # ------------------ Squad and Status ------------------
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True) 

    squad = db.relationship('Squad', back_populates='goals', foreign_keys=[squad_id])
    
    entries = db.relationship(
        "GoalEntry", 
        back_populates="goal", 
        lazy=True, 
        cascade="all, delete-orphan" 
    ) 

    # ------------------ Serializer (FIXED) ------------------
    def to_dict(self):
        """Return a dict representation of the goal, whether global or private."""
        data = {
            "id": self.id,
            "squad_id": self.squad_id,
            "is_active": self.is_active,
            "group_id": self.group_id,
        }
        
        # Append partition/group info from the GoalGroup
        if self.goal_group:
            data.update({
                "group_name": self.goal_group.group_name,
                "partition_type": self.goal_group.partition_type,
                "partition_label": self.goal_group.partition_label,
            })
            
            # 🌟 FIXED: Conditional logic for Goal serialization
            if self.goal_group.partition_type == 'CustomCounter':
                # Map value fields to the unified start_date/end_date properties
                # (The frontend expects all partitions to populate these keys)
                data["start_date"] = str(self.goal_group.start_value) if self.goal_group.start_value is not None else None
                data["end_date"] = str(self.goal_group.end_value) if self.goal_group.end_value is not None else None
            else:
                data["start_date"] = self.goal_group.start_date.isoformat() + 'Z' if self.goal_group.start_date else None
                data["end_date"] = self.goal_group.end_date.isoformat() + 'Z' if self.goal_group.end_date else None
        
        if self.global_goal:
            data.update({
                "global_goal_id": self.global_goal_id,
                "name": self.global_goal.name,
                "type": self.global_goal.type,
                "target": self.global_goal.target,
                "target_max": getattr(self.global_goal, 'target_max', None), 
                "is_private": False,
            })
        else:
            data.update({
                "global_goal_id": None,
                "name": self.name,
                "type": self.type,
                "target": self.target,
                "target_max": self.target_max,
                "is_private": True,
            })
        return data


class GoalEntry(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    squad_id = db.Column(db.String(36), db.ForeignKey('squad.id'), nullable=False)
    goal_id = db.Column(db.String(36), db.ForeignKey('goal.id'), nullable=False)
    
    # FIX: Column renamed to boundary_value
    boundary_value = db.Column(db.String(50), nullable=False) 

    value = db.Column(db.String(255), nullable=True) 
    
    note = db.Column(db.String(500), nullable=True) 
    
    squad = db.relationship('Squad', back_populates='goal_entries', foreign_keys=[squad_id])
    goal = db.relationship('Goal', back_populates='entries', foreign_keys=[goal_id])
    user = db.relationship('User', back_populates='goal_entries_received', foreign_keys=[user_id])


    __table_args__ = (
        # Constraint updated to use boundary_value
        db.UniqueConstraint('user_id', 'goal_id', 'boundary_value', name='_user_goal_boundary_uc'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "goal_id": self.goal_id,
            # Returning as 'date' for current frontend compatibility
            "date": self.boundary_value, 
            "value": self.value, 
            "note": self.note,
        }