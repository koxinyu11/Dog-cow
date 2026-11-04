import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'scripts' / 'auto-sync.sh'

class AutoSyncTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='dogcow-sync-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.remote = self.root / 'remote.git'
        self.repo = self.root / 'local'
        self.env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM='1', GIT_TERMINAL_PROMPT='0')
        self.git(self.root, 'init', '--bare', str(self.remote))
        self.git(self.root, 'init', '-b', 'main', str(self.repo))
        self.git(self.repo, 'config', 'user.email', 'test@example.invalid')
        self.git(self.repo, 'config', 'user.name', 'Test')
        (self.repo / 'scripts').mkdir()
        shutil.copyfile(SOURCE, self.repo / 'scripts' / 'auto-sync.sh')
        (self.repo / '.gitignore').write_text('.autosync.lock/\n')
        (self.repo / 'task.txt').write_text('initial')
        self.git(self.repo, 'add', '.')
        self.git(self.repo, 'commit', '-m', 'initial')
        self.git(self.repo, 'remote', 'add', 'origin', str(self.remote))
        self.git(self.repo, 'push', '-u', 'origin', 'main')

    def git(self, cwd, *args):
        return subprocess.run(['git', *args], cwd=cwd, env=self.env, text=True,
                              capture_output=True, check=True).stdout.strip()

    def sync(self):
        return subprocess.run(['zsh', 'scripts/auto-sync.sh'], cwd=self.repo,
                              env=self.env, text=True, capture_output=True)

    def test_push_failure_retries_without_new_changes(self):
        hook = self.remote / 'hooks' / 'pre-receive'
        hook.write_text('#!/bin/sh\nexit 1\n')
        hook.chmod(0o755)
        (self.repo / 'task.txt').write_text('changed')
        result = self.sync()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('commits retained', result.stderr)
        local_head = self.git(self.repo, 'rev-parse', 'HEAD')
        self.assertEqual(self.git(self.repo, 'status', '--porcelain'), '')
        hook.unlink()
        self.assertEqual(self.sync().returncode, 0)
        self.assertEqual(self.git(self.root, '--git-dir', str(self.remote), 'rev-parse', 'main'), local_head)
        self.assertEqual(self.git(self.repo, 'rev-parse', 'HEAD'), local_head)
        self.assertEqual(self.sync().returncode, 0)

    def test_other_branch_is_not_staged_or_pushed(self):
        self.git(self.repo, 'switch', '-c', 'feature')
        (self.repo / 'task.txt').write_text('feature work')
        before = self.git(self.repo, 'rev-parse', 'HEAD')
        self.assertNotEqual(self.sync().returncode, 0)
        self.assertEqual(self.git(self.repo, 'rev-parse', 'HEAD'), before)
        self.assertEqual(self.git(self.repo, 'diff', '--cached'), '')
        self.assertEqual((self.repo / 'task.txt').read_text(), 'feature work')

    def advance_remote(self):
        other = self.root / 'other'
        self.git(self.root, 'clone', '-b', 'main', str(self.remote), str(other))
        self.git(other, 'config', 'user.email', 'test@example.invalid')
        self.git(other, 'config', 'user.name', 'Test')
        (other / 'remote.txt').write_text('remote work')
        self.git(other, 'add', '.')
        self.git(other, 'commit', '-m', 'remote change')
        self.git(other, 'push', 'origin', 'main')

    def test_behind_or_diverged_stops_without_touching_work(self):
        self.advance_remote()
        (self.repo / 'task.txt').write_text('local work')
        before = self.git(self.repo, 'rev-parse', 'HEAD')
        self.assertIn('behind or diverged', self.sync().stderr)
        self.assertEqual(self.git(self.repo, 'rev-parse', 'HEAD'), before)
        self.assertEqual(self.git(self.repo, 'diff', '--cached'), '')
        self.git(self.repo, 'add', 'task.txt')
        self.git(self.repo, 'commit', '-m', 'local change')
        before = self.git(self.repo, 'rev-parse', 'HEAD')
        self.assertIn('behind or diverged', self.sync().stderr)
        self.assertEqual(self.git(self.repo, 'rev-parse', 'HEAD'), before)

    def test_fetch_failure_preserves_pending_work(self):
        self.git(self.repo, 'remote', 'set-url', 'origin', str(self.root / 'missing.git'))
        (self.repo / 'task.txt').write_text('pending')
        self.assertIn('fetch failed', self.sync().stderr)
        self.assertEqual(self.git(self.repo, 'diff', '--cached'), '')
        self.assertEqual((self.repo / 'task.txt').read_text(), 'pending')

if __name__ == '__main__':
    unittest.main()
