#!/usr/bin/env python3
"""
Automated migration script for converting components from AppContext to specialized contexts.
"""

import re
import sys
from pathlib import Path

def migrate_sessions_zone(file_path):
    """Migrate SessionsZone.tsx to use SessionsContext and UIContext"""
    with open(file_path, 'r') as f:
        content = f.read()

    # Step 1: Update imports
    content = content.replace(
        "import { useApp } from '../context/AppContext';",
        "import { useSessions } from '../context/SessionsContext';\nimport { useUI } from '../context/UIContext';"
    )

    # Step 2: Replace hook destructuring patterns
    # Pattern 1: const { state, dispatch } = useApp();
    content = re.sub(
        r'const\s+{\s*state,\s*dispatch\s*}\s*=\s*useApp\(\);',
        '''const { sessions, activeSessionId, startSession, endSession, pauseSession, resumeSession, updateSession, deleteSession, addScreenshot, addAudioSegment } = useSessions();
  const { state: uiState, dispatch: uiDispatch, addNotification } = useUI();''',
        content
    )

    # Step 3: Replace state references
    replacements = [
        (r'\bstate\.sessions\b', 'sessions'),
        (r'\bstate\.activeSessionId\b', 'activeSessionId'),
        (r'\bstate\.ui\.', 'uiState.'),
        (r'\bstate\.onboarding\b', 'uiState.onboarding'),
    ]

    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    # Step 4: Replace dispatch calls for UI actions
    content = re.sub(
        r"dispatch\(\{\s*type:\s*'MARK_FEATURE_INTRODUCED',\s*payload:\s*'([^']+)'\s*\}\);",
        r"uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: '\1' });",
        content
    )

    content = re.sub(
        r"dispatch\(\{\s*type:\s*'ADD_NOTIFICATION',\s*payload:\s*({[^}]+})\s*\}\);",
        r"addNotification(\1);",
        content
    )

    # Step 5: Replace dispatch calls for session actions with method calls
    session_action_patterns = [
        (r"dispatch\(\{\s*type:\s*'START_SESSION',\s*payload:\s*([^}]+)\}\);", r"startSession(\1);"),
        (r"dispatch\(\{\s*type:\s*'END_SESSION',\s*payload:\s*([^}]+)\}\);", r"endSession(\1);"),
        (r"dispatch\(\{\s*type:\s*'PAUSE_SESSION',\s*payload:\s*([^}]+)\}\);", r"pauseSession(\1);"),
        (r"dispatch\(\{\s*type:\s*'RESUME_SESSION',\s*payload:\s*([^}]+)\}\);", r"resumeSession(\1);"),
        (r"dispatch\(\{\s*type:\s*'UPDATE_SESSION',\s*payload:\s*([^}]+)\}\);", r"updateSession(\1);"),
        (r"dispatch\(\{\s*type:\s*'DELETE_SESSION',\s*payload:\s*([^}]+)\}\);", r"deleteSession(\1);"),
        (r"dispatch\(\{\s*type:\s*'ADD_SESSION_SCREENSHOT',\s*payload:\s*({[^}]+})\}\);", r"addScreenshot(\1.sessionId, \1);"),
        (r"dispatch\(\{\s*type:\s*'ADD_SESSION_AUDIO_SEGMENT',\s*payload:\s*({[^}]+})\}\);", r"addAudioSegment(\1.sessionId, \1);"),
    ]

    for pattern, replacement in session_action_patterns:
        content = re.sub(pattern, replacement, content)

    # Write back
    with open(file_path, 'w') as f:
        f.write(content)

    print(f"✅ Migrated {file_path}")

