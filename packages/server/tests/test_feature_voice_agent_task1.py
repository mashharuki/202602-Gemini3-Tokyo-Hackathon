import pathlib
import unittest

SERVER_DIR = pathlib.Path(__file__).resolve().parents[1]
ROOT = SERVER_DIR.parents[1]


class TestFeatureVoiceAgentTask1Scaffold(unittest.TestCase):
    def test_server_scaffold_files_exist(self) -> None:
        self.assertTrue((SERVER_DIR / "agent").is_dir())
        self.assertTrue((SERVER_DIR / "agent" / "__init__.py").is_file())
        self.assertTrue((SERVER_DIR / "pyproject.toml").is_file())
        self.assertTrue((SERVER_DIR / ".env.example").is_file())

    def test_env_example_contains_google_api_key(self) -> None:
        content = (SERVER_DIR / ".env.example").read_text(encoding="utf-8")
        self.assertIn("GOOGLE_API_KEY=", content)

    def test_pyproject_declares_required_dependencies(self) -> None:
        pyproject = (SERVER_DIR / "pyproject.toml").read_text(encoding="utf-8")
        self.assertIn("fastapi", pyproject)
        self.assertIn("google-adk", pyproject)
        self.assertIn("uvicorn", pyproject)

    def test_gitignore_includes_env_rule(self) -> None:
        gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn(".env", gitignore)


if __name__ == "__main__":
    unittest.main()
