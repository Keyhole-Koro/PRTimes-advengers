from tasks.checklist_generate import build_checklist_generate_task
from tasks.document_edit import build_document_edit_task


def build_task_registry():
    tasks = [
        build_document_edit_task(),
        build_checklist_generate_task(),
    ]
    return {task.name: task for task in tasks}
