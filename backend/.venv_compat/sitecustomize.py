from typing import ForwardRef

original_evaluate = ForwardRef._evaluate

def patched_evaluate(self, globalns, localns, recursive_guard=None):
    if recursive_guard is None:
        recursive_guard = set()
    return original_evaluate(self, globalns, localns, recursive_guard)

ForwardRef._evaluate = patched_evaluate
