_prepend_path() { [ -d "$1" ] || return; case ":$PATH:" in *":$1:"*) ;; *) PATH="$1:$PATH" ;; esac; }
_append_path()  { [ -d "$1" ] || return; case ":$PATH:" in *":$1:"*) ;; *) PATH="$PATH:$1" ;; esac; }

_prepend_path "$HOME/.local/bin"
export PATH
