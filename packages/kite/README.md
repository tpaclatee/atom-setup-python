# Kite Autocomplete Plugin for Atom

Kite is an AI-powered programming assistant that helps you write Python & JavaScript code inside Atom. Kite helps you write code faster by saving you keystrokes and showing you the right information at the right time. Learn more about how Kite boosts your Atom editor's capabilities at https://kite.com/integrations/atom-editor/. 

At a high level, Kite provides you with:
* 🧠 __[Line-of-Code Completions](https://kite.com/blog/product/launching-line-of-code-completions-going-cloudless-and-17-million-in-funding/)__ powered by machine learning models trained on the entire open source code universe
* 🔍 __[Instant documentation](https://kite.com/copilot/)__ for the symbol underneath your cursor so you save time searching for Python docs


## Requirements

* macOS 10.11+, Windows 7+ or Linux
* Atom v1.13.0+
* [Kite Engine](https://kite.com/)

Use another editor? Check out [Kite’s other editor integrations](https://kite.com/integrations/).

## Installation

### Installing the Kite Engine

The [Kite Engine](https://kite.com/) needs to be installed in order for the package to work properly. The package itself
provides the frontend that interfaces with the Kite Engine, which performs all the code analysis and machine learning 100% locally on your computer (no code is sent to a cloud server).

__macOS Instructions__
1. Download the [installer](https://kite.com/download) and open the downloaded `.dmg` file.
2. Drag the Kite icon into the `Applications` folder.
3. Run `Kite.app` to start the Kite Engine.

__Windows Instructions__
1. Download the [installer](https://kite.com/download) and run the downloaded `.exe` file.
2. The installer should run the Kite Engine automatically after installation is complete.

__Linux Instructions__
1. Visit https://kite.com/linux/ to install Kite.
2. The installer should run the Kite Engine automatically after installation is complete.


### Installing the Kite Plugin for Atom

When running the Kite Engine for the first time, you'll be guided through a setup process which will allow you to install
the Atom package. You can also install or uninstall the Atom package at any time using the Kite Engine's [plugin
manager](https://help.kite.com/article/62-managing-editor-plugins).

Alternatively, you have 2 options to manually install the package:
1. Search for "Kite" in Atom's built-in package manager and install from there.
2. Run the command `apm install kite` in your terminal.

[Learn more about why you should use Kite with Atom.](https://kite.com/integrations/atom-editor/)


## Usage

The following is a brief guide to using Kite in its default configuration.

### Tutorial

When starting Atom with the Kite Assistant for the first time, you'll be guided through a tutorial that shows you how to
use Kite.

![tutorial](https://github.com/kiteco/atom-plugin/blob/master/docs/images/tutorial.png?raw=true)

This tutorial will only be displayed once. You can show it again at any time by running the command `Kite: Tutorial` from
Atom's command palette.

### Hover

Hover your mouse cursor over a symbol to view a short summary of what the symbol represents.

![hover](https://github.com/kiteco/atom-plugin/blob/master/docs/images/hover.png?raw=true)

### Documentation

Click on the `Docs` link in the hover popup to open the documentation for the symbol inside the Copilot, Kite's standalone
reference tool.

![copilot](https://github.com/kiteco/atom-plugin/blob/master/docs/images/copilot.png?raw=true)

### Definitions

If a `Def` link is available in the hover popup, clicking on it will jump to the definition of the symbol.

### Autocompletions

Simply start typing in a saved Python or JavaScript file and Kite will automatically suggest completions for what you're 
typing. Kite's autocompletions are all labeled with the `⟠` symbol.

![completions](https://github.com/kiteco/atom-plugin/blob/master/docs/images/completions.png?raw=true)

### Function Signatures

When you call a function, Kite will show you the arguments required to call it.

![signature](https://github.com/kiteco/atom-plugin/blob/master/docs/images/signature.png?raw=true)

Kite also shows you `How others used this` function, which are the most popular calling patterns inferred from all the
open source code on the internet.

### Commands

Kite comes with sevaral commands that you can run from Atom's command palette.

![commands](https://github.com/kiteco/atom-plugin/blob/master/docs/images/commands.png?raw=true)

|Command|Description|
|:---|:---|
|`kite.related-code-from-file`|Search for code related to the current file in the Copilot|
|`kite.related-code-from-line`|Search for code related to the current line in the Copilot|
|`kite:open-copilot`|Open the Copilot|
|`kite:docs-at-cursor`|Show documentation of the symbol underneath your cursor in the Copilot|
|`kite:status`|Show the current status of Kite in the status panel|
|`kite:package-settings`|Open the settings for the Kite Atom package|
|`kite:engine-settings`|Open the settings for the Kite Engine|
|`kite:tutorial`|Open the Kite tutorial file|
|`kite:help`|Open Kite's help website in the browser|

If you wish, you may also setup keybindings for the commands listed above.


## Configuration

You can view and change the Kite Assistant's settings by finding Kite in your list of installed packages, then clicking
the `Settings` button. Alternatively, you can run the command `Kite: Package Settings` from the command palette.


## Troubleshooting

Visit our [help docs](https://help.kite.com) for FAQs and troubleshooting support.

Happy coding!


---

#### About Kite

Kite is built by a team in San Francisco devoted to making programming easier and more enjoyable for all. Follow Kite on
[Twitter](https://twitter.com/kitehq) and get the latest news and programming tips on the
[Kite Blog](https://kite.com/blog).
Kite has been featured in [Wired](https://www.wired.com/2016/04/kites-coding-asssitant-spots-errors-finds-better-open-source/), 
[VentureBeat](https://venturebeat.com/2019/01/28/kite-raises-17-million-for-its-ai-powered-developer-environment/), 
[The Next Web](https://thenextweb.com/dd/2016/04/14/kite-plugin/), and 
[TechCrunch](https://techcrunch.com/2019/01/28/kite-raises-17m-for-its-ai-driven-code-completion-tool/). 

