from sqlalchemy import Column, String, DateTime, JSON
from datetime import datetime
import uuid
from database import Base

class World(Base):
    __tablename__ = "worlds"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    description = Column(String, default="")
    type = Column(String, default="custom")
    background = Column(String, default="")
    createdAt = Column(String)
    updatedAt = Column(String)

# 👇 注意这里的缩进，Character 是和 World 平级的
class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    world_id = Column(String, index=True) # 归属的世界
    name = Column(String, index=True)
    
    # 01 基础档案
    basic_profile = Column(JSON, default={})
    
    # 02 人格动力结构 (O/V/D/E/T)
    engines = Column(JSON, default={"V": 50, "O": 50, "D": 50, "E": 50, "T": 50})
    
    # 03 运行与防御机制
    defense_mechanisms = Column(JSON, default={})
    
    # 04 现实承载条件
    reality_conditions = Column(JSON, default={})
    
    # 05 思想钢印
    thought_imprints = Column(JSON, default=[])
    
    # 06 生命经历
    life_history = Column(JSON, default=[])
    
    # 07 初始状态
    initial_state = Column(JSON, default={})
    
    created_at = Column(DateTime, default=datetime.utcnow)

# 👇 注意！Relationship 必须顶格，和 Character 平级！
class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    world_id = Column(String, index=True, nullable=True) # 关联世界
    
    source_id = Column(String, index=True) # 起点（比如：人物A的ID）
    target_id = Column(String, index=True) # 终点（比如：人物B的ID）
    
    relation_type = Column(String) # 关系类型：亲属、敌对、同事等
    strength = Column(String, default="一般") # 关系强度
    status = Column(String, default="正常") # 状态：正常、紧张、破裂、解除
    description = Column(String, default="") # 关系描述/依据
    
    created_at = Column(DateTime, default=datetime.utcnow)