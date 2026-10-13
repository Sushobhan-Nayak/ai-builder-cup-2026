"""
ADK 2.0 Compatibility layer for GembaOS agents.
Ensures google.adk.tools provides @tool decorator and BuiltInTool constructor.
"""
try:
    import google.adk.tools as _gt
    
    def tool(fn=None):
        if callable(fn):
            return fn
        def decorator(f):
            return f
        return decorator
        
    def BuiltInTool(name: str):
        if hasattr(_gt, name):
            return getattr(_gt, name)
        return name

    _gt.tool = tool
    _gt.BuiltInTool = BuiltInTool

except ImportError:
    pass

