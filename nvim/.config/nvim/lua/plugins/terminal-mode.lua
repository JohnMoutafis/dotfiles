if vim.g.vscode then
    return {}
end

return {
    {
        -- File navigation
        "nvim-tree/nvim-tree.lua",
        version = "*",
        lazy = false,
        dependencies = {
            "nvim-tree/nvim-web-devicons",
        },
        config = function()
            require("nvim-tree").setup {}
        end,
    },
    {
        -- Markdown preview
        "OXY2DEV/markview.nvim",
        lazy = false,
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