def migrate_capture_zone(file_path):
    """Migrate CaptureZone.tsx to use all 6 contexts"""
    with open(file_path, 'r') as f:
        content = f.read()

    # Step 1: Update imports
    content = content.replace(
        "import { useApp } from '../context/AppContext';",
        """import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useEntities } from '../context/EntitiesContext';
import { useNotes } from '../context/NotesContext';
import { useTasks } from '../context/TasksContext';
import { useSessions } from '../context/SessionsContext';"""
    )

    # Step 2: Replace hook destructuring
    content = re.sub(
        r'const\s+{\s*state,\s*dispatch\s*}\s*=\s*useApp\(\);',
        '''const { state: settingsState } = useSettings();
  const { state: uiState, dispatch: uiDispatch, addNotification, addProcessingJob } = useUI();
  const { state: entitiesState, addTopic } = useEntities();
  const { addNote, updateNote } = useNotes();
  const { addTask } = useTasks();
  const { sessions } = useSessions();''',
        content
    )

    # Step 3: Replace state references
    replacements = [
        (r'\bstate\.aiSettings\b', 'settingsState.aiSettings'),
        (r'\bstate\.userProfile\b', 'settingsState.userProfile'),
        (r'\bstate\.nedSettings\b', 'settingsState.nedSettings'),
        (r'\bstate\.ui\.', 'uiState.'),
        (r'\bstate\.quickCaptureOpen\b', 'uiState.quickCaptureOpen'),
        (r'\bstate\.companies\b', 'entitiesState.companies'),
        (r'\bstate\.contacts\b', 'entitiesState.contacts'),
        (r'\bstate\.topics\b', 'entitiesState.topics'),
        (r'\bstate\.notes\b', 'notesState.notes'),
        (r'\bstate\.tasks\b', 'tasksState.tasks'),
        (r'\bstate\.sessions\b', 'sessions'),
    ]

    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    # Step 4: Replace dispatch calls
    content = re.sub(
        r"dispatch\(\{\s*type:\s*'ADD_NOTIFICATION',\s*payload:\s*({[^}]+})\s*\}\);",
        r"addNotification(\1);",
        content
    )

    content = re.sub(
        r"dispatch\(\{\s*type:\s*'ADD_PROCESSING_JOB',\s*payload:\s*({[^}]+})\s*\}\);",
        r"addProcessingJob(\1);",
        content
    )

    content = re.sub(
        r"dispatch\(\{\s*type:\s*'ADD_TOPIC',\s*payload:\s*([^}]+)\}\);",
        r"addTopic(\1);",
        content
    )

    content = re.sub(
        r"dispatch\(\{\s*type:\s*'ADD_NOTE',\s*payload:\s*([^}]+)\}\);",
        r"addNote(\1);",
        content
    )

    content = re.sub(
        r"dispatch\(\{\s*type:\s*'UPDATE_NOTE',\s*payload:\s*([^}]+)\}\);",
        r"updateNote(\1);",
        content
    )

    content = re.sub(
        r"dispatch\(\{\s*type:\s*'ADD_TASK',\s*payload:\s*([^}]+)\}\);",
        r"addTask(\1);",
        content
    )

    # UI dispatch calls
    ui_patterns = [
        (r"dispatch\(\{\s*type:\s*'TOGGLE_QUICK_CAPTURE'\s*\}\);", "uiDispatch({ type: 'TOGGLE_QUICK_CAPTURE' });"),
        (r"dispatch\(\{\s*type:\s*'SET_ACTIVE_TAB',\s*payload:\s*([^}]+)\}\);", r"uiDispatch({ type: 'SET_ACTIVE_TAB', payload: \1 });"),
    ]

    for pattern, replacement in ui_patterns:
        content = re.sub(pattern, replacement, content)

    # Write back
    with open(file_path, 'w') as f:
        f.write(content)

    print(f"✅ Migrated {file_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 migrate_component.py <component_name>")
        print("Example: python3 migrate_component.py SessionsZone")
        sys.exit(1)

    component = sys.argv[1]
    base_path = Path("/Users/jamesmcarthur/Documents/taskerino/src/components")

    if component == "SessionsZone":
        migrate_sessions_zone(base_path / "SessionsZone.tsx")
    elif component == "CaptureZone":
        migrate_capture_zone(base_path / "CaptureZone.tsx")
    else:
        print(f"Unknown component: {component}")
        print("Supported components: SessionsZone, CaptureZone")
        sys.exit(1)
