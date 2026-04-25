import sqlite3

# 连接到数据库
conn = sqlite3.connect('app.db')
cursor = conn.cursor()

# 插入测试模型数据
test_models = [
    ('GPT-4 Vision', 'gpt-4-vision-preview', None, None, 'text', 'enabled', True),
    ('Claude 3 Opus', 'claude-3-opus-20240229', None, None, 'text', 'enabled', False),
    ('Gemini Pro', 'gemini-pro', None, None, 'text', 'enabled', False)
]

# 插入数据
cursor.executemany('''
    INSERT INTO ai_configs (name, model_id, api_key, api_base, model_type, status, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)
''', test_models)

# 提交并关闭连接
conn.commit()
conn.close()

print("测试模型数据已添加成功！")