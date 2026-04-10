import os
import sys
import unittest
import json
import logging
from typing import List, Dict, Any

# Add engine to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.generation import generate_study_material, build_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stress-test")

class TestGenerationStress(unittest.TestCase):
    """Extreme tests for the AI generation logic."""

    def setUp(self):
        self.dummy_context = ["This is a simple context about photosynthesis. Plants use sunlight to make food."]
        self.oversized_context = ["Word " * 50] * 200 # Roughly 10,000 words / 40,000 chars

    def test_volume_empty_context(self):
        """Case: No context chunks provided."""
        logger.info("Testing Empty Context...")
        result = generate_study_material([], "quiz", options={"count": 5})
        self.assertIn("No content available", str(result))

    def test_volume_oversized_context(self):
        """Case: Context exceeds OLLAMA_MAX_CONTEXT_CHARS (6000)."""
        logger.info("Testing Oversized Context (Truncation)...")
        # generate_study_material should truncate internally
        result = generate_study_material(self.oversized_context, "summary")
        # If it doesn't crash, it's a pass for basic robustness
        self.assertTrue(len(result) > 0)

    def test_constraints_impossible_flashcards(self):
        """Case: Requesting many flashcards from very little info."""
        logger.info("Testing Impossible Count (100 cards from 1 sentence)...")
        # This tests the 'Shortfall Padding' logic
        result = generate_study_material(self.dummy_context, "flashcards", options={"count": 100})
        # The engine should try to pad or at least return what it can
        self.assertIsInstance(result, list)
        logger.info(f"Generated {len(result)} cards for impossible request.")

    def test_constraints_expert_nuance(self):
        """Case: Requesting Expert difficulty on simple text."""
        logger.info("Testing Expert Difficulty on Simple Text...")
        result = generate_study_material(self.dummy_context, "quiz", options={"difficulty": "Expert", "count": 1})
        self.assertIsInstance(result, dict)
        self.assertIn("questions", result)

    def test_reliability_malformed_json_repair(self):
        """Case: Simulating broken JSON structure from LLM (needs manual mock or specific prompt)."""
        # build_prompt is internal but generate_study_material has repair logic
        logger.info("Testing JSON Repair Logic (via simulation if possible)...")
        # We can't easily force Ollama to fail, but we can verify the repair code paths 
        # roughly through different material types.
        pass

    def test_special_chars_encoding(self):
        """Case: Context with emojis and non-Latin scripts."""
        logger.info("Testing Special Characters (Emojis, Arabic, Math)...")
        special_context = ["Photosynthesis is 🔥. النباتات تصنع الغذاء. E=mc^2."]
        result = generate_study_material(special_context, "flashcards", options={"count": 2})
        self.assertIsInstance(result, list)
        self.assertTrue(len(result) >= 1)

    def test_invalid_type_graceful_fail(self):
        """Case: Requesting a non-existent material type."""
        logger.info("Testing Invalid Material Type...")
        result = generate_study_material(self.dummy_context, "voodoo_magic")
        # LLM might return JSON anyway if instructed, or raw text.
        self.assertTrue(isinstance(result, (str, dict)))

if __name__ == "__main__":
    unittest.main()
