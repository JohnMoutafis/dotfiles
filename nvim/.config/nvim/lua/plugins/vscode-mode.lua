if not vim.g.vscode then
    return {}
end

return {
    -- { -- VSCode Multi Cursor by VSCode NeoVim
    --     'vscode-neovim/vscode-multi-cursor.nvim',
    --     event = 'VeryLazy',
    --     cond = true, -- dump as fuck but only works with that...
    --     opts = {}
    -- },
    -- Disable LazyVim unneeded installed plugins for VSCode mode
    -- disable tokyonight (theme)
    {
        'folke/tokyonight.nvim',
        enabled = false,
    },
}