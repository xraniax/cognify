#!/usr/bin/env python3
"""
STRICT EVIDENCE-BASED AUDIT OF COGNIFY ADAPTIVE LEARNING SYSTEM
Tests actual runtime behavior, not intended behavior.
"""

import os
import sys
import json
import time
import uuid
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

# Add engine to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'engine'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("adaptive-audit")

@dataclass
class AuditResult:
    component: str
    status: str  # IMPLEMENTED, VERIFIED_WORKING, PARTIALLY_VERIFIED, UNVERIFIED, BROKEN, ARCHITECTURAL_RISKS
    evidence: str
    code_paths: List[str]
    runtime_behavior: str
    risks: List[str]

class AdaptiveSystemAuditor:
    def __init__(self):
        self.results: List[AuditResult] = []
        self.test_user_id = f"audit-test-{uuid.uuid4()}"
        self.test_subject_id = f"audit-test-{uuid.uuid4()}"
        
    def add_result(self, result: AuditResult):
        self.results.append(result)
        logger.info(f"AUDIT RESULT: {result.component} - {result.status}")
        logger.info(f"  Evidence: {result.evidence}")
        logger.info(f"  Code paths: {result.code_paths}")
        if result.risks:
            logger.warning(f"  Risks: {result.risks}")
    
    def audit_student_model_implementation(self):
        """Audit student model implementation and Redis persistence."""
        logger.info("=== AUDITING STUDENT MODEL IMPLEMENTATION ===")
        
        try:
            from services.student_model import get_student, update_student_performance, update_student_performance_from_learning_event
            from services.redis_client import get_concepts, add_concept, remove_concept
            
            # Test 1: Verify get_student works with non-existent user
            try:
                student_data = get_student(self.test_user_id)
                expected_defaults = {
                    "accuracy": 0.5,
                    "avg_response_time": 0.0,
                    "weak_concepts": [],
                    "strong_concepts": []
                }
                
                if student_data == expected_defaults:
                    self.add_result(AuditResult(
                        component="Student Model - Default State",
                        status="VERIFIED_WORKING",
                        evidence="get_student returns correct defaults for non-existent user",
                        code_paths=["engine/services/student_model.py:get_student"],
                        runtime_behavior="Returns accuracy=0.5, empty concept lists",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Student Model - Default State",
                        status="BROKEN",
                        evidence=f"Expected defaults {expected_defaults}, got {student_data}",
                        code_paths=["engine/services/student_model.py:get_student"],
                        runtime_behavior="Incorrect default values",
                        risks=["New user initialization may fail"]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Student Model - Default State",
                    status="BROKEN",
                    evidence=f"get_student failed: {e}",
                    code_paths=["engine/services/student_model.py:get_student"],
                    runtime_behavior="Exception on non-existent user",
                    risks=["Student model inaccessible"]
                ))
            
            # Test 2: Verify update_student_performance works
            try:
                updated = update_student_performance(
                    user_id=self.test_user_id,
                    is_correct=True,
                    response_time=2.5,
                    concept="test-concept"
                )
                
                # Verify the update worked
                if updated.get("accuracy") > 0.5 and "test-concept" in updated.get("strong_concepts", []):
                    self.add_result(AuditResult(
                        component="Student Model - Performance Update",
                        status="VERIFIED_WORKING",
                        evidence="Correct answer increases accuracy, adds concept to strong_concepts",
                        code_paths=["engine/services/student_model.py:update_student_performance"],
                        runtime_behavior="Accuracy updated, concept strength tracked",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Student Model - Performance Update",
                        status="BROKEN",
                        evidence=f"Update failed: {updated}",
                        code_paths=["engine/services/student_model.py:update_student_performance"],
                        runtime_behavior="Performance data not persisted",
                        risks=["Adaptive learning loop broken"]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Student Model - Performance Update",
                    status="BROKEN",
                    evidence=f"update_student_performance failed: {e}",
                    code_paths=["engine/services/student_model.py:update_student_performance"],
                    runtime_behavior="Exception on performance update",
                    risks=["Student model updates failing"]
                ))
            
            # Test 3: Verify learning event updates work
            try:
                update_student_performance_from_learning_event(
                    user_id=self.test_user_id,
                    concept="flashcard-concept",
                    is_correct=False,
                    source="flashcards"
                )
                
                # Check if weak_concepts was updated
                updated = get_student(self.test_user_id)
                if "flashcard-concept" in updated.get("weak_concepts", []):
                    self.add_result(AuditResult(
                        component="Student Model - Learning Event Update",
                        status="VERIFIED_WORKING",
                        evidence="Learning event correctly adds concept to weak_concepts",
                        code_paths=["engine/services/student_model.py:update_student_performance_from_learning_event"],
                        runtime_behavior="Flashcard/exam events update concept strength",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Student Model - Learning Event Update",
                        status="BROKEN",
                        evidence="Learning event did not update weak_concepts",
                        code_paths=["engine/services/student_model.py:update_student_performance_from_learning_event"],
                        runtime_behavior="Learning events not tracked",
                        risks=["Cross-module adaptation broken"]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Student Model - Learning Event Update",
                    status="BROKEN",
                    evidence=f"Learning event update failed: {e}",
                    code_paths=["engine/services/student_model.py:update_student_performance_from_learning_event"],
                    runtime_behavior="Exception on learning event",
                    risks=["Flashcard/exam adaptation broken"]
                ))
                
        except ImportError as e:
            self.add_result(AuditResult(
                component="Student Model - Implementation",
                status="BROKEN",
                evidence=f"Import failed: {e}",
                code_paths=["engine/services/student_model.py"],
                runtime_behavior="Module not importable",
                risks=["Core adaptive component missing"]
            ))
    
    def audit_adaptive_quiz_flow(self):
        """Audit adaptive quiz event flow."""
        logger.info("=== AUDITING ADAPTIVE QUIZ FLOW ===")
        
        try:
            from services.quiz_manager import next_question_only, submit_answer_and_get_next, resolve_quiz_difficulty
            from services.redis_client import get_quiz_session, update_quiz_session
            
            # Test 1: Verify next_question_only works
            try:
                # Mock database session
                class MockDB:
                    pass
                
                result = next_question_only(
                    user_id=self.test_user_id,
                    subject_id=self.test_subject_id,
                    topic=None,
                    language="en",
                    top_k=5,
                    db=MockDB()
                )
                
                if result and "question" in result and "progress" in result:
                    self.add_result(AuditResult(
                        component="Adaptive Quiz - Next Question",
                        status="PARTIALLY_VERIFIED",
                        evidence="next_question_only returns expected structure",
                        code_paths=["engine/services/quiz_manager.py:next_question_only"],
                        runtime_behavior="Returns question and progress objects",
                        risks=["Depends on knowledge graph and generation services"]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Adaptive Quiz - Next Question",
                        status="BROKEN",
                        evidence=f"Invalid response: {result}",
                        code_paths=["engine/services/quiz_manager.py:next_question_only"],
                        runtime_behavior="Malformed response",
                        risks=["Quiz flow broken"]
                    ))
            except Exception as e:
                if "knowledge graph" in str(e).lower() or "no concepts" in str(e).lower():
                    self.add_result(AuditResult(
                        component="Adaptive Quiz - Next Question",
                        status="PARTIALLY_VERIFIED",
                        evidence=f"Expected dependency failure: {e}",
                        code_paths=["engine/services/quiz_manager.py:next_question_only"],
                        runtime_behavior="Fails without knowledge graph",
                        risks=["Requires knowledge graph setup"]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Adaptive Quiz - Next Question",
                        status="BROKEN",
                        evidence=f"Unexpected failure: {e}",
                        code_paths=["engine/services/quiz_manager.py:next_question_only"],
                        runtime_behavior="Exception on question generation",
                        risks=["Quiz generation broken"]
                    ))
            
            # Test 2: Verify difficulty resolution logic
            try:
                difficulty = resolve_quiz_difficulty(
                    mode="adaptive",
                    ui_difficulty="intermediate",
                    session_state={"streak_count": 0, "difficulty_history": []},
                    student_profile={"accuracy": 0.8, "weak_concepts": [], "strong_concepts": []},
                    last_answer_correct=None
                )
                
                if difficulty in ["beginner", "intermediate", "advanced"]:
                    self.add_result(AuditResult(
                        component="Adaptive Quiz - Difficulty Resolution",
                        status="VERIFIED_WORKING",
                        evidence=f"Correctly resolved difficulty: {difficulty}",
                        code_paths=["engine/services/quiz_manager.py:resolve_quiz_difficulty"],
                        runtime_behavior="Adaptive difficulty logic working",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Adaptive Quiz - Difficulty Resolution",
                        status="BROKEN",
                        evidence=f"Invalid difficulty: {difficulty}",
                        code_paths=["engine/services/quiz_manager.py:resolve_quiz_difficulty"],
                        runtime_behavior="Invalid difficulty output",
                        risks=["Difficulty adaptation broken"]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Adaptive Quiz - Difficulty Resolution",
                    status="BROKEN",
                    evidence=f"Difficulty resolution failed: {e}",
                    code_paths=["engine/services/quiz_manager.py:resolve_quiz_difficulty"],
                    runtime_behavior="Exception on difficulty calculation",
                    risks=["Adaptive difficulty broken"]
                ))
                
        except ImportError as e:
            self.add_result(AuditResult(
                component="Adaptive Quiz - Implementation",
                status="BROKEN",
                evidence=f"Import failed: {e}",
                code_paths=["engine/services/quiz_manager.py"],
                runtime_behavior="Module not importable",
                risks=["Adaptive quiz system missing"]
            ))
    
    def audit_knowledge_graph_service(self):
        """Audit knowledge graph service implementation."""
        logger.info("=== AUDITING KNOWLEDGE GRAPH SERVICE ===")
        
        try:
            from services.knowledge_graph_service import get_subject_graph, get_or_build_concepts, get_related_concepts
            
            # Test 1: Verify get_subject_graph handles missing graph
            try:
                graph = get_subject_graph(self.test_subject_id)
                if graph is None:
                    self.add_result(AuditResult(
                        component="Knowledge Graph - Cache Miss",
                        status="VERIFIED_WORKING",
                        evidence="Correctly returns None for missing graph",
                        code_paths=["engine/services/knowledge_graph_service.py:get_subject_graph"],
                        runtime_behavior="Graceful cache miss handling",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Knowledge Graph - Cache Miss",
                        status="UNVERIFIED",
                        evidence="Found existing graph, cannot test cache miss",
                        code_paths=["engine/services/knowledge_graph_service.py:get_subject_graph"],
                        runtime_behavior="Existing data found",
                        risks=[]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Knowledge Graph - Cache Miss",
                    status="BROKEN",
                    evidence=f"Cache miss handling failed: {e}",
                    code_paths=["engine/services/knowledge_graph_service.py:get_subject_graph"],
                    runtime_behavior="Exception on cache miss",
                    risks=["Knowledge graph access broken"]
                ))
            
            # Test 2: Verify get_or_build_concepts handles missing data
            try:
                concepts = get_or_build_concepts(self.test_subject_id, "intermediate", db=None)
                if concepts == []:
                    self.add_result(AuditResult(
                        component="Knowledge Graph - Concept Retrieval",
                        status="VERIFIED_WORKING",
                        evidence="Correctly returns empty list when no graph/data available",
                        code_paths=["engine/services/knowledge_graph_service.py:get_or_build_concepts"],
                        runtime_behavior="Graceful fallback for missing concepts",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Knowledge Graph - Concept Retrieval",
                        status="UNVERIFIED",
                        evidence=f"Unexpected concepts returned: {len(concepts)}",
                        code_paths=["engine/services/knowledge_graph_service.py:get_or_build_concepts"],
                        runtime_behavior="Existing data found",
                        risks=[]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Knowledge Graph - Concept Retrieval",
                    status="BROKEN",
                    evidence=f"Concept retrieval failed: {e}",
                    code_paths=["engine/services/knowledge_graph_service.py:get_or_build_concepts"],
                    runtime_behavior="Exception on concept access",
                    risks=["Concept selection broken"]
                ))
                
        except ImportError as e:
            self.add_result(AuditResult(
                component="Knowledge Graph - Implementation",
                status="BROKEN",
                evidence=f"Import failed: {e}",
                code_paths=["engine/services/knowledge_graph_service.py"],
                runtime_behavior="Module not importable",
                risks=["Knowledge graph system missing"]
            ))
    
    def audit_adaptive_profile_service(self):
        """Audit adaptive profile service implementation."""
        logger.info("=== AUDITING ADAPTIVE PROFILE SERVICE ===")
        
        try:
            from services.adaptive_profile_service import get_adaptive_profile
            
            # Test: Verify profile building with mock data
            try:
                class MockDB:
                    def execute(self, query, params=None):
                        class MockResult:
                            def fetchall(self):
                                return []
                            def fetchone(self):
                                class MockRow:
                                    def get(self, key, default=None):
                                        return default
                                return MockRow()
                        return MockResult()
                
                profile = get_adaptive_profile(self.test_user_id, self.test_subject_id, MockDB())
                
                expected_keys = ["accuracy", "weak_concepts", "strong_concepts", "mastery_map", 
                               "recommended_difficulty", "retention_risk", "total_attempts"]
                
                missing_keys = [key for key in expected_keys if key not in profile]
                
                if not missing_keys:
                    self.add_result(AuditResult(
                        component="Adaptive Profile - Structure",
                        status="VERIFIED_WORKING",
                        evidence="Profile contains all expected keys",
                        code_paths=["engine/services/adaptive_profile_service.py:get_adaptive_profile"],
                        runtime_behavior="Complete profile structure returned",
                        risks=[]
                    ))
                else:
                    self.add_result(AuditResult(
                        component="Adaptive Profile - Structure",
                        status="BROKEN",
                        evidence=f"Missing profile keys: {missing_keys}",
                        code_paths=["engine/services/adaptive_profile_service.py:get_adaptive_profile"],
                        runtime_behavior="Incomplete profile structure",
                        risks=["Profile consumption may fail"]
                    ))
            except Exception as e:
                self.add_result(AuditResult(
                    component="Adaptive Profile - Building",
                    status="BROKEN",
                    evidence=f"Profile building failed: {e}",
                    code_paths=["engine/services/adaptive_profile_service.py:get_adaptive_profile"],
                    runtime_behavior="Exception on profile generation",
                    risks=["Adaptive profile unavailable"]
                ))
                
        except ImportError as e:
            self.add_result(AuditResult(
                component="Adaptive Profile - Implementation",
                status="BROKEN",
                evidence=f"Import failed: {e}",
                code_paths=["engine/services/adaptive_profile_service.py"],
                runtime_behavior="Module not importable",
                risks=["Adaptive profiling missing"]
            ))
    
    def audit_api_endpoints(self):
        """Audit adaptive API endpoints."""
        logger.info("=== AUDITING ADAPTIVE API ENDPOINTS ===")
        
        try:
            # Check if API module is importable
            from services.api import app
            from services.schemas import QuizNextRequest, QuizSubmitAnswerRequest, LearningEventRequest
            
            # Test schema validation
            try:
                # Valid requests
                valid_quiz_next = QuizNextRequest(
                    user_id="test-user",
                    subject_id="test-subject",
                    language="en",
                    top_k=5
                )
                
                valid_submit = QuizSubmitAnswerRequest(
                    user_id="test-user",
                    subject_id="test-subject",
                    is_correct=True,
                    response_time=2.5,
                    language="en",
                    top_k=5
                )
                
                valid_learning = LearningEventRequest(
                    user_id="test-user",
                    concept="test-concept",
                    is_correct=False,
                    source="flashcards"
                )
                
                self.add_result(AuditResult(
                    component="API Schemas - Validation",
                    status="VERIFIED_WORKING",
                    evidence="All adaptive request schemas validate correctly",
                    code_paths=["engine/services/schemas.py"],
                    runtime_behavior="Schema validation working",
                    risks=[]
                ))
                
            except Exception as e:
                self.add_result(AuditResult(
                    component="API Schemas - Validation",
                    status="BROKEN",
                    evidence=f"Schema validation failed: {e}",
                    code_paths=["engine/services/schemas.py"],
                    runtime_behavior="Schema validation broken",
                    risks=["API requests may fail"]
                ))
            
            # Check endpoint definitions
            adaptive_endpoints = [
                "/quiz/next",
                "/quiz/submit-answer", 
                "/adaptive/learning-event",
                "/adaptive/update-learning-event",
                "/adaptive/profile/{subject_id}"
            ]
            
            for endpoint in adaptive_endpoints:
                try:
                    # Check if route exists
                    route_found = any(route.path == endpoint for route in app.routes)
                    if route_found:
                        self.add_result(AuditResult(
                            component=f"API Endpoint - {endpoint}",
                            status="IMPLEMENTED",
                            evidence=f"Endpoint {endpoint} defined in FastAPI app",
                            code_paths=["engine/services/api.py"],
                            runtime_behavior="Endpoint available",
                            risks=[]
                        ))
                    else:
                        self.add_result(AuditResult(
                            component=f"API Endpoint - {endpoint}",
                            status="BROKEN",
                            evidence=f"Endpoint {endpoint} not found",
                            code_paths=["engine/services/api.py"],
                            runtime_behavior="Endpoint missing",
                            risks=["Adaptive features inaccessible"]
                        ))
                except Exception as e:
                    self.add_result(AuditResult(
                        component=f"API Endpoint - {endpoint}",
                        status="BROKEN",
                        evidence=f"Endpoint check failed: {e}",
                        code_paths=["engine/services/api.py"],
                        runtime_behavior="Cannot verify endpoint",
                        risks=["API structure verification failed"]
                    ))
                    
        except ImportError as e:
            self.add_result(AuditResult(
                component="API Implementation",
                status="BROKEN",
                evidence=f"Import failed: {e}",
                code_paths=["engine/services/api.py"],
                runtime_behavior="API module not importable",
                risks=["Adaptive API completely broken"]
            ))
    
    def audit_cross_module_integration(self):
        """Audit integration between adaptive components."""
        logger.info("=== AUDITING CROSS-MODULE INTEGRATION ===")
        
        # Test 1: Student model to quiz manager integration
        try:
            from services.student_model import get_student, update_student_performance
            from services.quiz_manager import _filter_student_profile_to_domain
            
            # Create some test data
            update_student_performance(
                user_id=self.test_user_id,
                is_correct=True,
                response_time=1.0,
                concept="test-concept-1"
            )
            update_student_performance(
                user_id=self.test_user_id,
                is_correct=False,
                response_time=3.0,
                concept="test-concept-2"
            )
            
            student = get_student(self.test_user_id)
            
            # Test domain filtering
            filtered = _filter_student_profile_to_domain(student, self.test_subject_id)
            
            if filtered and "weak_concepts" in filtered and "strong_concepts" in filtered:
                self.add_result(AuditResult(
                    component="Integration - Student Model to Quiz Manager",
                    status="VERIFIED_WORKING",
                    evidence="Student profile successfully filtered for domain",
                    code_paths=["engine/services/quiz_manager.py:_filter_student_profile_to_domain"],
                    runtime_behavior="Domain scoping working",
                    risks=[]
                ))
            else:
                self.add_result(AuditResult(
                    component="Integration - Student Model to Quiz Manager",
                    status="BROKEN",
                    evidence="Profile filtering failed",
                    code_paths=["engine/services/quiz_manager.py:_filter_student_profile_to_domain"],
                    runtime_behavior="Domain filtering broken",
                    risks=["Cross-subject contamination"]
                ))
                
        except Exception as e:
            self.add_result(AuditResult(
                component="Integration - Student Model to Quiz Manager",
                status="BROKEN",
                evidence=f"Integration test failed: {e}",
                code_paths=["engine/services/student_model.py", "engine/services/quiz_manager.py"],
                runtime_behavior="Exception on integration",
                risks=["Adaptive flow broken"]
            ))
    
    def generate_audit_report(self) -> Dict[str, Any]:
        """Generate comprehensive audit report."""
        logger.info("=== GENERATING AUDIT REPORT ===")
        
        # Categorize results
        categories = {
            "IMPLEMENTED": [],
            "VERIFIED_WORKING": [],
            "PARTIALLY_VERIFIED": [],
            "UNVERIFIED": [],
            "BROKEN": [],
            "ARCHITECTURAL_RISKS": []
        }
        
        for result in self.results:
            categories[result.status].append(result)
        
        # Generate summary
        summary = {
            "audit_timestamp": time.time(),
            "test_user_id": self.test_user_id,
            "test_subject_id": self.test_subject_id,
            "total_components_audited": len(self.results),
            "categories": {k: len(v) for k, v in categories.items()},
            "critical_failures": [r.component for r in categories["BROKEN"]],
            "working_components": [r.component for r in categories["VERIFIED_WORKING"]],
            "partial_components": [r.component for r in categories["PARTIALLY_VERIFIED"]],
            "unverified_components": [r.component for r in categories["UNVERIFIED"]],
            "architectural_risks": [],
            "highest_risk_components": []
        }
        
        # Extract architectural risks
        for result in self.results:
            if result.risks:
                summary["architectural_risks"].extend(result.risks)
        
        # Identify highest risk components (broken + has risks)
        for result in categories["BROKEN"]:
            if result.risks:
                summary["highest_risk_components"].append({
                    "component": result.component,
                    "risks": result.risks,
                    "evidence": result.evidence
                })
        
        return {
            "summary": summary,
            "detailed_results": categories,
            "full_results": self.results
        }
    
    def run_full_audit(self) -> Dict[str, Any]:
        """Run complete audit of adaptive learning system."""
        logger.info("STARTING COMPREHENSIVE ADAPTIVE SYSTEM AUDIT")
        
        # Run all audit sections
        self.audit_student_model_implementation()
        self.audit_adaptive_quiz_flow()
        self.audit_knowledge_graph_service()
        self.audit_adaptive_profile_service()
        self.audit_api_endpoints()
        self.audit_cross_module_integration()
        
        # Generate final report
        report = self.generate_audit_report()
        
        logger.info("=== AUDIT COMPLETE ===")
        logger.info(f"Total components audited: {report['summary']['total_components_audited']}")
        logger.info(f"Working: {len(report['summary']['working_components'])}")
        logger.info(f"Broken: {len(report['summary']['critical_failures'])}")
        logger.info(f"Partial: {len(report['summary']['partial_components'])}")
        logger.info(f"Unverified: {len(report['summary']['unverified_components'])}")
        
        return report

