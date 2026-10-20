#!/bin/sh
# Run (or double-click, if your file manager allows) to __VERB__ __PAGE__ in its own window. Close that window to stop.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 _present/serve.py "__PAGE__"
else
  echo "Python 3 is needed to serve the page; opening the file directly instead."
  xdg-open "__PAGE__"
fi
