"==============
"   Options
"==============
set nocompatible
filetype plugin indent on
syntax enable
set autoread
set scrolloff=5
set tabstop=4
set shiftwidth=4
set expandtab
set history=50
set nobackup
set nowb
set noswapfile
set clipboard=unnamed " Yanks go on clipboard.

"--------------
"    Search
"--------------
set showmatch
set hlsearch
set ignorecase
set nohlsearch
set incsearch
set smartcase

"-------------
"  UI options
"-------------
" colorscheme monokai
set number
set ruler
set showmode
set lazyredraw
set laststatus=2
set cmdheight=2

"=============
" Keymapings
"=============

" To copy text to the end-of-line, yy.
" To copy to the end of line with the newline char, press Y.
nnoremap yy y$
