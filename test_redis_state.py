#!/usr/bin/env python3

import redis
import os
from dotenv import load_dotenv

def inspect_redis_state():
    load_dotenv()
    
    # Test Redis connection and inspect data
    REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    try:
        # Parse and log the DB index being used
        from urllib.parse import urlparse
        parsed = urlparse(REDIS_URL)
        db_index = parsed.path.lstrip('/') or '0'
        print(f'Connecting to: {REDIS_URL}  (DB index: {db_index})')

        client = redis.from_url(REDIS_URL, decode_responses=True)
        info = client.info()
        print('Redis connected successfully')
        print(f'Redis version: {info.get("redis_version")}')
        
        # Check database info
        db_info = info.get('db', {})
        print(f'Database keys: {db_info}')

        # ── DB Index Consistency Check ──
        print('\n=== DB INDEX CONSISTENCY CHECK ===')
        # Check DB 0 for student keys
        client_db0 = redis.from_url(REDIS_URL.rsplit('/', 1)[0] + '/0', decode_responses=True)
        client_db1 = redis.from_url(REDIS_URL.rsplit('/', 1)[0] + '/1', decode_responses=True)
        
        db0_student_keys = client_db0.keys('student:*')
        db1_student_keys = client_db1.keys('student:*')
        print(f'  DB 0 student:* keys: {len(db0_student_keys)}')
        print(f'  DB 1 student:* keys: {len(db1_student_keys)}')
        
        if db1_student_keys:
            print('  ⚠️  WARNING: student keys found in DB 1 — possible split state!')
            for k in db1_student_keys[:10]:
                print(f'    orphaned: {k}')
        else:
            print('  ✓ No split state detected — all student keys in DB 0')
        
        # Check for canonical student state keys (new schema)
        state_keys = client.keys('student:*:state')
        print(f'\nFound {len(state_keys)} canonical student:*:state keys')
        for key in state_keys[:5]:
            print(f'  {key}')
            data = client.hgetall(key)
            print(f'    Fields: {list(data.keys())}')
            print(f'    Sample data: {data}')

        # Check for legacy keys (pre-migration)
        legacy_base = [k for k in client.keys('student:*') if k.count(':') == 1]
        legacy_weak = client.keys('student:*:weak_concepts')
        legacy_strong = client.keys('student:*:strong_concepts')
        legacy_counts = client.keys('student:*:concept_correct_count')
        print(f'\nLegacy keys remaining:')
        print(f'  student:<id> base keys: {len(legacy_base)}')
        print(f'  weak_concepts sets:     {len(legacy_weak)}')
        print(f'  strong_concepts sets:   {len(legacy_strong)}')
        print(f'  concept_correct_count:  {len(legacy_counts)}')
        
        # Check for quiz session keys
        session_keys = client.keys('quiz_session:*')
        print(f'\nFound {len(session_keys)} quiz session keys')
        
        # Check for knowledge graph keys
        graph_keys = client.keys('knowledge_graph:*')
        print(f'Found {len(graph_keys)} knowledge graph keys')
        
        # Test student model functions
        from engine.services.student_model import get_student, update_student_performance
        
        # Try to get a sample student profile
        test_user_id = "test-audit-user"
        try:
            student_data = get_student(test_user_id)
            print(f'\nTest student data: {student_data}')
            
            # Verify HGETALL works on canonical key
            canonical = client.hgetall(f'student:{test_user_id}:state')
            print(f'HGETALL student:{test_user_id}:state => {canonical}')
        except Exception as e:
            print(f'Error getting test student: {e}')
            
        return True
        
    except Exception as e:
        print(f'Redis connection failed: {e}')
        return False

if __name__ == "__main__":
    inspect_redis_state()
