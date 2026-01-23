local keymap = vim.keymap
local opts = { noremap = true, silent = true }

-- Settings
vim.opt.number = true -- Print the line number in front of each line
vim.opt.relativenumber = true -- Show the line number relative to the line with the cursor in front of each line.
vim.opt.statuscolumn = "%s %5{v:lnum} | %2{v:relnum} " -- Use Absolute numbers and relative numbers in the Status col
vim.opt.clipboard = "unnamedplus" -- uses the clipboard register for all operations except yank.
vim.opt.ignorecase = true -- search ignoring case
vim.opt.smartcase  = true -- disable "ignorecase" option if the search pattern contains upper case characters

-- Remap leader key to <Space>
keymap.set("n", "<Space>", "", opts)
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- Quit
keymap.set("n", "<leader>q", "<CMD>q<CR>")
-- Save
keymap.set({"n", "v"}, "<leader>p", '"+p', opts)
-- Yank to system clipboard
keymap.set({"n", "v"}, "<leader>y", '"+y', opts)
-- Paste from system clipboard
keymap.set("n", "<leader>w", "<CMD>update<CR>")

-- Redo
keymap.set('n', 'U', '<C-r>')
-- Clear search highlighting
keymap.set('n', '<Esc>', ':nohlsearch<cr>')
