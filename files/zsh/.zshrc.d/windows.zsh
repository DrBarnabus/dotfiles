# MSYS2 converts '/' to the Git install path when passing args to native
# Windows executables, which breaks fzf-tab's --expect=/ argument.
zstyle ':fzf-tab:*' continuous-trigger '//'

# Report cwd to Windows Terminal for pane splitting
_wt_enable_cwd_reporting cygpath
