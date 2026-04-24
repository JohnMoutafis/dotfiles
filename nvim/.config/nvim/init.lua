require("config.lazy")

require("keymaps.default")

if vim.g.vscode then
    require("keymaps.vscode")
end