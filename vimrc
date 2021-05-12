set nocompatible

"========================
" Setup vim-plug plugins
"========================
call plug#begin('~/.vim/plugged')

" Use only single quotes
Plug 'dense-analysis/ale'
Plug 'jiangmiao/auto-pairs'
Plug 'maralla/completor.vim'
Plug 'dikiaap/minimalist'
Plug 'powerline/powerline'
Plug 'itchyny/lightline.vim'
Plug 'tpope/vim-surround'
Plug 'jmcantrell/vim-virtualenv'
Plug 'machakann/vim-highlightedyank'

call plug#end()

"===================
"  General Options
"===================
filetype plugin indent on
syntax enable
set autoread
set encoding=utf-8
set scrolloff=5
set tabstop=4
set shiftwidth=4
set expandtab
set history=50
set nobackup
set nowb
set noswapfile
set clipboard=unnamedplus " Yanks go on clipboard.

"==============
"    Search
"==============
set showmatch
set hlsearch
set ignorecase
set nohlsearch
set incsearch
set smartcase

"=============
"  UI options
"=============
colorscheme minimalist
set number
set ruler
set showmode
set lazyredraw
set laststatus=2
set cmdheight=2
set splitright

"=============
" Keymapings
"=============
" To copy text to the end-of-line, yy.
" To copy to the end of line with the newline char, press Y.
nnoremap yy y$
" Navigation for splitted windows
" Ctrl-l: move right
" Ctrl-h: move left
nnoremap <C-L> <C-W><C-L>
nnoremap <C-H> <C-W><C-H>

"===============
" Plugin Config
"===============

" Python virtualenv folder
let g:virtualenv_directory = '~/.virtualenvs'

" completor
let g:completor_python_binary = "/usr/bin/python"
inoremap <expr> <Tab> pumvisible() ? "\<C-n>" : "\<Tab>"
inoremap <expr> <S-Tab> pumvisible() ? "\<C-p>" : "\<S-Tab>"
inoremap <expr> <cr> pumvisible() ? "\<C-y>\<cr>" : "\<cr>"

hi pythonSelf  ctermfg=68  guifg=#5f87d7 cterm=bold gui=bold

" Highlight Yank Duration
let g:highlightedyank_highlight_duration = 1000

