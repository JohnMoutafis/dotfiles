local vscode = require('vscode')
local keymap = vim.keymap

keymap.set({"n", "v"}, "<leader>t", "<cmd>lua require('vscode').action('workbench.action.terminal.toggleTerminal')<CR>")

-- Split/Move Editor between right/left editor groups. Creates new group if needed.
keymap.set("n", "g>", "<cmd>lua require('vscode').action('workbench.action.moveEditorToRightGroup')<cr>")
keymap.set("n", "g<", "<cmd>lua require('vscode').action('workbench.action.moveEditorToLeftGroup')<cr>")