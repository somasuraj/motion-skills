__TITLE__
==========================================

To __VERB__ it, double-click the launcher for your computer:

  Windows   __LAUNCH_WIN__
  macOS     __LAUNCH_MAC__   (first time: right-click it, choose Open, then Open)
  Linux     __LAUNCH_LINUX__  (or run:  sh "__LAUNCH_LINUX__")

It opens __PAGE__ in its own window (Edge or Chrome) from a small server that
runs only on this computer (127.0.0.1). Close the window and the server stops.
Nothing is installed. Windows needs nothing extra; macOS and Linux use Python 3.

You can also just open __PAGE__ in any browser: everything works offline,
except YouTube videos, which only play when the page is served this way.

If this deck has a terminal (a >_ button on the bar), it works only when started from a launcher:
press ` (the key left of 1) to open a real shell under the slide (PowerShell on Windows, your usual
shell on macOS/Linux) for live demos or ssh, + for another tab, and Ctrl+` to hide it. Keep the
launcher's console window open while you present.

If it has a browser (a globe button), links on slides and B open pages: apps on this computer
(localhost) in a panel under the slide, websites in your own browser; on Windows the deck then
moves to the left of the screen and the browser to the right. B again gives the
deck the whole screen.

If it has a workbench (E), you can edit the demo folder's files inside the deck, with the terminal
under the editor. The folder is set in _present\workspace.txt (first line); empty means a
'workspace' folder next to the deck. Only that folder can be read or changed.

If there is a "Remote Linux" launcher, it runs the deck's terminal, workbench and demos on a Linux
machine over SSH and shows the deck here; it asks for user@host the first time (saved in
_present\remote.txt). The Linux machine needs Python 3.

The terminal, browser panel and workbench have a ◐ button: Dark, Light or High contrast for those panels
(remembered on this computer). Use Light in a bright room.

To skip a slide while presenting, hover its thumbnail and click the eye (or H). Clicking a command on a slide types it there; you press Enter. Only this
window can use that shell, and closing the window ends it.

Keep the _present folder next to the launchers.
