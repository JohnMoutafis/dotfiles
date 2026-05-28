require("keymaps.default")
require("config.lazy")

if vim.g.vscode then
    require("keymaps.vscode")
end
