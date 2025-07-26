-- Line numbering
vim.o.number = true
vim.o.relativenumber = true

-- Enable mouse mode
vim.o.mouse = 'a'

-- Don't show the mode, it's already in the status line
vim.o.showmode = false

-- Sync clipboard between OS and Neovim
vim.schedule(function()
  vim.o.clipboard = 'unnamedplus'
end)

-- Enable break indent
vim.o.breakindent = true

-- Tabstop & widths
vim.o.tabstop = 4
vim.o.softtabstop = 4
vim.o.shiftwidth = 4
vim.o.expandtab = true

-- Smartindent
vim.o.smartindent = true

-- No wrap
vim.o.wrap = false

-- Undo history
vim.o.swapfile = false
vim.o.backup = false
vim.o.undodir = os.getenv 'HOME' .. '/.vim/undodir'
vim.o.undofile = true

-- Search
vim.o.ignorecase = true
vim.o.smartcase = true
vim.o.hlsearch = false
vim.o.incsearch = true

-- Keep signcolumn on by default
vim.o.signcolumn = 'yes'

-- Decrease update time
vim.o.updatetime = 250

-- Decrease mapped sequence wait time
vim.o.timeoutlen = 300

-- Configure how new splits should be opened
vim.o.splitright = true
vim.o.splitbelow = true

-- Show whitespace characters
vim.o.list = true
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }

-- Preview substitutions
vim.o.inccommand = 'split'

-- Show which line cursor is on
vim.o.cursorline = true

-- Keep at least 8 lines around cursor
vim.o.scrolloff = 8

-- If an operation would fail due to unsaved, ask if I want to save first
vim.o.confirm = true
