return {
    "nvim-mini/mini.move",
    event = "VeryLazy",
    opts = {
        -- Module mappings. Use `''` (empty string) to disable one.
        mappings = {
            -- Move visual selection in Visual mode. 
            -- Alt (Meta) + Shift + hjkl.
            left  = "<M-H>",
            down  = "<M-J>",
            up    = "<M-K>",
            right = "<M-L>",
            -- Move current line in Normal mode
            line_left  = "<M-H>",
            line_down  = "<M-J>",
            line_up    = "<M-K>",
            line_right = "<M-L>",
        },
        
        -- Options which control moving behavior
        options = {
            -- Automatically reindent selection during linewise vertical move
            reindent_linewise = true,
        },
    },
}