if vim.g.vscode then
    return {}
end

return {
    {
        -- Markdown preview
        "OXY2DEV/markview.nvim",
        lazy = true,
    },
    -- LSP Server Configuration
    {
        "nvim-treesitter/nvim-treesitter",
        opts = function(_, opts)
        vim.list_extend(opts.ensure_installed, { "nim" })
        end,
    },
    {
        "neovim/nvim-lspconfig",
        opts = {
            servers = {
                nim_langserver = {
                    settings = {
                        nim = {
                            nimsuggestPath = "nimsuggest",
                            autoCheckFile = true,
                            autoCheckProject = true,
                            formatOnSave = true,  -- requires nph on PATH
                            notificationVerbosity = "warning",
                        },
                    },
                },
            },
        },
    },
    {
        "mg979/vim-visual-multi",
        event="VeryLazy",
        init = function()
            -- vim.g.VM_default_mappings = 0
            -- vim.g.VM_maps = {
            --     ['Add Cursor Up'] = '<C-Up>',
            --     ['Add Cursor Down'] = '<C-Down>'
            -- }
            vim.g.VM_add_cursor_at_pos_no_mappings = 1
            vim.g.VM_mouse_mappings=1
        end,
    }
}