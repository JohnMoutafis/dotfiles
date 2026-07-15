if [[ -f "/opt/homebrew/bin/brew" ]] then
  # If you're using macOS, you'll want this enabled
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# ---------------------------------------------------------
# Inspired by Z-Shift:
#   https://github.com/0xdilshan/Z-SHIFT/blob/main/.zshrc
# ---------------------------------------------------------
#               ZINIT Source or Install
# ---------------------------------------------------------
# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
   mkdir -p "$(dirname $ZINIT_HOME)"
   git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# Source the exports file early
source $HOME/.config/terminal/exports

# ---------------------------------------------------------
#                   Load Prompt
# ---------------------------------------------------------
# === Starship prompt ===
# Optimization: Generates init.zsh on install/update to avoid 'eval' at runtime
# zinit ice as"command" from"gh-r" \
#           atclone"./starship init zsh > init.zsh; ./starship completions zsh > _starship" \
#           atpull"%atclone" \
#           src"init.zsh"
# zinit light starship/starship

# === Oh My Posh prompt ===
# Path to your Oh My Posh config
OMP_CONFIG="${HOME}/.config/oh-my-posh/theme.toml"
eval "$(oh-my-posh init zsh --config ${OMP_CONFIG})"

# ---------------------------------------------------------
#             Load ZSH Plugins
# ---------------------------------------------------------
# --- Core Libraries & Utilities ---
zinit wait lucid for \
    OMZL::clipboard.zsh \
    OMZP::extract \
    OMZP::sudo \
    OMZP::git \
    OMZP::command-not-found \
    MichaelAquilina/zsh-you-should-use

# --- EZA (Smarter ls) ---
zinit ice wait lucid as"program" from"gh-r" pick"eza" \
    atclone"./eza --completions zsh > _eza" \
    atpull"%atclone"
zinit light eza-community/eza

# --- FZF (Fuzzy Finder) ---
# Standard, stable loading.
zinit ice as"program" from"gh-r" wait lucid \
    atload'source <(fzf --zsh); export FZF_DEFAULT_COMMAND="fd --type f --strip-cwd-prefix --hidden --follow --exclude .git"; export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"'
zinit light junegunn/fzf

# --- RIPGREP (Improved Grep) ---
zinit ice as"program" from"gh-r" mv"ripgrep* -> ripgrep" pick"ripgrep/rg" wait lucid
zinit light BurntSushi/ripgrep

# --- Zoxide (Smarter cd) ---
zinit ice wait lucid as"program" from"gh-r" pick"zoxide" \
    atclone"./zoxide init zsh --cmd cd > init.zsh" \
    atpull"%atclone" \
    src"init.zsh" nocompile"init.zsh"
zinit light ajeetdsouza/zoxide

# --- thefuck (Fix typos) ---
zinit ice wait"1" lucid
zinit light laggardkernel/zsh-thefuck

# --- Completions, Suggestions & Highlighting ---
# Load Completions First
zinit wait lucid blockf atpull"zinit creinstall -q ." for \
    zsh-users/zsh-completions
# Syntax Highlighting & Autosuggestions
zinit wait lucid for \
    atinit"zicompinit; zicdreplay" \
        zdharma-continuum/fast-syntax-highlighting \
    atload"_zsh_autosuggest_start" \
        zsh-users/zsh-autosuggestions
# Docker completions
zinit wait lucid as"completion" for \
    OMZP::docker/completions/_docker \
    OMZP::docker-compose/_docker-compose

# ---------------------------------------------------------
#                   Configuration
# ---------------------------------------------------------
# --- History ---
HISTSIZE=5000
SAVEHIST=$HISTSIZE
HISTFILE=~/.zsh_history
HISTDUP=erase
setopt HIST_IGNORE_ALL_DUPS    # remove older duplicate entries from history
setopt HIST_EXPIRE_DUPS_FIRST  # expire duplicates first
setopt HIST_FIND_NO_DUPS       # don't show duplicates in history search
setopt HIST_IGNORE_SPACE
setopt HIST_VERIFY
setopt HIST_REDUCE_BLANKS      # remove superfluous blanks from history items
setopt SHARE_HISTORY           # share history between different instances of the shell
setopt APPEND_HISTORY          # append to history file instead of overwriting
setopt AUTO_CD                 # automatically cd into directory if command is a directory
setopt AUTO_LIST               # automatically list choices on ambiguous completion
setopt AUTO_MENU               # automatically use menu completion

# --- Completion Styling (Replaces OMZL::completion.zsh) ---
# Case-insensitive matching (a matches A)
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=*'
# Colored completion list
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
# Menu selection (navigate with arrow keys)
zstyle ':completion:*:*:*:*:*' menu select
# Group results by category
zstyle ':completion:*' group-name ''
zstyle ':completion:::::' completer _expand _complete _ignored _approximate

# ---------------------------------------------------------
#                   Keybindings
# ---------------------------------------------------------
# Fish style substring history search with up/down
zinit light zsh-users/zsh-history-substring-search
bindkey -e
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down
bindkey "\e\e" fuck-command-line

# ---------------------------------------------------------
#               Source Custom Files
# ---------------------------------------------------------
source $HOME/.config/terminal/aliases
source $HOME/.config/terminal/functions
source $HOME/.config/terminal/local-aliases

# sunglasses
