#!/bin/bash
# Double-click to __VERB__ __PAGE__ in its own window. Close that window to stop.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 _present/serve.py "__PAGE__"
else
  echo "Python 3 is needed to serve the page (install it from python.org)."
  echo "Opening the file directly instead; everything except YouTube slides works."
  open "__PAGE__"
  read -n 1 -s -r -p "Press any key to close."
fi
