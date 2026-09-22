import os
import sys
import time
import subprocess
import argparse
from pathlib import Path
import logging

# We use the built-in MCP protocol over stdio just enough to keep Antigravity happy.
# We don't actually need to expose tools, we just need the lifecycle management!
def run_mcp_server():
    # Read initialization request
    try:
        init_req = sys.stdin.readline()
        if not init_req:
            return
        # Send initialization response
        sys.stdout.write('{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{},"serverInfo":{"name":"handoff-watcher","version":"1.0.0"}}}\n')
        sys.stdout.flush()
        
        # Read initialized notification
        sys.stdin.readline()
    except Exception:
        pass
        
    root = Path(__file__).resolve().parent.parent.parent.parent
    handoff_dir = root / "project_docs" / "active" / "ai_hand_off"
    
    # Keep track of file mtimes
    file_mtimes = {}
    file_settle_timers = {}

    if handoff_dir.exists():
        for p in handoff_dir.glob("*.md"):
            if p.name.lower() == "readme.md": continue
            try:
                file_mtimes[p] = p.stat().st_mtime_ns
            except OSError:
                pass

    while True:
        time.sleep(2.0)
        if not handoff_dir.exists():
            continue

        try:
            current_files = list(handoff_dir.glob("*.md"))
        except OSError:
            continue
            
        for p in current_files:
            if p.name.lower() == "readme.md": continue
            
            try:
                current_mtime = p.stat().st_mtime_ns
            except OSError:
                continue
            
            last_mtime = file_mtimes.get(p)
            if last_mtime is None or current_mtime != last_mtime:
                file_mtimes[p] = current_mtime
                file_settle_timers[p] = time.monotonic()
        
        now = time.monotonic()
        for p in list(file_settle_timers.keys()):
            settle_start = file_settle_timers[p]
            if now - settle_start >= 5.0:
                del file_settle_timers[p]
                
                # File has settled. Trigger!
                relative_path = p.relative_to(root).as_posix()
                msg = f"Codex has provided a new handoff or repair file: {relative_path}. Please review and implement it automatically."
                
                try:
                    import shutil
                    agy_cmd = shutil.which("agy") or "agy"
                    cmd_list = [agy_cmd, "--continue", "--print-timeout", "30m", f"--print={msg}"]
                    
                    if os.name == 'nt':
                        cmd_to_run = subprocess.list2cmdline(cmd_list)
                    else:
                        cmd_to_run = cmd_list
                        
                    with open(root / "watcher.log", "a") as f:
                        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Triggering: {cmd_to_run}\n")
                        
                    p = subprocess.Popen(
                        cmd_to_run,
                        cwd=str(root),
                        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
                        close_fds=True,
                        shell=True if os.name == 'nt' else False,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                    
                    # We shouldn't communicate() because it blocks, but we can write that we started it
                    with open(root / "watcher.log", "a") as f:
                        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Popen successful, PID={p.pid}\n")
                except Exception as e:
                    with open(root / "watcher.log", "a") as f:
                        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Exception: {str(e)}\n")

if __name__ == "__main__":
    # MCP servers communicate over stdio, so we redirect logging to stderr
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)
    run_mcp_server()