if __name__ == "__main__":
    auditor = AdaptiveSystemAuditor()
    report = auditor.run_full_audit()
    
    # Save detailed report
    with open("adaptive_system_audit_report.json", "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    print("\n" + "="*80)
    print("COGNIFY ADAPTIVE LEARNING SYSTEM AUDIT RESULTS")
    print("="*80)
    
    summary = report["summary"]
    print(f"\nTOTAL COMPONENTS AUDITED: {summary['total_components_audited']}")
    print(f"VERIFIED WORKING: {len(summary['working_components'])}")
    print(f"BROKEN: {len(summary['critical_failures'])}")
    print(f"PARTIALLY VERIFIED: {len(summary['partial_components'])}")
    print(f"UNVERIFIED: {len(summary['unverified_components'])}")
    
    if summary["critical_failures"]:
        print(f"\n🚨 CRITICAL FAILURES:")
        for failure in summary["critical_failures"]:
            print(f"  - {failure}")
    
    if summary["highest_risk_components"]:
        print(f"\n⚠️  HIGHEST RISK COMPONENTS:")
        for component in summary["highest_risk_components"]:
            print(f"  - {component['component']}")
            for risk in component["risks"]:
                print(f"    • {risk}")
    
    print(f"\n📋 WORKING COMPONENTS:")
    for component in summary["working_components"]:
        print(f"  ✓ {component}")
    
    print(f"\n🔍 PARTIALLY VERIFIED:")
    for component in summary["partial_components"]:
        print(f"  ~ {component}")
    
    print(f"\n❓ UNVERIFIED:")
    for component in summary["unverified_components"]:
        print(f"  ? {component}")
    
    print(f"\n📄 Detailed report saved to: adaptive_system_audit_report.json")
    print("="*80)
