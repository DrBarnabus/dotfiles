# MSYS2 converts '/' to the Git install path when passing args to native
# Windows executables, which breaks fzf-tab's --expect=/ argument.
zstyle ':fzf-tab:*' continuous-trigger '//'

# MSYS2 drive mounts (/c, /d, etc.) are virtual and don't appear in
# directory listings, so zsh's completion system can't discover them.
zstyle ':completion:*' fake-files "/:$(mount | sed -rn 's#^[A-Z]: on /([a-z]).*#\1#p' | tr '\n' ' ')"
